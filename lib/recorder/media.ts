// Browser-only media helpers (not pure; not covered by check-recorder).

/**
 * MediaRecorder output (WebM in particular) usually has no duration in its
 * header, so video.duration is Infinity and the scrubber has no range. The
 * standard workaround: seek to an absurdly large time, which forces the
 * browser to scan to the end and learn the real duration, then seek back.
 * Resolves once back at 0 (or after a timeout, so callers never hang).
 */
export function repairInfiniteDuration(video: HTMLVideoElement, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    if (Number.isFinite(video.duration)) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("timeupdate", onHuge);
      resolve();
    };
    const onHuge = () => {
      video.removeEventListener("timeupdate", onHuge);
      video.addEventListener("seeked", finish, { once: true });
      video.currentTime = 0;
    };
    const timer = window.setTimeout(finish, timeoutMs);
    video.addEventListener("timeupdate", onHuge);
    video.currentTime = 1e101;
  });
}
