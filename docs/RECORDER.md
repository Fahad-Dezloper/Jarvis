# Video fallback (Phase 6a)

For animations the Web Animations API cannot scrub (framer-motion, canvas, Lottie, any site), the user brings a screen
recording and pins frames. Output is the normal `Pin` (`selector: null`).

Files: `components/recorder/VideoAnnotator.tsx`, `components/recorder/ScreenRecorder.tsx`, `lib/recorder/pure.ts`
(tested by `npm run check:recorder`), `lib/recorder/media.ts`, harness at `/dev/recorder`.

## Pin format
`{ id, timeMs, selector: null, text }`. `timeMs` is the start of the displayed frame. A click-to-mark point is appended
to `text` as ` [mark 0.412,0.733]` (normalised to the picture, top-left origin, letterboxing excluded). Use
`parseMark` / `stripMark` from `lib/recorder/pure.ts` to read it back.

## Verified (from docs and type definitions, plus unit tests)
- `requestVideoFrameCallback` / `cancelVideoFrameCallback` and `VideoFrameCallbackMetadata` (`mediaTime`,
  `presentedFrames`) exist in TypeScript 5.9 `lib.dom.d.ts`; the build type-checks against them.
- Pure logic (frame/time maths, fps estimation, mark encoding, letterbox geometry, mime choice) passes
  `npm run check:recorder`.
- `npm run build` and `npm run lint` pass.

## Not verified in a browser
No browser was available to the author, so the UI has not been exercised. Everything below is from knowledge of the
specs, not observed:
- Frame stepping accuracy. Stepping seeks to the middle of a frame at the estimated fps; this relies on the fps
  estimate (snapped to common rates) or the manual fps box. Variable-frame-rate recordings can be off by a frame.
- `requestVideoFrameCallback` is in Chromium and Safari and recent Firefox; where absent the annotator falls back to
  `timeupdate`/rAF clock and the assumed 30 fps, and shows a warning.
- `getDisplayMedia` + `MediaRecorder`: needs a secure context (https or localhost) and a user gesture. `preferCurrentTab`
  is a Chromium hint only; the user can still pick anything.
- Region Capture (`CropTarget`) is Chromium-only and only works when the user picks the current tab. The checkbox is
  hidden elsewhere and only shown when a `cropSelector` prop is passed.
- WebM from MediaRecorder usually has `duration === Infinity`. The annotator seeks to `1e101`, waits for
  `timeupdate`, seeks back to 0 (`lib/recorder/media.ts`), with a 10s timeout and the recorder's own measured
  duration as fallback.
- `.mov` plays only if the browser supports its codec (HEVC/ProRes often does not outside Safari); a decode error
  message tells the user to export mp4/webm.
- Very low playback rates (0.1x) are accepted by the element, but browsers may mute audio or clamp; the video is muted
  here so that does not matter.
- Scrubber pin markers are positioned by percentage and may be off by about half a thumb width at the ends.
