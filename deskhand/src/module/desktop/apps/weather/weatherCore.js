// Pure helpers for the voice-driven Weather lookup. No alias imports.

const hash = (s) =>
  [...String(s).toLowerCase()].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const SAMPLE_CONDITIONS = ["Sunny", "Partly cloudy", "Clear", "Light rain", "Overcast"];

/** Deterministic offline sample so the demo still shows something plausible. */
export function fallbackWeather(city) {
  const h = hash(city);
  const tempC = 18 + (h % 15);
  return {
    city: String(city)
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    country: "",
    condition: SAMPLE_CONDITIONS[h % SAMPLE_CONDITIONS.length],
    tempC,
    tempF: Math.round((tempC * 9) / 5 + 32),
    feelsC: tempC + (h % 3),
    feelsF: Math.round(((tempC + (h % 3)) * 9) / 5 + 32),
    offline: true,
  };
}

export function describeWeather(w) {
  const place = w.country ? `${w.city}, ${w.country}` : w.city;
  const tail = w.offline ? " (offline sample, not live data)" : "";
  return `${place}: ${w.tempC}°C (${w.tempF}°F), ${w.condition}, feels like ${w.feelsC}°C (${w.feelsF}°F)${tail}.`;
}

/** Accepts only plausible city text. */
export const cleanCity = (c) =>
  String(c ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
export const isPlausibleCity = (c) => /^[\p{L}\p{M}\s.,'-]{1,80}$/u.test(c);
