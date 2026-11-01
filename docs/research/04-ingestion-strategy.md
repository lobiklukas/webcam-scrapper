# 04 — Ingestion: adapters, scheduling, storage, deferred pipeline

Companion to `02-camera-sources.md` (where the data is) and `03-camera-management.md` (how a
camera gets in). This file is about what happens after a camera exists.

## Two things to ingest, not one

1. **Catalogues.** A source lists cameras with coordinates and metadata: Digitraffic stations,
   Caltrans districts, TfL JamCams. Fetched on a schedule (hourly or daily), diffed, and applied as
   `added / updated / removed`. Rarely more than a few requests per run.
2. **Frames.** One image per camera per interval. This is the volume: one request per camera per
   cadence, forever.

Keeping them apart matters: a catalogue adapter can be wrong for a day without losing frames, and
a frame fetch can fail for a camera that is still perfectly listed.

## Adapter interface

```
adapter.list(): AsyncIterable<CameraRecord>     // catalogue sources only
adapter.fetch(camera): Promise<Frame>           // every source
```

`CameraRecord`: `providerRef`, `title`, `lat`, `lon`, `pageUrl`, `cadenceS`, `categories`,
`licenseUrl`, `raw`.

`Frame`: `bytes`, `contentType`, `width`, `height`, `capturedAt`, `httpStatus`, `etag`,
`lastModified`, or a failure with a named reason.

Adapters stay thin and contain only source-specific mapping. Guard, dedupe, storage, variants and
health are shared code, not per-adapter code.

| Adapter | Listing | Frame | Notes |
| --- | --- | --- | --- |
| `digitraffic` | GeoJSON stations, presets flattened into cameras | `weathercam.digitraffic.fi/{presetId}.jpg` | send `Accept-Encoding: gzip` and `Digitraffic-User` |
| `caltrans` | one JSON per district, `data[].cctv` | `imageData.static.currentImageURL` | filter `inService`; 178 of 3 610 are out of service |
| `tfl` | `Place/Type/JamCam` | `additionalProperties[key=imageUrl]` | images on an S3 host, add it to the allowlist |
| `foto-webcam` | scrape the index page (309 links) | `/webcam/{name}/current/1200.jpg` | constant filename, compare bytes |
| `panomax` | none | `api.panomax.com/1.0/cams/{id}/images/day`, pick the newest slot | tiled panorama, needs stitching |
| `snapshot` | manual | the URL the user gave | the default for a camera added by hand |
| `hls` / `mp4` | manual | not a frame source | a live tab, deferred |

`capturedAt` is the time the image was taken. Prefer the provider's timestamp
(Caltrans `recordTimestamp.recordEpoch`, Digitraffic `dataUpdatedTime`, PANOMAX slot time).
The fetch time is only a fallback and is recorded as `capturedAtSource: 'fetch'` so the UI can say
so.

## Scheduling

One row per camera with `next_poll_at`. The worker claims due cameras with a short transaction:

```sql
SELECT id FROM camera
WHERE poll_enabled AND status = 'active' AND next_poll_at <= now()
ORDER BY next_poll_at
LIMIT 50
FOR UPDATE SKIP LOCKED
```

Then sets `next_poll_at = now() + poll_interval_s + jitter`, where `jitter` is ±5 % but never less
than 5 s, so cameras do not fire in lockstep after a restart.

Concurrency: a global cap (for example 8 in-flight fetches) and a per-host cap of 2. A slow
provider must not delay the rest; a host that answers slower than 5 s on average gets its
concurrency cut to 1.

Backoff on failure, per camera:

| Consecutive failures | Next attempt |
| --- | --- |
| 1 | interval x 1 |
| 2 | interval x 2 |
| 3 | interval x 4, camera becomes `paused` with reason `provider_failures` |
| later | retry every 30 min until one success resets the counter |

Request budget, so the numbers stay honest: 100 cameras at 10 minutes is 10 requests per minute,
which is nothing. The same 100 cameras at 1 minute is 100 per minute, which is already rude to a
public provider that asks for fair use. Set the default at 10 minutes and raise it per source only
with a reason.

## Fetch rules

- HTTPS only, no redirect to a different host unless that host is allowlisted, at most 2 redirects.
- DNS resolution checked against private, loopback, link-local and metadata ranges, re-checked
  after each redirect.
