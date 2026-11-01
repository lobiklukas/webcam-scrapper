# 02 — Public camera sources we can actually use

Every source below was requested with `curl` on 2026-11-01. Numbers are from those responses, not
from documentation. Raw evidence: [`data/probe-log.tsv`](data/probe-log.tsv). Machine-readable
copy: [`data/sources.json`](data/sources.json).

Summary:

| Source | Region | Camera views | Listing | Auth | Licence |
| --- | --- | --- | --- | --- | --- |
| Fintraffic Digitraffic weather cameras | Finland | 2 273 presets on 814 stations | GeoJSON | none (gzip required) | CC BY 4.0 |
| Caltrans CWWP2 CCTV | California | 3 610 in 12 districts | JSON / CSV / XML / TXT per district | none | free, fair use |
| TfL JamCams | London | 890 | JSON | none | TfL open data, credit required |
| foto-webcam.eu | AT / DE / CH / IT | 309 | HTML index page | none | embedding allowed with a link back |
| PANOMAX | worldwide, alpine | per-camera, no list | JSON per camera | none | per camera, check watermark |

## 1. Fintraffic Digitraffic weather cameras (Finland)

The best source for a demo: open licence, documented API, one request gives every camera.

Listing:

```
GET https://tie.digitraffic.fi/api/weathercam/v1/stations
    Digitraffic-User: <app-name>
    Accept-Encoding: gzip
```

Returns a GeoJSON `FeatureCollection`: 814 stations, 2 273 presets in collection. A station is a
roadside mast; a preset is one camera view on it and has the image. Coordinates are
`geometry.coordinates = [lon, lat, 0]`.

```
properties.id              "C01503"
properties.name            "kt51_Inkoo"
properties.collectionStatus "GATHERING"
properties.presets[]       { id: "C0150301", inCollection: true }
```

Images:

```
https://weathercam.digitraffic.fi/{presetId}.jpg
```

Verified: `C0150201.jpg` → `200 image/jpeg 9 897 B`, `C0150301.jpg` → `200 image/jpeg 316 866 B`.
No headers needed on the image host.

Gotchas:

- Without `Accept-Encoding: gzip` the JSON API answers `406 Not Acceptable` with the body
  `Use of gzip compression is required with Accept-Encoding: gzip header.` This is the most
  likely reason a first attempt fails.
- Station id and preset id are different. `/stations/C01502` returns 404 even though `C01503`
  exists; ids come from the listing, never from a guess.
- `Digitraffic-User` is requested by their instructions. The request also succeeded without it,
  so treat it as required by policy, not by the server.
- Cadence: 10 minutes.

Licence: CC BY 4.0. Attribution "Fintraffic / Digitraffic" plus a link to the licence. Commercial
use is allowed.

## 2. Caltrans CWWP2 CCTV (California)

Largest verified source: 3 610 cameras in 12 districts, each with coordinates, a static image, the
five previous images, and for many a live HLS stream.

Listing, one file per district:

```
https://cwwp2.dot.ca.gov/data/d{n}/cctv/cctvStatusD{NN}.json      # NN is zero padded
```

`cctvStatusD04.json` works, `cctvStatusD4.json` answers 500. Same data as CSV, XML and TXT,
documented field by field.

Verified per district:

| District | Cameras | with HLS | not in service |
| --- | --- | --- | --- |
| 1 | 149 | 15 | 4 |
| 2 | 91 | 0 | 4 |
| 3 | 274 | 269 | 4 |
| 4 | 769 | 196 | 3 |
| 5 | 181 | 181 | 3 |
| 6 | 128 | 123 | 1 |
| 7 | 592 | 478 | 105 |
| 8 | 505 | 405 | 4 |
| 9 | 23 | 0 | 2 |
| 10 | 154 | 151 | 3 |
| 11 | 324 | 235 | 0 |
| 12 | 420 | 254 | 45 |
| **total** | **3 610** | **2 307** | **178** |

Camera record, from `data[].cctv`:

```
index, recordTimestamp { recordDate, recordTime, recordEpoch },
location { district, locationName, nearbyPlace, longitude, latitude, elevation,
           direction, county, route, postmile },
inService: "true" | "false",                       // strings, not booleans
imageData {
  streamingVideoURL: "https://wzmedia.dot.ca.gov/D3/...stream/playlist.m3u8",
  static {
    currentImageUpdateFrequency: "1",              // minutes
    currentImageURL:          "https://cwwp2.dot.ca.gov/data/d3/cctv/image/hwy5atpocket/hwy5atpocket.jpg",
    referenceImage1UpdateAgoURL: ".../previous/hwy5atpocket-1.jpg",   // 1..5
    ...
  }
}
```

Verified: current image `200 image/jpeg 11 233 B`, previous image `200 image/jpeg 12 828 B`,
HLS master `200 application/vnd.apple.mpegurl 138 B` with one variant playlist inside (640x480).

Gotchas:

- The district JSON is big: 0.8 MB for D3, 2.5 MB for D4, and D4 took 9 s. Fetch it on a schedule
  and cache it; never per user request.
- `inService` and the coordinates are strings.
- Some cameras are logically dead but still listed (178 not in service). Filter on `inService`.
- Image URL contains a folder name derived from the location name, so it cannot be built from the
  camera index alone. Always read `currentImageURL`.
