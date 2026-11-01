# Windy clone: research

Research for a clone of the webcam part of Windy, with a management UI for the cameras.
Collected on 2026-11-01. Everything that could be tested was tested with `curl` against the live
endpoint; the raw output is in [`data/probe-log.tsv`](data/probe-log.tsv).

## Documents

| File | Read when |
| --- | --- |
| [`01-windy-teardown.md`](01-windy-teardown.md) | you need to know what Windy's webcam feature does, what its API returns, and how its player works |
| [`02-camera-sources.md`](02-camera-sources.md) | you need a camera to put in the database, or you are deciding which provider to ingest |
| [`03-camera-management.md`](03-camera-management.md) | you build the admin screens where a user adds and maintains a camera |
| [`04-ingestion-strategy.md`](04-ingestion-strategy.md) | you build the poller, adapters, dedupe, retention or the deferred image pipeline |
| [`data/sources.json`](data/sources.json) | machine-readable registry of the verified sources |
| [`data/url-patterns.json`](data/url-patterns.json) | URL templates to try when a user pastes a camera URL or a camera page |
| [`data/probe-log.tsv`](data/probe-log.tsv) | you want the evidence: status, content type, bytes, seconds per URL |

## Short version

- Windy's webcam feature is a map of still cameras plus a slideshow player over four history
  windows. No video encoding is involved. Its API exposes the same model and is the best
  blueprint for our read API.
- Three public sources can be used today without a key and with a permissive licence, and they
  together hold well over 6 000 camera views:

  | Source | Camera views | Licence | Listing |
  | --- | --- | --- | --- |
  | Digitraffic, Finland | 2 273 presets on 814 stations | CC BY 4.0 | GeoJSON |
  | Caltrans CWWP2, California | 3 610 in 12 districts | Free, fair use | JSON, CSV, XML, TXT per district |
  | TfL JamCams, London | 890 | Open Government Licence | JSON |

  Smaller but useful: foto-webcam.eu (309 cameras, embed allowed with a link back) and PANOMAX
  (per-camera JSON, tiled panorama images).

- Windy's own images can be fetched from `imgproxy.windy.com` without a token, but the Webcams
  API terms forbid using images any other way than through the API URLs, so we do not scrape
  Windy. We use Windy as the design reference and the public sources above as the data.
- The management UI needs more than a form: a probe that validates a URL before it is saved, a
  map picker for coordinates, duplicate detection, a state machine
  (`unverified → active → paused → retired`), a test-poll button, and a per-camera poll log.
  Details in `03-camera-management.md`.

## How to re-run the probes

```bash
cd research/data
curl -sS -L --compressed -A "Mozilla/5.0" -o /dev/null \
  -w "%{http_code} %{content_type} %{size_download}\n" \
  https://weathercam.digitraffic.fi/C0150201.jpg
```

`--compressed` matters: Digitraffic answers `406 Not Acceptable` without
`Accept-Encoding: gzip`. Nothing else in the verified set needs special headers.

## What this research does not cover

- Windy's forecast APIs, map rendering and mobile apps. Only the webcam part.
- Authentication and accounts for the clone. The management UI assumes a single admin or a
  simple role check.
- The image processing pipeline beyond storage and resize. It is listed as deferred work in
  `04-ingestion-strategy.md`.
