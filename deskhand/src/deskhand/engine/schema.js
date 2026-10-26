// Allowlist validation for plans. Everything the model (or any caller) proposes
// passes through sanitizeActions before it can reach the executor: unknown
// action types are dropped, numbers are clamped, strings are capped, and only
// capabilities declared in capabilities.js can be invoked.
import { z } from "zod";
import { CAPABILITIES, WINDOW_TO_GROUP } from "../capabilities.js";
import { WINDOW_CONFIG } from "../../constants/window.js";

export const MAX_ACTIONS = 24;
/** The planner may return at most this many actions per round. */
export const MODEL_MAX_ACTIONS = 24;
// Every window in the desktop config plus every window the capability catalog
// maps to a group (so newly added apps such as mail are addressable).
export const WINDOW_KEYS = [...new Set([...Object.keys(WINDOW_CONFIG), ...Object.keys(WINDOW_TO_GROUP)])];
export const LAYOUTS = ["grid", "columns", "rows", "cascade"];
export const ACTION_TYPES = [
  "open",
  "close",
  "minimize",
  "maximize",
  "restore",
  "focus",
  "move",
  "resize",
  "tile",
  "click",
  "type",
  "invoke",
  "say",
];

const TEXT_MAX = 500;
const LABEL_MAX = 120;
export const CLIPBOARD_TOKEN = "{{clipboard}}";

// Script-like content is never accepted in any string argument.
const SCRIPT_LIKE = /<\s*\/?\s*script|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*iframe|\bon(?:error|load|click)\s*=/i;
const windowKey = z.string().refine((k) => WINDOW_KEYS.includes(k), "unknown window");
const text = (max) => z.string().min(0).max(max).refine((v) => !SCRIPT_LIKE.test(v), "script content");
const num = (min, max) =>
  z
    .number()
    .transform((n) => Math.min(max, Math.max(min, Math.round(n))));

const strict = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open"), window: windowKey }),
  z.object({ type: z.literal("close"), window: windowKey }),
  z.object({ type: z.literal("minimize"), window: windowKey }),
  z.object({ type: z.literal("maximize"), window: windowKey }),
  z.object({ type: z.literal("restore"), window: windowKey }),
  z.object({ type: z.literal("focus"), window: windowKey }),
  z.object({ type: z.literal("move"), window: windowKey, x: num(-4000, 8000), y: num(-4000, 8000) }),
  z.object({
    type: z.literal("resize"),
    window: windowKey,
    width: num(200, 4000),
    height: num(150, 3000),
  }),
  z.object({
    type: z.literal("tile"),
    layout: z.enum(LAYOUTS),
    windows: z.array(windowKey).max(12).optional(),
  }),
  z.object({ type: z.literal("click"), window: windowKey, target: text(LABEL_MAX).min(1) }),
  z.object({
    type: z.literal("type"),
    window: windowKey,
    target: text(LABEL_MAX).optional(),
    text: text(TEXT_MAX),
    submit: z.boolean().optional(),
  }),
  z.object({ type: z.literal("say"), text: text(TEXT_MAX) }),
]);

const BAD_SCHEME = /^\s*(javascript|data|vbscript|file|blob|about):/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
// Calculator expressions: digits, operators, brackets and a few words/currency signs.
const EXPRESSION_WORDS = /\b(?:of|percent|plus|minus|times|divided|by|multiplied|over|x|power|to|the|squared)\b/gi;
const EXPRESSION_OK = /^[\d\s%+\-*/^().,=×÷$€£₹]+$/u;

/** Max string length per "app.name.arg"; anything not listed gets TEXT_MAX. */
export const ARG_LIMITS = {
  "terminal.run_command.command": 500,
  "terminal.read_project.path": 200,
  "notes.append_note.text": 2000,
  "notes.new_note.title": 120,
  "browser.search.query": 200,
  "browser.open_result.which": 200,
  "browser.open_url.url": 500,
  "browser.copy_link.element": 120,
  "finder.open.name": 200,
  "finder.read_file.name": 200,
  "mail.compose.to": 200,
  "mail.compose.subject": 200,
  "mail.compose.body": 3000,
  "calendar.add_event.title": 200,
  "calendar.add_event.when": 120,
  "calculator.compute.expression": 200,
  "weather.show.city": 80,
};