- 10 s timeout, 10 MB cap, streamed so the cap is enforced while reading.
- `Accept: image/jpeg,image/png,image/*;q=0.8`.
- User agent with a contact: `windy-clone/0.1 (+https://example.com/contact)`.
- Conditional requests: send `If-None-Match` / `If-Modified-Since` from the last frame when the
  provider sent them. A 304 counts as a healthy poll and stores no frame.
- `capturedAt` compared with the newest stored frame: if the provider returns an older timestamp
  than we already have, store nothing and log `stale_frame`.

## Dedupe

- sha256 over the bytes. Equal to the newest frame of the same camera → `unchanged`: update
  `last_ok_at`, store nothing.
- Equal to a frame of a *different* camera → store, and flag the pair for the admin UI, because it
  usually means the same view is registered twice.
- Later, when the pipeline lands: a perceptual hash to catch frames that differ by a camera
  timestamp overlay only. Out of scope now; it needs a review step to avoid hiding real changes.

## Freshness

Three timestamps, three meanings, and the UI must not mix them:

| Column | Written when | Used for |
| --- | --- | --- |
| `last_ok_at` | every successful fetch, including `unchanged` and 304 | "is the camera alive" |
| `last_frame_at` | a new frame is stored | "when was this image taken" |
| `last_probe_at` | the admin probe ran | "is this URL still valid" |

A camera whose provider returns the same image for hours is alive and its image is old. Show both:
a green "polling" chip and "last new image 4 h ago". Anything older than three cadences gets the
stale badge on the camera page, as planned in the player work.

## Storage layout

```
frames/{cameraId}/{yyyy}/{mm}/{dd}/{capturedAtEpoch}-original.jpg
frames/{cameraId}/{yyyy}/{mm}/{dd}/{capturedAtEpoch}-preview.jpg
```

Write the object first, then the row, so a crash leaves an orphan object instead of a row without
bytes. Keep the bucket private; hand out signed URLs with a TTL.

Retention: everything for 48 h, one per hour for 30 days, one per day beyond that. A nightly job
deletes rows and objects. This keeps a 100-camera demo under a few GB after a month.

## Storage of the provider record

Keep `raw` (the provider's JSON for that camera) on the camera row, plus `fetched_at`. When a
provider changes a field name, the old record is the diff that explains it. This is cheap and it
has saved every import project I have seen.

## Politeness and terms checklist, per source

Before enabling an adapter, record in `source`:

- licence name and URL, and the attribution text the UI must show
- the provider's stated cadence, if any
- whether `robots.txt` allows the path (`foto-webcam.eu` disallows `/webcam/` for image crawlers)
- the fair-use clause, quoted (`Caltrans`: no usage that risks degrading the streaming service)
- contact address we put in the user agent
- total request rate we allow ourselves for this source

If any of these is missing, the source is imported as a catalogue only and its frames stay off.

## Deferred image pipeline

Not part of the current phase. When it lands it will hang off the frame write:

- variants: `icon`, `thumbnail`, `preview`, `full` (already in the plan, needs a place)
- night detection: mean luminance of the frame, plus the camera timezone, to pick the daylight
  variant and to stop storing pure black frames every 10 minutes at night
- duplicate frames that differ only by an overlay (perceptual hash)
- timelapse MP4 per camera and window, cached
- time overlay cropping for providers that burn a clock into the image

Each of these is a job that reads a stored frame and writes a derived object, so the pipeline does
not block ingestion.

## Metrics that answer real questions

- polls per minute, per source
- failure rate per source and per camera, split by reason
- frames stored per minute, bytes per frame
- age of the newest frame per camera (histogram)
- queue lag: now - `next_poll_at` for due cameras

The one alert that matters early: "a camera that was healthy for an hour has no successful poll in
2 hours".

## Open questions

- Do we need the previous frames Caltrans publishes (`referenceImage1..5`)? They would let us seed
  a short history without waiting. Probably yes, as a one-off backfill for a demo camera.
- Is the Caltrans HLS stream worth a live tab? 2 307 of 3 610 cameras have one, so it is the
  cheapest way to show something live.
- Do we want PANOMAX panoramas at all? Tiled, watermarked, and they need stitching. One camera for
  the panorama viewer, or skip.
