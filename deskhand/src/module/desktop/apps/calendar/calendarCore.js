// Pure natural-time parsing and event helpers for the Calendar. No alias imports.

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function parseTime(text) {
  const t = text.toLowerCase();
  if (/\bnoon\b/.test(t)) return { h: 12, m: 0 };
  if (/\bmidnight\b/.test(t)) return { h: 0, m: 0 };
  let m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const mer = (m[3] || "").replace(/\./g, "");
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h < 24 && min < 60) return { h, m: min };
  }
  m = t.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/);
  if (m) {
    let h = Number(m[1]);
    const mer = m[2].replace(/\./g, "");
    if (h >= 1 && h <= 12) {
      if (mer === "pm" && h < 12) h += 12;
      if (mer === "am" && h === 12) h = 0;
      return { h, m: 0 };
    }
  }
  m = t.match(/\bat\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th|days?))/);
  if (m) {
    let h = Number(m[1]);
    if (h >= 1 && h <= 12) {
      if (h < 8) h += 12; // "at 3" means afternoon
      return { h, m: 0 };
    }
  }
  if (/\b(this\s+)?morning\b/.test(t)) return { h: 9, m: 0 };
  if (/\bafternoon\b/.test(t)) return { h: 15, m: 0 };
  if (/\bevening\b/.test(t)) return { h: 18, m: 0 };
  return null;
}

function parseDate(text, now) {
  const t = text.toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  if (/\b(today|tonight|this evening)\b/.test(t)) return today;
  m = t.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (m) return addDays(today, Number(m[1]));
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  m = t.match(/\b(next|this|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const target = WEEKDAYS.indexOf(m[2]);
    let diff = (target - today.getDay() + 7) % 7;
    if (m[1] === "next" && diff < 7) diff = diff === 0 ? 7 : diff + (diff <= 0 ? 7 : 0);
    if (m[1] === "next" && (target - today.getDay() + 7) % 7 !== 0 && diff < 7) diff += 0;
    if (diff === 0 && m[1] !== "this") diff = 7;
    return addDays(today, diff);
  }
  m = t.match(
    new RegExp(
      `\\b(${MONTHS.map((x) => x.slice(0, 3)).join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
    ),
  );
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m[1]));
    let d = new Date(now.getFullYear(), month, Number(m[2]));
    if (d < today) d = new Date(now.getFullYear() + 1, month, Number(m[2]));
    return d;
  }
  m = t.match(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.map((x) => x.slice(0, 3)).join("|")})[a-z]*\\b`,
    ),
  );
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m[2]));
    let d = new Date(now.getFullYear(), month, Number(m[1]));
    if (d < today) d = new Date(now.getFullYear() + 1, month, Number(m[1]));
    return d;
  }
  return null;
}

/**
 * Parse simple natural time. Returns { date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM', matched:boolean }.
 * matched=false means nothing was understood and the next full hour was used.
 */
export function parseWhen(text, now = new Date()) {
  const src = String(text || "");
  const date = parseDate(src, now);
  const time = parseTime(src);
  let d;
  let h;
  let min = 0;
  let matched = true;
  if (!date && !time) {
    matched = false;
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
    d = next;
    h = next.getHours();
  } else if (date && !time) {
    d = date;
    h = 9;
  } else if (!date && time) {
    const cand = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.h, time.m);
    d = cand > now ? cand : addDays(cand, 1);
    h = time.h;
    min = time.m;
  } else {
    d = date;
    h = time.h;
    min = time.m;
  }
  const endTotal = h * 60 + min + 60;
  const endH = Math.min(23, Math.floor(endTotal / 60));
  const endM = endTotal >= 24 * 60 ? 59 : endTotal % 60;
  return {
    date: isoDate(d),
    start: `${pad(h)}:${pad(min)}`,
    end: `${pad(endH)}:${pad(endM)}`,
    matched,
  };
}

export function describeWhen(date, start, now = new Date()) {
  const [y, mo, da] = date.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - today) / 86400000);
  const day =
    diff === 0
      ? "today"
      : diff === 1
        ? "tomorrow"
        : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const [h, m] = start.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${day} at ${hh}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

/** Upcoming events (today onwards, past events of today excluded), sorted. */
export function upcomingEvents(events, now = new Date(), limit = 20) {
  const today = isoDate(now);
  const nowHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return [...events]
    .filter((e) => e.date > today || (e.date === today && e.end >= nowHm))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, limit);
}

export function formatEventLine(e, now = new Date()) {
  return `${e.date} ${e.start}-${e.end} | ${e.title} (${describeWhen(e.date, e.start, now)})`;
}
