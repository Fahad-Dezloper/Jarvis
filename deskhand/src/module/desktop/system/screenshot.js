// Screenshot: html2canvas of the whole desktop, saved as a JPEG into a "Screenshots"
// folder on the desktop store and announced with a thumbnail toast.
import dayjs from "dayjs";
import useSystemStore from "@store/system";

const MAX_W = 1280;

// html2canvas 1.4 cannot parse lab()/oklch()/color() values, which Tailwind 4 emits.
// In the cloned document, rewrite those colours as plain rgba() before it renders.
const MODERN = /\b(?:lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)/g;
const COLOR_PROPS = [
  "color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color",
  "border-left-color", "outline-color", "box-shadow", "text-shadow", "fill", "stroke", "caret-color", "text-decoration-color",
  "text-emphasis-color", "column-rule-color", "-webkit-text-fill-color", "-webkit-text-stroke-color",
];

function toRgba(ctx, token) {
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = token;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return "rgba(0, 0, 0, 0)";
  }
}

export function sanitizeModernColors(doc) {
  const canvas = doc.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const view = doc.defaultView;
  const fix = (v) => v.replace(MODERN, (t) => toRgba(ctx, t));
  const pseudoRules = [];
  let id = 0;
  for (const el of doc.querySelectorAll("*")) {
    const cs = view.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const v = cs.getPropertyValue(prop);
      MODERN.lastIndex = 0;
      if (v && MODERN.test(v)) {
        MODERN.lastIndex = 0;
        el.style.setProperty(prop, fix(v), "important");
      }
    }
    for (const pe of ["::before", "::after"]) {
      const ps = view.getComputedStyle(el, pe);
      const content = ps.getPropertyValue("content");
      if (!content || content === "none" || content === "normal") continue;
      const decls = [];
      for (const prop of COLOR_PROPS) {
        const v = ps.getPropertyValue(prop);
        MODERN.lastIndex = 0;
        if (v && MODERN.test(v)) {
          MODERN.lastIndex = 0;
          decls.push(`${prop}: ${fix(v)} !important`);
        }
      }
      if (decls.length) {
        const mark = el.getAttribute("data-dk-shot") || `n${id++}`;
        el.setAttribute("data-dk-shot", mark);
        pseudoRules.push(`[data-dk-shot="${mark}"]${pe} { ${decls.join("; ")} }`);
      }
    }
  }
  if (pseudoRules.length) {
    const style = doc.createElement("style");
    style.textContent = pseudoRules.join("\n");
    doc.head.appendChild(style);
  }
}

export function screenshotName(now = new Date()) {
  return `Screenshot ${dayjs(now).format("YYYY-MM-DD [at] HH.mm.ss")}.jpg`;
}

export async function takeScreenshot() {
  let html2canvas;
  try {
    html2canvas = (await import("html2canvas")).default;
  } catch (err) {
    return { ok: false, message: `Screenshot failed: the capture library did not load (${err?.message || err}).` };
  }
  try {
    useSystemStore.getState().setScreenshotToast(null);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    const canvas = await html2canvas(document.body, {
      backgroundColor: "#000",
      useCORS: true,
      scale: 1,
      logging: false,
      onclone: (doc) => {
        try {
          sanitizeModernColors(doc);
        } catch (err) {
          console.warn("screenshot colour fix failed", err);
        }
      },
      ignoreElements: (el) => el.hasAttribute?.("data-no-screenshot"),
    });
    const ratio = Math.min(1, MAX_W / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * ratio);
    out.height = Math.round(canvas.height * ratio);
    out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
    const src = out.toDataURL("image/jpeg", 0.7);
    const name = screenshotName();
    const { item, storageFull } = useSystemStore.getState().addScreenshot(name, src);
    useSystemStore.getState().setScreenshotToast({ id: item.id, name: item.name, src, at: Date.now() });
    return { ok: true, name: item.name, note: storageFull ? "Browser storage is full, so it will not survive a reload." : "" };
  } catch (err) {
    return { ok: false, message: `Screenshot failed: html2canvas could not capture the page (${err?.message || err}).` };
  }
}