- Fair use policy: "Usage that risks degrading the availability of the CCTV streaming service is
  prohibited", plus the general Caltrans conditions of use. Poll at the stated 1-minute cadence at
  most, and not all 3 610 cameras.

## 3. TfL JamCams (London)

```
GET https://api.tfl.gov.uk/Place/Type/JamCam
```

890 entries, `70 950 B` compressed, no key. Fields live in `additionalProperties[]`:

```
id: "JamCams_00002.00865", commonName: "A406 Billet Upass E",
lat, lon,
additionalProperties: [
  { key: "imageUrl", value: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.00865.jpg" },
  { key: "videoUrl", value: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.00865.mp4" },
  { key: "available", value: "true" },
  { key: "cameraView", value: "West" }
]
```

831 of 890 are `available=true`. All 890 carry a `videoUrl`. Verified: image
`200 image/jpeg 13 984 B`, video `200 video/mp4 103 775 B` (a short clip, not a stream).

Gotchas:

- The shape is verbose TfL style: every value is a string inside a list of property objects.
- Images are on S3, not on the API host, so the URL allowlist must include the bucket host.
- No documented cadence; the images change roughly every minute. Poll at 1 to 5 minutes.
- Credit: TfL asks for "Powered by TfL Open Data". Check the current terms at
  https://api-portal.tfl.gov.uk/terms before publishing anything.

## 4. foto-webcam.eu (Austria, Germany, Switzerland, Italy)

309 cameras, listed on one page: `https://www.foto-webcam.eu/`, each link shaped
`/webcam/<name>/current/400.jpg`.

Image pattern:

```
https://www.foto-webcam.eu/webcam/{name}/current/{size}.jpg
sizes: 150, 180, 240, 320, 400, 640, 720, 1200
```

Verified on `hochgrat`: 400 → 47 815 B, 720 → 138 048 B, 1200 → 271 956 B, all `image/jpeg`.
An unknown name returns `404 text/html` with a page, so validate the content type, not only the
status.

Gotchas:

- The filename is constant per camera, which is convenient, but it also means an HTTP cache can
  serve a stale frame. Send `Cache-Control: no-cache` and compare bytes.
- Their info page allows live embedding only if a click on the image opens the source page. Carry
  the camera page URL as the credit link.
- Bulk archive download needs a login, so history has to be collected by our own poller.
- `robots.txt` disallows `/webcam/` for Googlebot-Image and a list of SEO crawlers; other agents
  are not disallowed. Keep to one request per 10 minutes per camera.
- Cadence: about 10 minutes.

## 5. PANOMAX (alpine panoramas)

Per-camera day listing:

```
GET https://api.panomax.com/1.0/cams/{camId}/images/day
```

`200 application/json 4 991 B`. Contains `sizes[]` (thumb, reduced, default, hd, full, original,
h572, optimized, small with `rows`/`cols`) and `images[]` with a slot every 10 minutes
(`06:30:00`, `06:40:00`, ...) and an `available` flag.

Gotchas:

- There is no public list endpoint: `/1.0/cams` and `/1.0/panoramas` return 404 HTML. Camera ids
  come from the map on panomax.com.
- Images are tiled panoramas: `original` for one camera is 17 951 x 2 048 split into 8 tiles.
  Storing them as one flat frame needs stitching. Use a non-panorama camera, or store the
  panorama and render it as a panorama.
- Images carry a PANOMAX watermark and often a brand logo. Check the terms per camera.
- `api.panomax.com/robots.txt` is `Allow: /`.

## 6. Windy itself: design reference, not a data source

`https://api.windy.com/webcams/api/v3/webcams` without a key answers
`403 {"message":"Missing Header 'x-windy-api-key' with API key"}`.

The images, however, are open: `https://imgproxy.windy.com/_/normal/plain/current/1746057271/original.jpg?v=2`
answers `200 image/jpeg 96 650 B` with no token and no referer. The API terms forbid using images
other than through the API URLs, so we do not scrape Windy. Windy is the model for our read API
and player (see `01-windy-teardown.md`), the open sources above are the data.

## Loaded but not usable

| Source | Result | Note |
| --- | --- | --- |
| `webcams.nyctmc.org/api/cameras` | no response in 25 s | NYC traffic cams; unusable from here, may work from another network |
| `511on.ca/api/v2/get/cameras` | `400` | Ontario 511 needs an API key |
| `www.webcams.travel/api/v3/list` | `200 text/html` | the API is gone, the site merged into Windy |
| `images.drivebc.ca/bchighwaycam/pub/cameras/1.jpg` | connection failed | DriveBC; needs a different host or key |
| feratel, Roundshot | no stable public image URL | per-camera URLs, must be discovered from the camera page |
| Insecam-style directories | not used | cameras published without the owner's consent |

## Adding a camera to the database in five minutes

1. Prefer a source with a listing (Digitraffic, Caltrans, TfL) — the import fills coordinates,
   title, provider and cadence without a user typing anything.
2. Otherwise take a single camera: paste the image URL or the camera page URL into the admin form.
   The probe in `03-camera-management.md` decides whether it is a real image and how often it
   changes.
3. Record provider name, provider page URL and licence, because the credit line is a licence
   condition, not decoration.
4. Start the poller at one request per 10 minutes per camera and raise it only after watching the
   bytes change.
