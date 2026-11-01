# 03 — Camera management: flows, rules, data model

Scope: a signed-in user adds a camera, the camera is validated, saved, and from then on polled.
Later the same screens maintain it: change metadata, pause, resume, retire, delete, re-probe.
Image processing is a later phase and only shows up here as the "frames" tab.

## Who does what

One role for now: an operator who may create, edit, pause and delete cameras. The public map reads
what the operator created. If we add a second role later, `viewer` reads the admin screens without
writing. Every write goes through one permission check so adding the role is a small change.

## Entities

```
camera
  id, public_id (short slug for URLs)
  title, description
  lat, lon, timezone, country_code, region_code, city
  status            unverified | active | paused | retired
  source_id         -> source (provider)
  provider_camera_ref   the provider's own id, e.g. "C0150301"
  page_url          provider page, used for the credit link
  license_code, license_url, attribution_text
  poll_interval_s, poll_enabled
  request_headers   jsonb, for providers that need a referer or a token
  last_probe_at, last_probe_status, last_probe_ms
  last_ok_at, last_frame_at, failure_count, next_poll_at
  created_by, created_at, updated_at

camera_image_source      one row per fetchable URL of a camera
  id, camera_id, kind (snapshot | hls | mp4 | youtube), url, size_w, size_h,
  is_primary, last_ok_at

camera_category          camera_id, category_id

poll_attempt             append-only, pruned after 7 days
  id, camera_id, started_at, duration_ms, status (ok | unchanged | http_error |
  timeout | too_large | bad_content_type | blocked | ssrf_rejected), http_status,
  bytes, sha256, error

camera_import_run        for bulk import
  id, source_id, started_at, dry_run, added, updated, unchanged, removed, errors jsonb
```

`source` already exists in the plan; it grows two fields: `kind`
(`catalogue_api | direct_snapshot | page_scrape | manual`) and `license_url`.

Add to `camera`: `status`, `provider_camera_ref`, `page_url`, `license_*`,
`request_headers`, and the four poll-health columns. Everything else is in the earlier schema.

## State machine

```
            probe ok                first successful poll
  (new) ─────────────► unverified ─────────────────────► active
                            │                              │  ▲
                     save without      pause              │  │ resume
                     a probe           ─────────────────► paused
                            │                              │
                            └──────────► retired ◄─────────┘   (delete or retire)
```

Rules:

- A camera is saved as `unverified` only when the probe succeeded but no frame is stored yet.
  Saving an unprobed camera is not allowed.
- `active` needs one stored frame. The first poll is queued immediately after save, so the gap is
  seconds.
- `paused` keeps frames and history and stops polling. It is the "provider is down, keep it on the
  map" state, and the one a user reaches for when a source breaks.
- `retired` hides the camera from the map and the player, keeps the row for the audit trail, and
  stops polling. Deletion is a separate, explicit action that purges frames too.
- Failure-driven deactivation (`failure_count >= 3`) sets `status = paused` with
  `paused_reason = 'provider_failures'` and does not touch `poll_enabled`, so a working provider
  recovers on its own. A user-triggered pause sets `paused_reason = 'manual'` and only a user
  clears it.

## Screen 1: camera list

Table with thumbnail, title, place, provider, status chip, cadence, last frame age, 24 h poll
success rate. Filters: status, provider, category, country, "needs attention" (unverified, or last
frame older than three cadences). Search on title, city, provider ref. Row actions: edit, pause /
resume, test poll, retire, delete. Bulk actions on the selection: pause, retire, re-probe.

Sort by last frame age is the useful default for an operator: it puts broken cameras first.

## Screen 2: add a camera

Two entry points, one form.

**A. From a source with a listing.** The user picks a source, the server pulls the catalogue and
shows a searchable list of cameras that are not in our database yet (match on
`source_id + provider_camera_ref`). Selecting one fills title, coordinates, provider ref, page URL
and licence, then runs the probe. For Digitraffic, Caltrans and TfL this is the fast path — see
`02-camera-sources.md`.

**B. Paste a URL.** The user pastes an image URL or a camera page URL and presses "Probe".

Probe steps, in order, each reporting its own line in the UI:

1. Parse the URL. Require `https`. Reject userinfo, ports other than 443, and non-default hosts.
2. Resolve DNS and reject private, loopback, link-local and metadata addresses. Repeat the check
   after every redirect. Follow at most two redirects.
3. Fetch with a 10 s timeout and a 10 MB cap, `Accept: image/*`, and a browser user agent.
4. Check status, `content-type`, and the magic bytes (`FF D8 FF` JPEG, `89 50 4E 47` PNG). An HTML
   page that returns 200 is the most common failure and must be named as such.
5. Read the dimensions. Reject anything under 320x180 or over 12000 px on a side.
6. Record `ETag`, `Last-Modified`, `Cache-Control` and `Age`. These decide whether polling can use
   a conditional request.
7. If the input was a page URL, try the discovery rules in `data/url-patterns.json`: `og:image`,
   JSON-LD `image`, `<img>` candidates matching a snapshot pattern, then the vendor probe list.
   Show the candidates found and let the user pick.
8. If the frame is a duplicate of an existing camera (see below), say so before saving.

