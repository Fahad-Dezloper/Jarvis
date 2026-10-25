// Dev-only: exposes the handler registry as window.__dkBridge so handlers can
// be exercised from the browser console. Not present in production builds.
import * as bridge from "@deskhand/bridge";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__dkBridge = bridge;
}