/** Validate invoke args against the declared capability params. Returns args or null. */
export function validateInvokeArgs(app, name, rawArgs) {
  const cap = CAPABILITIES[app]?.find((c) => c.name === name);
  if (!cap) return null;
  const props = cap.params?.properties ?? {};
  const required = cap.params?.required ?? [];
  const args = {};
  const input = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
  for (const [key, spec] of Object.entries(props)) {
    let v = input[key];
    if (v === undefined || v === null) continue;
    if (spec.type === "string") {
      if (typeof v !== "string" && typeof v !== "number") return null;
      v = String(v).replace(CONTROL_CHARS, "");
      if (v.length > (ARG_LIMITS[`${app}.${name}.${key}`] ?? TEXT_MAX)) {
        // enum and url values are never truncated into something else; free text is clipped
        if (spec.enum || key === "url") return null;
        v = v.slice(0, ARG_LIMITS[`${app}.${name}.${key}`] ?? TEXT_MAX);
      }
      if (SCRIPT_LIKE.test(v)) return null;
      if (app === "calculator" && key === "expression" && !EXPRESSION_OK.test(v.replace(EXPRESSION_WORDS, ""))) return null;
      if (spec.enum && !spec.enum.includes(v)) return null;
      if (key === "url") {
        if (BAD_SCHEME.test(v)) return null;
        if (v.includes("://") && !/^https?:\/\//i.test(v.trim())) return null;
      }
    } else if (spec.type === "number") {
      v = Number(v);
      if (!Number.isFinite(v)) return null;
      v = Math.min(spec.maximum ?? 1e6, Math.max(spec.minimum ?? -1e6, v));
    } else if (spec.type === "boolean") {
      if (typeof v === "string") v = v === "true";
      if (typeof v !== "boolean") return null;
    } else {
      continue;
    }
    args[key] = v;
  }
  for (const key of required) if (args[key] === undefined) return null;
  // set_setting only accepts known toggles
  if (app === "settings" && name === "set_setting") {
    if (!["wifi", "bluetooth", "focusMode", "nightLight", "vpn"].includes(args.key)) return null;
  }
  return args;
}

/** Validate one proposed action. Returns the clean action, or null when it is not allowed. */
export function sanitizeAction(raw) {
  if (!raw || typeof raw !== "object" || !ACTION_TYPES.includes(raw.type)) return null;
  if (raw.type === "invoke") {
    if (typeof raw.app !== "string" || typeof raw.name !== "string" || raw.args === null) return null;
    const args = validateInvokeArgs(raw.app, raw.name, raw.args);
    return args ? { type: "invoke", app: raw.app, name: raw.name, args } : null;
  }
  const r = strict.safeParse(raw);
  if (!r.success) return null;
  const a = r.data;
  if (a.type === "tile" && a.windows && a.windows.length === 0) delete a.windows;
  return a;
}

/** Validate a list: drops invalid entries, caps the count. */
export function sanitizeActions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const a = sanitizeAction(raw);
    if (a) out.push(a);
    if (out.length >= MAX_ACTIONS) break;
  }
  return out;
}

/**
 * Flat schema handed to the model. Structured-output grammars handle a single
 * object with optional fields better than a tagged union, so the strict check
 * happens afterwards in sanitizeActions. Invoke args travel as a JSON string.
 */
export const modelPlanSchema = z.object({
  reply: z
    .string()
    .describe("While working (done=false): one short sentence about what you are doing. When done=true: the final answer to the user, written only from the observations."),
  done: z.boolean().describe("true when the task is finished and reply is the final answer; false when you need to see the results of these actions first."),
  actions: z
    .array(
      z.object({
        type: z.enum(ACTION_TYPES),
        window: z.string().optional().describe("Window key, exactly as listed."),
        windows: z.array(z.string()).optional().describe("For tile: window keys; omit for all open windows."),
        layout: z.enum(LAYOUTS).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        target: z.string().optional().describe("For click/type: element id (dk-...) or its label."),
        text: z.string().optional(),
        submit: z.boolean().optional(),
        app: z.string().optional().describe("For invoke: capability group, e.g. music."),
        name: z.string().optional().describe("For invoke: handler name, e.g. play."),
        args_json: z.string().optional().describe('For invoke: JSON object string of arguments, e.g. {"query":"HiNV Music"}.'),
      }),
    )
    .max(MAX_ACTIONS),
});

/** Turn the model's flat output into a validated PlanResult body. */
export function planFromModelOutput(output) {
  const rawActions = Array.isArray(output?.actions) ? output.actions : [];
  const mapped = rawActions.map((a) => {
    const base = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null && v !== undefined));
    if (base.type === "invoke") {
      let args = {};
      if (typeof base.args_json === "string" && base.args_json.trim()) {
        try {
          args = JSON.parse(base.args_json);
        } catch {
          args = null;
        }
      }
      return { type: "invoke", app: base.app, name: base.name, args };
    }
    delete base.args_json;
    return base;
  });
  const actions = sanitizeActions(mapped).slice(0, MODEL_MAX_ACTIONS);
  const reply = typeof output?.reply === "string" ? output.reply.trim().slice(0, 1200) : "";
  const done = !(output?.done === false && actions.length > 0);
  return { actions, done, reply: reply || (actions.length ? "On it." : "I can't do that here.") };
}
