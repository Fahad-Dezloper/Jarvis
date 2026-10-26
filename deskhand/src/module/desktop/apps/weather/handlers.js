import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import useWeatherStore from "./weatherStore";
import { cleanCity, describeWeather, fallbackWeather, isPlausibleCity } from "./weatherCore";

async function lookup(city) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`/api/search?source=weather&q=${encodeURIComponent(city)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (j?.data?.condition) return { ...j.data, offline: false };
    }
  } catch {
    /* use the offline sample */
  }
  return fallbackWeather(city);
}

if (typeof window !== "undefined") {
  registerHandlers("weather", {
    show: async (args) => {
      try {
        const city = cleanCity(args?.city);
        if (!city) return { ok: false, message: "No city was given." };
        if (!isPlausibleCity(city))
          return { ok: false, message: `"${city}" does not look like a city name.` };
        useWindowsStore.getState().openWindow("weather");
        const w = await lookup(city);
        useWeatherStore.getState().show(w);
        const line = describeWeather(w);
        return { ok: true, message: line, data: line };
      } catch (err) {
        return { ok: false, message: `Weather error: ${err?.message || err}` };
      }
    },
  });
  registerSummary("weather", () => {
    const w = useWeatherStore.getState().latest;
    return w
      ? `Weather window last showed ${describeWeather(w)}`
      : "Weather has not looked up a city yet.";
  });
}
