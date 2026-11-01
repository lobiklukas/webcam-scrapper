# 01 — Windy's webcam feature, as a blueprint

Sources: Windy Webcams API v3 docs, the v2→v3 migration guide, the pricing and terms pages, the
public embed player HTML, and Windy community posts. Links at the end.

## What the product does

Windy Webcams is a map of fixed cameras with still images. One camera has one current image and a
history of earlier images. Nothing is streamed except for the cameras that send a live stream of
their own.

Parts a user sees:

- **Map layer.** Camera markers over the weather map. At low zoom the markers merge into clusters
  with a count; a selected marker shows a thumbnail preview.
- **List panel.** Cameras inside the viewport with thumbnail, distance and last update time,
  filtered by category and country.
- **Camera page.** One camera: player, location, categories, last update time, view count, the
  provider link.
- **Player.** A slideshow of still frames with a progress bar, play/pause, a time label, and four
  history windows: 24 hours, 30 days, 12 months, lifetime. Some cameras add a live tab.
- **Favourites and search.** Favourites, and search by place name, category or keyword.
- **Submission.** Owners submit a snapshot URL; Windy tests the URL, then reviews the camera by
  hand.

## The public API

Base `https://api.windy.com/webcams/api/v3`, header `X-WINDY-API-KEY`. Without the header:
`403 {"message":"Missing Header 'x-windy-api-key' with API key"}` (verified 2026-11-01).

| Endpoint | Purpose |
| --- | --- |
| `GET /webcams` | list and filter, returns `{ total, webcams[] }` |
| `GET /webcams/{webcamId}` | one camera |
| `GET /map/clusters` | cameras and clusters for a bbox at a zoom level |
| `GET /categories`, `/countries`, `/regions`, `/continents` | dictionaries |

Filters: `categories` (max 10, `categoryOperation=and|or`), `countries` (max 10), `regions`
(max 10), `continents` (max 2), `bbox=northLat,eastLon,southLat,westLon`,
`nearby=lat,lon,radiusKm` (max 250 km), `webcamIds` (max 50), `lang`.

Paging and sorting: `limit` default 10 max 50, `offset` capped at 1 000 (free) or 10 000 (pro),
`sortKey=popularity|createdOn`, `sortDirection=asc|desc`.

Result parts are chosen per request: `include=categories,images,location,player,urls`. A list
request should not pay for parts it does not render.

Camera object:

```
webcamId, status("active"|"inactive"), title, viewCount, lastUpdatedOn, clusterSize,
categories[] { id, name },
images { current { icon, thumbnail, preview, normal, full, panorama },
         daylight { ...same sizes... },
         sizes { <size>: { width, height } } },
location { city, region, region_code, country, country_code, continent, continent_code,
           latitude, longitude },
player { live, day, month, year, lifetime },     // embed URLs, one per window
urls { detail, edit }
```

`images.daylight` is the same view in daylight, used at night. `player.live` exists only for
cameras with a stream. `clusterSize` is filled by the cluster endpoint only.

The cluster endpoint validates the span against the zoom: at zoom 4 the latitude span is at most
22.5° and the longitude span at most 45°, and each lower zoom level halves that.

## Image delivery

```
https://imgproxy.windy.com/_/normal/plain/day/1746057271/original/1793536666.jpg
https://imgproxy.windy.com/_/normal/plain/current/1746057271/original.jpg?v=2
```

Segments: size, mode (`plain`), window (`current|day|month|year|lifetime`), camera id, source
(`original`), and for history frames the Unix timestamp of the frame. Size names: `teaserbg`,
`icon`, `thumbnail`, `preview`, `normal`, `full`, `panorama`.

API image URLs carry a token that expires after 10 minutes (free tier) or 24 hours (pro). An
expired URL returns 401, so a client must re-request the camera on each page load.

Verified: `https://imgproxy.windy.com/_/normal/plain/current/1746057271/original.jpg?v=2` answers
`200 image/jpeg 96 650 B` with no token and no referer. The images are technically open, and the
terms forbid using them outside the API. This is why we take the design from Windy and the data
from open sources.

Terms, free tier: link images to windy.com or the embed player, keep a courtesy mention, never
stretch an image, image URL lifetime 15 minutes, offset cap 1 000, reduced image sizes.
Pro tier: 9 990 EUR per year, full-size images, 24-hour URLs, offset cap 10 000, one daily export
of all cameras.

## Player internals

The embed player is server-rendered HTML with an inline object:

```
playerType: 'day' | 'month' | 'year' | 'lifetime'
times: ['Sat 14:37', 'Sat 15:38', ...]                    // label per frame
slides: { preview: [...], normal: [...], full: [...] }    // one URL per frame
imageExpireTimestamp: 1793540643445
speed: 1.25, pause: 0.25, loop: false
```

The server picks the frames for the requested window; the client crossfades preloaded images and
moves the progress bar. A lifetime player for a camera with one image per month returned 15
frames, so a long window is a short list.

Embed URL:
`https://webcams.windy.com/webcams/public/embed/player?playerType=day&webcamId=<id>&loop=false&interactive=true`.
The page also renders `Source: <provider URL>`, a feedback link and a link to windy.com.

## Ingestion model, inferred

- One image per camera per interval. 10 minutes is the standard; 15, 30 and 60 minutes exist for
  older cameras.
- Images come from camera owners, providers (feratel, Angelcam and others), and YouTube live
  streams.
- Each image is kept at several sizes and thinned over time: full interval for recent frames,
  then hourly, then daily, then monthly.
- A camera with repeated failures is marked inactive and keeps its last image.
- Manual review checks that the snapshot URL answers reliably and that the image shows weather.

## What we copy, and what we do differently

Copy: the camera object with selectable includes, the cluster endpoint keyed by bbox and zoom,
the four player windows, expiring image URLs, the credit line, and the inactive-with-last-frame
state.

Differ: our data comes from open sources, so attribution is a licence requirement and not only
courtesy. We keep the admin flow in the product (the user adds a camera through the UI) instead of
a submission form plus a manual review queue, and we defer video encoding.

## Links

- https://api.windy.com/webcams/docs
- https://api.windy.com/webcams/version-transfer
- https://api.windy.com/webcams/pricing
- https://api.windy.com/webcams/terms
- https://community.windy.com/topic/10432/about-windy-webcams
- https://community.windy.com/topic/10423/how-to-add-a-new-webcam
- https://community.windy.com/topic/42608/windy-webcams-updates-changes-and-quality-of-life-improvements
