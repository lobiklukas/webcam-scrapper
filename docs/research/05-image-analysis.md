# 05 — Image analysis: what is worth computing on a stored frame

Companion to `04-ingestion-strategy.md` (which stops at "the bytes are in the bucket"), to
`../architecture.md` §6 (the processing seam) and §10 (the volume numbers). The question here is not
what is *possible* on a 640×480 JPEG but what is worth a CPU-second and a maintenance burden.

Constraints that shape every answer below:

- The analysis service is `apps/image-processor`: Python + FastAPI, **no DB, no Redis**, object
  storage only. One request carries a storage key plus a step list; the answer is one
  `{type, data, confidence, model}` per step. Anything needing history (baselines, series, trending)
  has to be handed in by the Nest orchestrator or stored as its own derived object — the service
  cannot keep state.
- The model stack (`architecture.md` TBD #3, YOLO/AGPL vs ONNX) and CPU-vs-GPU (TBD #4) are **open**.
  Every cost below is therefore CPU, with a note where a GPU changes the conclusion.
- Worst case volume is **500 cameras at 60 s = 720 000 frames/day = 8.3 frames/s**. That single
  division decides most of this document.
- Sources burn timestamps, logos and watermarks into the pixels (`02-camera-sources.md`: PANOMAX
  watermark, foto-webcam link-back, Digitraffic clock in the frame), and many cams go black or
  switch to IR at night. Overlay and night are treated as first-class in every section.

## How to read the cost numbers

Reference frame: 640×480 for Caltrans (HLS variant verified 640×480). Digitraffic presets arrive at
9.8 KB and 317 KB per JPEG in the probe log; JPEG width was **not** measured there, and byte size is
only a proxy for resolution, so treat "640–1024 px wide" as an unverified working assumption to
confirm in the first integration.

Fleet arithmetic, worth memorising because it kills most ideas:

| Step cost per frame | Cores busy at 8.3 frames/s |
| --- | --- |
| 1 ms | 0.008 |
| 10 ms | 0.08 |
| 56 ms | 0.47 |
| 100 ms | 0.83 |
| 500 ms | 4.2 |
| 1 s | 8.3 |

So: **anything above ~50 ms per frame is sampled, anything above ~500 ms is sampled hard or
event-gated.** Sampling table for 720 000 frames/day:

| Rate | Frames/day | Frames/s | Cores for a 100 ms step | Cores for a 1 s step |
| --- | --- | --- | --- | --- |
| every frame | 720 000 | 8.3 | 0.83 | 8.3 |
| 1 in 5 | 144 000 | 1.7 | 0.17 | 1.7 |
| 1 in 10 | 72 000 | 0.83 | 0.08 | 0.83 |
| 1 in 100 | 7 200 | 0.08 | 0.008 | 0.08 |
| 1 in 1000 | 720 | 0.008 | — | 0.008 |

**Nothing in this document was measured inside this repo.** `[bench]` marks a number taken from a
cited benchmark (hardware and input size named), `[est]` marks arithmetic from the operation count.
`[est]` numbers exist so the first integration can falsify them, not because they are trustworthy.

## 1. Per-frame quality and health (deterministic, no model)

The cheapest useful category, and the only one that can run on **every** frame at ~10 ms total. It
produces `quality` and `frame_flags` results, and it is what gates everything else.

| Signal | How | Cost | Fails how |
| --- | --- | --- | --- |
| Decodes at all | Pillow/`cv2.imdecode`, tolerate truncated JPEG | <1 ms [est] | Truncated-but-decodable JPEG gives a grey lower half; decode success is not validity |
| Placeholder / test card | Byte hash against a per-source library of known placeholders; else zero-variance + palette test | <1 ms | A real night frame is also near-uniform |
| Black / night | Mean luma on the lower 2/3, plus chroma | <1 ms | **IR night frames are bright and monochrome**, so "dark" misses them; detect monochrome (`mean abs(R−G)+|G−B|` near 0) as well as darkness |
| Exposure / clipping | Fraction of pixels at 0 and at 255, per channel | <1 ms | Sun in frame blows a corner legitimately; snow on the ground clips the bottom |
| Contrast | p95 − p5 luma | <1 ms | Fog and a clean empty road both give low contrast |
| Letterbox / bars | Rows/cols with near-zero variance → crop box | 1–2 ms | PANOMAX tiles have seams, not bars |
| Colour cast | Per-channel mean of a fixed patch vs 30-day baseline | <1 ms | Sunset and snow legitimately cast everything orange or blue; only the *delta from its own baseline* means anything |
| Blur / focus | Variance of the Laplacian, `cv2.Laplacian(gray, CV_64F).var()` | ~2 ms at 640×480 [est] | See below — this is the trap |
| Lens obstruction / dirt / cobweb | Gradient energy in a fixed near-field ROI vs baseline; "static high-frequency patch" detector | ~3 ms | A cobweb looks like texture, i.e. like sharpness |
| JPEG artefact level | Blockiness: mean absolute difference across 8-px boundaries minus within-block; PIQE also returns separate `artifactsMask` and `noiseMask` (MATLAB `piqe` docs) | <5 ms [est] | Strong edges land on block boundaries by chance; text overlays create fake blockiness |

**Laplacian variance is a focus measure only relative to its own baseline.** Pertuz et al. review the
focus-measure families (gradient, Laplacian, wavelet, statistics, DCT) and show performance depends on
image content and noise rather than one operator winning
([Pattern Recognition 46(5), 2013](https://doi.org/10.1016/j.patcog.2012.11.011)). On webcam frames:
a foggy motorway, an empty snow field and a genuinely defocused camera all produce low variance;
sensor noise at night *raises* it and makes a soft night frame look sharp. The usable form is a ratio
to the same camera's rolling median at the same hour, computed over a near-field ROI, never an
absolute threshold. Researcher inference, but the mechanism follows from the operator definition:
variance of a second derivative is dominated by the highest-frequency content present, and at night
that is noise.

### No-reference IQA: cheap to call, weak to trust

BRISQUE ([IEEE TIP 21(12), 2012](https://doi.org/10.1109/TIP.2012.2214050)), NIQE
([IEEE SPL 20(3), 2013](https://doi.org/10.1109/LSP.2012.2227726)) and PIQE
([NCC 2015](https://doi.org/10.1109/NCC.2015.7084843)) are the three picks. Costs and correlations
from the IQA-PyTorch benchmark (single 1080×800 input, one Xeon 6150 core) `[bench]`:

| Metric | CPU per image | SROCC KonIQ-10k | SROCC LIVE-C | SROCC TID2013 | SROCC SPAQ |
| --- | --- | --- | --- | --- | --- |
| PIQE | 0.080 s | not reported | not reported | not reported | not reported |
| BRISQUE | 0.118 s | 0.23 | 0.31 | 0.37 | 0.53 |
| NIQE | 0.211 s | 0.38 | 0.45 | 0.31 | 0.69 |
| TOPIQ-NR (for scale) | 1.116 s | 0.93 | 0.81 | 0.45 | 0.87 |

Source: [`NR_benchmark_results.csv`](https://github.com/chaofengc/IQA-PyTorch/blob/main/tests/NR_benchmark_results.csv)
and [`Efficiency_benchmark.csv`](https://github.com/chaofengc/IQA-PyTorch/blob/main/tests/Efficiency_benchmark.csv).

Read the BRISQUE row carefully: the metric everybody reaches for first gets SROCC 0.23 on KonIQ-10k
at 0.118 s per frame, and the metric that does correlate (0.93) costs 1.1 s. For our use — "is this a
bad frame?" — neither is a decision rule, and at these costs none of them can run at fleet scale.
**Two additional traps:**

- IQA-PyTorch is now licensed **PolyForm Noncommercial 1.0.0** plus NTU S-Lab for some components
  ([README](https://github.com/chaofengc/IQA-PyTorch#license)). It is a research toolbox, not a
  dependency for a product.
- These metrics are trained on human opinion scores of *photographs*. A burned-in timestamp, a
  watermark and 1–2 px of motion blur from a dirty dome are all "distortions" they score confidently
  and meaninglessly.

Verdict: implement the four deterministic signals we actually act on (clipping, contrast, blockiness,
Laplacian ratio) in ~30 lines of OpenCV; skip NR-IQA scores as a stored product metric.

## 2. Duplicate and frozen detection

Four tiers, in increasing cost and decreasing robustness-to-overlay:

| Method | What it detects | Cost | Overlay behaviour |
| --- | --- | --- | --- |
| SHA-256 of bytes (already specified in `04`) | provider served the same file | free (on ingest) | over-sensitive: a new clock = new hash |
| aHash / dHash / pHash (8×8, `imagehash` or OpenCV `img_hash`) | near-identical scene | ~1–2 ms [est] | **the threshold problem below** |
| Masked absolute difference (mean abs diff on 320×240 grey, overlay pixels excluded) | how much changed, where | ~2 ms [est] | clean if the mask is right |
| SSIM | slow, gradual change (dawn, fog) | 0.51 s [bench, torch at 1080×800]; 5–15 ms [est, 320×240 grey numpy] | contaminated by overlay unless masked |

Algorithm references: `imagehash` implements average, perceptual (DCT), difference, wavelet, HSV and
crop-resistant hashes with Hamming distance and configurable hash size
([README](https://github.com/JohannesBuchner/imagehash)). SSIM is Wang et al., *Image quality
assessment: from error visibility to structural similarity*
([IEEE TIP 13(4), 2004](https://ieeexplore.ieee.org/document/1284395)). For streams, FFmpeg's
`freezedetect` is the same idea done well: it compares the mean absolute difference of frame
components against a noise floor, default **−60 dB (0.001) over 2 s**, and emits
`lavfi.freezedetect.freeze_start|freeze_duration|freeze_end` metadata
([ffmpeg-filters docs](https://ffmpeg.org/ffmpeg-filters.html#freezedetect)). Copy its parameter
shape (`noise`, `duration`) rather than inventing new ones.

### Why a burned-in clock breaks perceptual hashing

Researcher inference, stated because it drives a design decision: dHash compares adjacent pixels in a
9×8 downscaled image, pHash keeps the low-frequency 8×8 DCT block. A timestamp in a corner changes a
handful of those 64 cells, so "same scene, new second" lands at a small but non-zero Hamming distance.
The failure is **not** confusion with a genuinely different scene (that is far away in Hamming space):
it is that the threshold must be raised above the clock noise, and the band you must then ignore is
exactly where dawn breaking, fog forming and snow starting live. The camera reads "frozen" for hours
while the sky changes.

The fix is one line of preprocessing, not a better hash: **compute the overlay mask once per camera
(see §8), zero those pixels, then hash the rest at a distance threshold of 0–2 bits**, and treat
"0–2 bits" as frozen, "3–12" as `changed_mild` (report the abs-diff), ">12" as `changed`.

Unverified: no public benchmark measures Hamming distance under burned-in-overlay change. The
measurement to run instead is cheap — 200 consecutive frames of one Digitraffic camera, Hamming to
the previous frame with and without masking — and its histogram is the threshold.

Sampling: **every frame** (~2 ms). It is also what feeds "is this camera alive" and the dedupe flag in
`04-ingestion-strategy.md`.

## 3. Deterministic scene facts

| Signal | Method | Cost | Failure mode |
| --- | --- | --- | --- |
| Motion / activity | abs diff of 320×240 grey, per-block median subtraction to remove global luma shifts, threshold = k×p99 of the camera's own last 24 h | 2–5 ms [est] | PTZ and panorama cams (PANOMAX) change the whole frame; auto-exposure steps and the dusk IR switch move every pixel; sun/shadow sweep across an alpine scene is real diurnal signal, not activity; an empty car park at night is legitimately static |
| Changed regions | connected components on the same mask → 1–5 boxes | +2 ms [est] | Shadows and cloud shadows create large phantom boxes |
| Sky-region statistics | per-camera sky mask (computed once), then mean luma, saturation, std, Laplacian energy, fraction of near-white pixels | 3–5 ms [est] | Sun in frame blooms the sensor; a night sky is black and low-texture, i.e. indistinguishable from a covered lens by these statistics alone |
| Day / night | solar elevation from lat/lon/time; NOAA uses zenith 90.833° at sunrise/sunset for refraction + solar disc ([NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)) | <0.1 ms | The camera's own clock/timezone is what is wrong, not the astronomy: use the provider timestamp where `04` says it exists |
| Golden hour / twilight | elevation bands: −6° civil twilight, ≈ −4°…+6° golden hour (a photographic convention, **unverified** as a standard) | <0.1 ms | Cloud cover decides whether it is visible at all |
| Snow on ground | high luma + low saturation in the *ground* ROI, sustained | ~2 ms [est] | Fresh snow and an overcast white sky look the same in the sky ROI; needs per-camera calibration |
| Visibility / fog | low gradient energy + high luma + low saturation in the sky ROI | ~2 ms [est] | Bright overcast is fog's twin; heavy rain dims and blurs differently per camera |

The highest value-per-line-of-code item in this whole document is the **day/night signal from solar
geometry**: it needs no pixels at all, it still works when the frame is black or missing, and it
decides which render variant the UI shows, whether a black frame is an outage, and how the sampler
thins the night.

Deterministic sky statistics are the right *inputs*; they are not a classifier. Snow/visibility as
thresholds is the weakest deterministic item here and should be dropped in favour of §4 as soon as the
sky mask exists.

## 4. Scene classification (the one users would actually notice)

Whole-frame vs sky-ROI is a real choice, not a detail:

- **Whole frame** is what the published results below did. It sees rain on the lens, wet roads, snow
  on the ground, and it needs no mask.
- **Sky ROI** removes most confounders (cars, lights, buildings) and makes cloud/fog far easier; it is
  blind to ground snow. A 320×240 sky crop is ~1/4 of the pixels, so this is also the cheap option.

Two numbers worth having, both on real camera imagery rather than curated photo datasets:

| System | Setting | Accuracy |
| --- | --- | --- |
| Small CNN (2 conv layers) on 102 452 labelled frames of one Belgian webcam, 5 classes | clear / dawn-dusk / fog / night / reduced visibility | 93.1% overall; recall clear 98.0%, fog 92.3%, night 99.2%, **dawn-dusk 54.9%**, reduced visibility 70.6% ([RMI webcam fog detection](https://www.meteo.be/uploads/media/63ff730c19070/fogdetectionwithml.pdf)) |
| EVA-02 + CLIP, Iowa DOT traffic cameras | no-precip / rain / snow, plus day/night | 96.55% overall, **97.21% day vs 63.40% night**; CycleGAN night augmentation lifts night to 82.45%, SigLIP-2 + CycleGAN to 85.90% ([ClearVision, arXiv:2504.19684](https://arxiv.org/abs/2504.19684)) |

Those two rows are the honest summary of this section: **the classes are easy in daylight and the
transition classes are hard.** Dawn/dusk and "reduced visibility" are where a webcam classifier falls
apart, and night costs ~34 points unless you normalise the domain or train on night frames. A plan
that ignores night is a plan for a daylight-only product.

Options and licences:

| Option | Licence | Cost | Data need | Honest assessment |
| --- | --- | --- | --- | --- |
| Zero-shot CLIP / SigLIP with a label set ("a clear sky", "heavy fog", "snow falling"…) | CLIP MIT ([LICENSE](https://github.com/openai/CLIP/blob/main/LICENSE)), SigLIP Apache-2.0 ([model card](https://huggingface.co/google/siglip-base-patch16-224)) | CLIP-RN50-class forward ~1.0 s/frame CPU at 1080×800 [bench, pyiqa `clipiqa` incl. prompt work]; ViT-B/32 at 224 px ~40–100 ms [est] | zero labels | **Unverified on webcam weather imagery** — no clean public benchmark found. Prompt-set sensitivity and the "no class fits" problem (a wet night road is neither rain nor clear) are the known failure modes. Measure on 300 hand-labelled frames before believing anything |
| Embedding + small trained head (logistic regression / MLP on the 512–768-d embedding) | same, head is yours | head ≈ 0 ms; encoder as above | 1–3 k labelled frames | Best ratio of accuracy to effort. Keeps the encoder reusable, so a better head later needs no re-encode |
| Fine-tuned classifier (MobileNet/EfficientNet/ConvNeXt on weather data) | weights vary | 10–40 ms CPU [est] | 10 k+ labelled frames | Accuracy is not the problem; the *domain* is. Public weather sets are curated photographs: WEAPD is 6 877 images in 11 classes ([AGU 2020](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020EA001604)) |
| Places365 scene labels | per-checkpoint terms | fast | none | Wrong taxonomy (indoor/outdoor scenes, not weather). Skip |

**Embeddings beat labels.** Store the image embedding per *sampled* frame: 72 000 frames/day at
1-in-10 × 768 float16 ≈ 110 MB/day, which is nothing next to the frames. It buys kNN "show me frames
like this", clustering for free taxonomy discovery, novelty detection ("this camera has never looked
like that"), a similarity-sorted timeline, and — the practical one — the ability to add a weather head
in a week without re-running the encoder over history.

Sampling: **1 in 10** for the encoder (0.08–0.8 cores for the fleet), whole frame at 640 px, sky ROI
for the head. On a GPU the encoder becomes free and the rate can go to every frame; that is the point
where "weather per frame" becomes a timeline instead of a sample.

## 5. Object detection and counting: be honest about resolution

Cost baseline: **YOLO11n, 640 px, 56.1 ± 0.8 ms CPU ONNX, mAP 39.5 COCO, 2.6 M params**, versus
1.5 ms on a T4 with TensorRT ([Ultralytics YOLO11 docs](https://docs.ultralytics.com/models/yolo11)).
37× the cost on CPU, which is the whole GPU argument in one line.

At 500 cams × 60 s, detection on every frame is 0.47 cores — affordable. The blocker is not cost, it
is what a 640×480 traffic frame contains: a person 60 m from the mast is 8–14 px tall, a car at that
distance 20–40 px. COCO reports detection quality per object size precisely because small-object AP is
much lower than large-object AP, and YOLO11n's 39.5 is the average over all sizes — it says nothing
about a 12-px pedestrian (interpretation of the COCO protocol, not a quoted number).

| Target | Realistic at webcam res? | Notes |
| --- | --- | --- |
| Vehicles on highway cams | yes, with an ROI crop | 40–150 px in the Caltrans framing; counts need tracking to be stable, and a stable count is a traffic product, not a weather product. A density *proxy* for the event feed is the useful part |
| Traffic density / flow | yes, same crop | a rolling mean is more honest than any per-frame count |
| People | only near-field (≥40 px tall) | pavements at 640×480 from 20 m: no |
| Parking occupancy | only with a top-down lot camera | CNRPark+EXT is ~150 000 labelled *patches* from 9 cameras over one 164-space lot ([cnrpark.it](https://cnrpark.it/)) — per-space calibration per lot, and our sources are traffic and weather cams |
| Birds / animals | no | 5–20 px, motion-blurred, indistinguishable from litter; nest cams are a different product |
| Waves / tide | no | research-grade, needs calibrated geometry and a gauge in frame |
| Aurora | yes, but as *scene classification*, not detection | ResNet-50 on 87 275 hand-labelled of 5.5 M all-sky images (1.6%), 8 classes, 96.2% of arc images correct ([PMC9156776](https://pmc.ncbi.nlm.nih.gov/articles/PMC9156776/)) — all-sky fisheye cameras, not the roadside cams we ingest |

Cropping does **not** save compute: four 320×240 crops contain the same pixels as one 640×480 frame,
so cost is equal or worse (per-crop overhead). Cropping buys accuracy — effective resolution on the
object — not speed. What saves compute is downscaling to 320 px and accepting worse small-object
recall.

### Licence: this decides the detector before accuracy does

- Ultralytics YOLO is **AGPL-3.0**. AGPL §13 requires that anyone interacting with a modified version
  over a network be offered its Corresponding Source
  ([AGPL-3.0 text](https://www.gnu.org/licenses/agpl-3.0.txt)); Ultralytics states the free licence
  suits you "if you are comfortable open-sourcing your entire project under AGPL-3.0", and sells an
  Enterprise Licence "to ship YOLO in SaaS, embedded, and customer-facing products"
  ([ultralytics.com/legal](https://www.ultralytics.com/legal/agpl-3-0-software-license),
  [ultralytics.com/license](https://www.ultralytics.com/license)).
- Permissive alternatives: **YOLOX, Apache-2.0**
  ([LICENSE](https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE)); torchvision detection
  models (BSD-3 — **unverified**, check before use); RT-DETR/RTMDet from PaddleDetection (Apache-2.0 —
  **unverified**; the Ultralytics RT-DETR weights are AGPL). ONNX Runtime itself is MIT.
- Consequence for TBD #3: if the product is ever closed-source or SaaS, the *safe default* is an
  Apache/MIT detector behind a `Detector` interface (`predict(image, roi) -> boxes[]`), with Ultralytics
  only under a purchased licence. The interface matters more than the first model: swapping a detector
  is a week, swapping a licence after shipping is a legal event.

Sampling: ROI crops, **1 in 20** (0.02–0.5 cores depending on crop count). Detect-at-every-frame only
pays off on streams.

## 6. Temporal and derived signals

This is where the product gets its character, and almost none of it needs a model.

| Signal | Method | Cost | Notes |
| --- | --- | --- | --- |
| Frozen / stalled stream | FFmpeg `freezedetect` (`noise`, `duration`) on the RTSP/HLS input, or §2 on stored frames | per-stream, negligible | Belongs in the stream manager (`architecture.md` §5), not here |
| Event detection over time | rules on the sampled series: "fog class ≥3 consecutive samples", "activity > baseline for 10 min", "luma drop > 40% in 1 h = storm" | 0 (SQL/TS over existing rows) | `detected_event` / `event_observation` already exist in the data model; rules run in the orchestrator, not in the no-DB Python service |
| Best frame of the day | aesthetic/technical score over 1 frame/day/camera | NIMA 0.166 s, LAION-aesthetic 0.456 s CPU at 1080×800 [bench] | 500 cams → 83–228 s/day total. Cheap enough to be a real feature (hero image, timelapse cover). Caveat: aesthetic models reward saturated sunsets and shallow depth of field, so every camera picks the same *kind* of picture — blend with sharpness and a "not overexposed" term |
| Sunrise / sunset / golden hour | solar geometry (§3) + a clear-sky check | ~0 | Enables "sunset in 40 min · 12 cams" and a golden-hour filter; the clear-sky check is what stops it promising a sunset behind 800 m of cloud |
| Seasonal signals | 30-day aggregates of sky class, snow class, day length | 0 (rollups) | Needs history before it exists; the cheapest reason to keep analysis results long-term |
| "Worth looking at now" ranking | explainable score: fresh frame? daylight? event active? weather unusual for this camera? | 0 (query) | The highest-leverage *product* item in the list, and it is a query over the above, not a model. Never ship an unexplainable score here — users will ask why |

## 7. Vision-language descriptions: a caption layer, not an analyser

Cost per call is small, cost per day is not, and throughput is the binding constraint.

- Image tokens for a webcam frame are ~250–400: tile-based models bill base + 512-px tiles (85 + 170
  per tile for the 4o/4.1 generation), patch-based models bill `ceil(w/32)×ceil(h/32)` patches times a
  multiplier ([OpenAI vision docs](https://platform.openai.com/docs/guides/images-vision)).
- At $0.05–$0.20 per 1M input tokens for the small vision models and $0.40–$1.25 per 1M output
  ([OpenAI pricing](https://platform.openai.com/docs/pricing)), one caption of ~300 in / 60 out tokens
  costs **$0.00004–$0.00014**; 1 000 captions ≈ **$0.04–$0.14**; the whole fleet every 60 s ≈
  **$30–100/day** in tokens.
- The wall is throughput, not money: 8.3 calls/s sustained ≈ 150 k input tokens/min at seconds of
  latency per call. Sampling at 1 in 100 (7 200/day = 0.08/s) is the only shape that fits a normal API
  tier. Researcher inference from the arithmetic above.
- On CPU, a local 2–7 B VLM is not viable for this workload; on one GPU it becomes a batched
  background job. The same GPU that makes detect-every-frame possible.
- **Grounding is the risk, not the prose.** LVLMs hallucinate objects, and instructions that mention an
  object make it more likely to be "seen" (POPE, [arXiv:2305.10355](https://arxiv.org/abs/2305.10355));
  four state-of-the-art VLMs average 58.07% on seven trivial spatial tasks a human does perfectly, best
  77.84% ([arXiv:2407.06581](https://arxiv.org/abs/2407.06581)). Translation: never ask it to count,
  never ask it to read a small burned-in clock, never ask "is there a person" and expect a reliable
  yes. Ask for a scene description with an explicit "unclear" option, on a camera whose geometry you
  already know.
- Verdict: **complement.** It cannot replace §1–§6 (slower, costlier, unverifiable, worse at every one
  of those measurements), but it does two things nothing else does: a human-readable caption for the
  UI, and weak labels to bootstrap the §4 head. Event-gate it (only when §6 says something happened)
  and cap it per camera per day.

## 8. What a real operator would ask for that the list above misses

1. **Read the burned-in clock.** Cropping the timestamp ROI and running OCR gives a `captured_at`
   cross-check where provider timestamps are missing or wrong (`04` has three timestamp columns
   precisely because this is a mess). It also *produces* the overlay mask used by §2, and it detects a
   camera whose internal clock has drifted by hours. Tesseract is Apache-2.0; ~10–30 ms [est] on a
   small crop. This is the item I would add to the top three if the clock is legible on most sources.
2. **"Was this camera re-aimed or knocked?"** A background signature (masked pHash of the static
   region, or the sky mask's centroid) compared to the camera's own baseline. Storm damage and
   maintenance moves are a real support load, and Caltrans/TfL cameras do move.
3. **Lamp / illuminator outage.** On night frames, a near-constant bright region that disappears and
   stays gone is a streetlight out, not weather. Deterministic, high novelty, needs the night baseline.
4. **Lens fog/rain vs scene fog.** Local contrast at the frame border stays low when the droplet is on
   the glass and recovers at the centre when the fog is in the scene. Cheap discriminator, and it
   changes what the caption should say.
5. **Privacy pass.** Faces and plates at webcam resolution are usually unrecognisable, but a blur step
   on the near-field ROI is cheaper than a detection model and removes the GDPR question from the
   product conversation.
6. **A per-camera calibration artefact, stored once.** Sky mask, ground ROI, overlay mask, letterbox
   crop, night/luma/blur baselines, timezone, reference patch. Everything above gets cheaper and more
   accurate once this exists; it is the actual prerequisite for §1, §3, §4 and §6, and it belongs in
   camera config, not in the Python service.
7. **Health as a product, not a metric.** "Offline 3 h", "image unchanged 6 h", "blurred all week",
   "night frames black since Tuesday" — the operator-facing version of §1, which is what a camera owner
   actually wants and what makes the analysis visibly worth its CPU.

## Ranked: what to build, in order

Ranked by value per unit of cost, which is why several accurate-but-expensive ideas sit at the bottom.

| # | Analysis | User-facing value | CPU per frame | Licence risk | Build order |
| --- | --- | --- | --- | --- | --- |
| 1 | Day/night + golden hour from solar geometry | high — variants, badges, sampling policy, "black frame = outage" | <0.1 ms | none | **now** |
| 2 | Frame health (decode, placeholder, black/IR, clipping, contrast, letterbox, blockiness) | high — broken cameras found before users find them | 3–10 ms [est] | none | **now** |
| 3 | Masked pHash + abs-diff frozen/duplicate + changed regions | high — "alive vs stale", the dedupe in `04`, activity feed | 2–5 ms [est] | none | **now** |
| 4 | Per-camera calibration artefact (sky/ground/overlay masks, baselines) | enabling — prerequisite for 5, 7, 8, 9 | one-off | none | now |
| 5 | Sky-ROI statistics (cloud texture, whiteness, saturation) | high — the "what does the sky look like" signal | 3–5 ms [est] | none | after capture pipeline |
| 6 | Overlay mask + burned-in clock OCR | high — timestamp provenance, unlocks 3 | 10–30 ms [est] | Apache-2.0 (Tesseract) | after capture pipeline |
| 7 | CLIP/SigLIP embedding at 1-in-10 | high — search, similarity, novelty, clustering | 40–1000 ms [est/bench] | MIT / Apache-2.0 | after capture pipeline |
| 8 | Weather head on embeddings (clear/cloud/fog/rain/snow) | high — categories, filters, events | ~0 on top of 7 | yours | after 7 + 2 k labels |
| 9 | Blur/focus and lens-obstruction ratios | medium — dirty lens, defocus, cobwebs | ~2–3 ms [est] | none | after capture pipeline |
| 10 | Best-frame-of-day scoring | medium-high — hero image, timelapse | 0.17–0.46 s [bench], 1/day | model-dependent | after capture pipeline |
| 11 | Object detection on ROI crops at 1-in-20 | medium — vehicles yes, people rarely | 56 ms + crops [bench] | **AGPL-3.0 unless replaced** | later |
| 12 | VLM captions, event-gated | medium — narrative, weak labels | 2–10 s/call, ~$0.0001 | API terms | later |
| 13 | NR-IQA scores (BRISQUE/NIQE) as a metric | low — nobody reads a number | 80–210 ms [bench] | **PolyForm NC (pyiqa)** | skip |
| 14 | People counting / crowd density | low — resolution makes it a lie | 56 ms+ | AGPL | skip |
| 15 | Parking occupancy | low — wrong camera set, per-lot calibration | — | AGPL | skip |
| 16 | Aurora classification | low — needs all-sky north cameras | 10–30 ms | depends | skip (revisit if northern cams arrive) |
| 17 | Birds / animals, waves / tide | low — 5–20 px, or research-grade | — | — | skip |

### The three I would build first

1. **One deterministic "frame facts" pass** covering #1–#3: solar geometry, health flags, masked hash
   and diff, changed regions. Target **≤10 ms, every frame, no model, no licence**. Cheapest thing in
   the document, and it is what turns 720 000 JPEGs into a camera fleet that reports on itself; every
   later step is gated by it.
2. **The per-camera calibration artefact** (#4): sky mask, ground ROI, overlay mask, letterbox crop,
   night/luma/blur baselines. Not user-facing, but it is what makes sky statistics accurate and the
   pHash threshold defensible; without it, #5 and #7 inherit the overlay problem forever.
3. **Sky-ROI classification from CLIP/SigLIP embeddings at 1-in-10** (#5, #7, #8). The only analysis
   here that produces something a user would call *the feature* — categories, filters, "fog at 06:40"
   events — and storing the embedding instead of only the label keeps the option to change the
   taxonomy without reprocessing history.

### The five I would not build at all

1. **NR-IQA scores (BRISQUE/NIQE/PIQE) as stored metrics** — 0.1–0.2 s per frame for SROCC ≈ 0.23 on
   real modern imagery, plus a noncommercial licence on the convenient library. The four threshold
   signals in #2 answer the same question in 3 ms.
2. **People counting / crowd density** — at 640×480 a person is 8–14 px. A count that is wrong by 3× is
   worse than no count, and it costs a detector plus tracking.
3. **Parking occupancy** — requires a top-down lot camera and per-space calibration; that is a
   different source list (`02-camera-sources.md` has traffic and weather masts), not a different model.
4. **Aurora detection** — real and impressive, but the published systems run on all-sky fisheye cameras
   over 5.5 M frames with 87 k labels; on our sources it would be a night-only classifier trained on a
   handful of frames, which is a toy.
5. **Birds/animals and wave/tide detection** — 5–20 px objects and calibrated coastal geometry. Neither
   is reachable from a roadside JPEG, and both are the kind of feature that demos badly.

## What would change this answer

- **GPU (TBD #4).** Detection drops from 56 ms to 1.5 ms, the CLIP encoder to ~1 ms, a small VLM to
  worth considering. That flips #11 and #12 from "later" to "cheap" and would make a per-frame weather
  timeline (rather than a 1-in-10 sample) the default. It does **not** fix resolution, and it does not
  make people counting honest.
- **A labelled dataset we own (≈2 000 frames, stratified by source, hour and season).** Turns #7/#8
  from a guess into a measured system, and gives the first reliable number for zero-shot versus a head
  on *our* frames. Without it, every accuracy claim in §4 is borrowed from somebody else's cameras.
- **A public stream source (RTSP/HLS: 2 307 Caltrans streams already exist).** Streams make §6 temporal
  analysis and §2 frozen detection genuinely valuable, and let motion trigger #12 instead of a fixed
  sample rate.
- **Provider terms changing.** Caltrans fair-use and TfL credit conditions already constrain polling; a
  clause about derived products would put a whole category (counting, event feeds) out of bounds
  regardless of cost.
- **A licence decision on Ultralytics** (buy, or commit to the permissive detector). It decides whether
  #11 is a week of work or a legal review.
- **Lens reality.** If a spot check shows most sources are 640×480 with heavy blockiness, half of §1's
  thresholds have to be per-source rather than global, and the classifier in §4 moves from "nice" to
  "the only thing that survives".

## Open questions

- Is the burned-in clock legible enough across Digitraffic/Caltrans/TfL to be worth OCR? One afternoon
  of cropping three frames answers it, and it decides whether #6 joins the first three.
- Zero-shot CLIP/SigLIP on sky ROIs: better or worse than three hand-written thresholds? Needs the
  2 000-frame labelled set before any number can be quoted.
- Do we store embeddings in Postgres (`vector`/`jsonb`) or as an object per frame plus a small index?
  `architecture.md` TBD #7 (analytics store) probably answers this, but 110 MB/day of float16 is the
  number that decides it.
- Is "activity" worth anything for a weather product, or is it a traffic product in disguise? A week of
  motion series from five cameras would say.
- How does the analysis service learn a camera's baseline with no DB? Either the orchestrator passes
  the baseline statistics in the request, or the baseline lives as a derived object in the bucket
  (`frames/{id}/baseline.json`). The first is stateless and testable; the second survives a Redis wipe
  and matches "nothing is only in Redis".
- Which is the real default: whole-frame classification (what RMI and the traffic papers did) or
  sky-ROI (cleaner, cheaper, blind to ground snow)? Probably both, which means two results per frame
  and a UI that has to pick one.

## Links

- Focus measures: https://doi.org/10.1016/j.patcog.2012.11.011
- SSIM: https://ieeexplore.ieee.org/document/1284395
- BRISQUE: https://doi.org/10.1109/TIP.2012.2214050 · NIQE: https://doi.org/10.1109/LSP.2012.2227726 ·
  PIQE: https://doi.org/10.1109/NCC.2015.7084843 · MATLAB `piqe` (artifacts/noise masks):
  https://www.mathworks.com/help/images/ref/piqe.html
- IQA benchmark + efficiency: https://github.com/chaofengc/IQA-PyTorch (PolyForm Noncommercial)
- Perceptual hashing: https://github.com/JohannesBuchner/imagehash
- Freeze/black detection: https://ffmpeg.org/ffmpeg-filters.html#freezedetect
- Sky masks per static camera: https://cs.valdosta.edu/~rpmihail/skyfinder/ ·
  https://zenodo.org/records/5884485
- Webcam weather, real numbers: https://www.meteo.be/uploads/media/63ff730c19070/fogdetectionwithml.pdf
- Traffic-camera weather + night gap: https://arxiv.org/abs/2504.19684
- Aurora on all-sky cameras: https://pmc.ncbi.nlm.nih.gov/articles/PMC9156776/
- Parking patches: https://cnrpark.it/
- Detector cost + licence: https://docs.ultralytics.com/models/yolo11 ·
  https://www.ultralytics.com/legal/agpl-3-0-software-license · https://www.gnu.org/licenses/agpl-3.0.txt ·
  https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE
- Encoders: https://github.com/openai/CLIP/blob/main/LICENSE ·
  https://huggingface.co/google/siglip-base-patch16-224
- VLM grounding: https://arxiv.org/abs/2305.10355 · https://arxiv.org/abs/2407.06581
- VLM cost: https://platform.openai.com/docs/guides/images-vision ·
  https://platform.openai.com/docs/pricing
- Solar position: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
