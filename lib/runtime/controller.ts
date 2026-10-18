import type { RuntimeCommand, RuntimeEvent } from "@/lib/types";

export type PlaybackListener = (event: RuntimeEvent) => void;

const EVENT_TYPES: ReadonlyArray<string> = [
  "mb:ready",
  "mb:animations",
  "mb:time",
  "mb:element-picked",
  "mb:error",
];

/** Narrow an untrusted message payload to a RuntimeEvent. */
export function parseRuntimeEvent(data: unknown): RuntimeEvent | null {
  if (!data || typeof data !== "object") return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== "string" || EVENT_TYPES.indexOf(type) === -1) return null;
  const d = data as Record<string, unknown>;
  switch (type) {
    case "mb:animations":
      if (!Array.isArray(d.animations) || typeof d.totalMs !== "number") return null;
      break;
    case "mb:time":
      if (typeof d.timeMs !== "number" || typeof d.playing !== "boolean") return null;
      break;
    case "mb:element-picked":
      if (typeof d.selector !== "string" || typeof d.tag !== "string" || !d.rect) return null;
      break;
    case "mb:error":
      if (typeof d.message !== "string") return null;
      break;
  }
  return data as RuntimeEvent;
}

/**
 * Host-side end of the playback protocol. Talks to the runtime inside one
 * iframe window and ignores messages from any other source.
 */
export class PlaybackController {
  private target: Window | null = null;
  private listeners = new Set<PlaybackListener>();
  private listening = false;

  private onMessage = (event: MessageEvent) => {
    // The iframe may be sandboxed (opaque origin), so the origin string is not
    // a usable check; the source window identity is.
    if (!this.target || event.source !== this.target) return;
    const parsed = parseRuntimeEvent(event.data);
    if (!parsed) return;
    this.listeners.forEach((listener) => {
      try {
        listener(parsed);
      } catch (err) {
        console.error("[motion-brief] playback listener failed", err);
      }
    });
  };

  /** Point the controller at an iframe window (or null to detach). */
  attach(iframeWindow: Window | null): void {
    this.target = iframeWindow;
    if (typeof window === "undefined") return;
    if (iframeWindow && !this.listening) {
      window.addEventListener("message", this.onMessage);
      this.listening = true;
    } else if (!iframeWindow && this.listening) {
      window.removeEventListener("message", this.onMessage);
      this.listening = false;
    }
    // A runtime that booted before we attached will not announce itself again.
    if (iframeWindow) this.send({ type: "mb:scan" });
  }

  detach(): void {
    this.attach(null);
  }

  get attached(): boolean {
    return this.target !== null;
  }

  send(command: RuntimeCommand): void {
    if (!this.target) return;
    try {
      // Target origin must be "*": a sandboxed srcDoc frame has an opaque origin.
      this.target.postMessage(command, "*");
    } catch (err) {
      console.error("[motion-brief] failed to post command", err);
    }
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
