// Local types for the video fallback. lib/types.ts is intentionally untouched:
// a click-to-mark point is stored inside Pin.text as a suffix (see pure.ts).

/** A point on the frame, normalised to the video picture (0..1, top-left origin). */
export interface PinMark {
  x: number;
  y: number;
}

/** One sample from requestVideoFrameCallback. */
export interface FrameSample {
  /** Media timestamp of the presented frame, in seconds. */
  mediaTime: number;
  /** Monotonic count of frames presented to the compositor. */
  presentedFrames: number;
}

/** A finished in-browser recording. */
export interface RecordedClip {
  blob: Blob;
  mimeType: string;
  /** Wall-clock duration measured by the recorder, in ms. */
  durationMs: number;
}