The probe result panel shows the image, its pixel dimensions, the content type, the final URL after
redirects, the response time, and an interval suggestion. The user confirms title, place and
category, then saves. Saving queues the first poll and lands on the camera detail screen with the
first frame.

**Interval suggestion.** Probe twice, 60 s apart, and compare the ETag, `Last-Modified` and the
content hash:

| Observation | Suggested interval |
| --- | --- |
| bytes changed between the two probes | 60 s |
| ETag or Last-Modified changed, bytes did not | 60 s |
| nothing changed, `Cache-Control: max-age` present | that value, clamped to 600–3600 s |
| nothing changed | 600 s |

Show the suggestion with the observation that produced it ("unchanged after 60 s"), and let the
user override. A cadence below 60 s is refused: no source we verified updates faster.

**Coordinates.** A map picker, not two number fields. Clicking sets lat/lon; the server derives the
timezone from the coordinates and reverse-geocodes country, region and city (Nominatim at 1
request per second, cached by rounded coordinates). Both are editable, because the derived city is
often "next village over". If the camera came from a catalogue, the coordinates are filled and the
picker starts centred on them.

## Screen 3: camera detail

Header: newest frame, status chip, cadence, next poll, last error. Tabs:

- **Overview.** Editable metadata: title, description, categories, place, coordinates, cadence,
  request headers, provider, page URL, licence and attribution text.
- **Frames.** Newest 50 frames as a grid with capture time and size, plus a delete-frame action.
  This is where the deferred pipeline will add variants and derived images.
- **Polls.** The last 200 `poll_attempt` rows with status, duration, bytes and error text, and a
  small chart of success rate and frame age over 24 h. This is the screen that answers "why is this
  camera stuck".
- **Raw.** The provider record we imported, untouched, plus the URLs we call. Useful when a
  provider changes its schema.

Buttons: "Test poll" (one fetch now, outside the schedule, writes a `poll_attempt` row),
"Pause", "Retire", "Delete".

## Duplicate detection

Run before every save and every import row:

1. Same normalised URL (lowercase host, no query, no trailing slash) in `camera_image_source`.
2. Same `source_id + provider_camera_ref`.
3. Same host and path with a different scheme or query string.
4. Coordinates within 50 m and a similar title (case-insensitive, tokens compared).
5. Same image bytes (sha256) as the newest frame of another camera — catches one provider serving
   the same view under two names.

Cases 1 to 3 block the save. Case 4 warns. Case 5 warns and is shown as a link to the other camera.

## Bulk import

`POST /admin/cameras/import` with `{ sourceId, dryRun }`, or an upload of JSON/CSV with the
schema of `data/sources.json`.

A dry run writes nothing and returns the diff: `added`, `updated` (title, coordinates or URL
changed at the provider), `unchanged`, `removed` (provider no longer lists it), and `errors`. The
UI shows the diff as four counts with a preview list before the user confirms. Import never
deletes on its own: removed cameras become `paused` with `paused_reason = 'missing_from_source'`
and the operator decides.

Every import writes a `camera_import_run` row, so "what changed last night" is answerable.

## Failure messages the UI must name exactly

| Condition | Message |
| --- | --- |
| `http_status` 401/403 | "The provider refused the request. Add a header or a token, or check that the URL is still public." |
| 404 | "Nothing at this URL. The provider may have moved the camera." |
| 200 with `text/html` | "This URL returns a web page, not an image. Paste the image URL or let the probe search the page." |
| timeout | "The provider did not answer within 10 s." |
| body over 10 MB | "The response is larger than 10 MB. Use a smaller image URL." |
| private address | "This URL points inside a private network and is blocked." |
| dimensions out of range | "The image is 120x67 px. A camera needs at least 320x180 px." |
| unchanged twice and no cache header | warning only, with the 600 s default |

## API surface for the admin screens

```
POST   /admin/cameras/probe             { url }                    -> probe report
POST   /admin/cameras                  { ...camera }              -> camera, queued first poll
PATCH  /admin/cameras/{id}             { ...changes }
POST   /admin/cameras/{id}/test-poll                              -> poll attempt
POST   /admin/cameras/{id}/pause | /resume | /retire
DELETE /admin/cameras/{id}?purgeFrames=true
GET    /admin/cameras?status=&sourceId=&q=&sort=lastFrameAge
GET    /admin/cameras/{id}/polls?limit=
POST   /admin/cameras/import           { sourceId, dryRun }
GET    /admin/sources                  -> sources with catalogue sizes
```

Every write records the acting user and the previous values; the poll log and the import runs are
the audit trail for the rest.

## Decisions to keep

- A camera cannot be saved without a successful probe. This removes the whole class of "saved a
  page URL, nothing happened" bugs.
- The first poll is queued at save, not at the next tick, so the detail screen shows a real frame.
- Cadence is per camera and never inferred again after save.
- Pause and failure-driven deactivation are the same visible state with different reasons, so the
  recovery behaviour stays automatic.
- Frames are deleted with the camera only when the user asks for it. Retirement keeps history.

## Out of scope here

Accounts and sign-up beyond one admin, a review queue for third-party submissions, image variants
and thumbnails (deferred pipeline), and the public embed widget.
