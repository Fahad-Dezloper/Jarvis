// Module-level 'calendar' handlers (open the window themselves, use the shared store).
import useWindowsStore from "@store/window";
import "../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import useCalendarStore from "./calendarStore";
import { describeWhen, formatEventLine, isoDate, parseWhen, upcomingEvents } from "./calendarCore";

const handlers = {
  add_event: async (args) => {
    try {
      const title = String(args?.title ?? "").trim();
      if (!title) return { ok: false, message: "No event title was given." };
      const whenText = String(args?.when ?? "").trim();
      const w = parseWhen(whenText);
      const store = useCalendarStore.getState();
      store.hydrate();
      const ev = {
        id: `ev-${Date.now()}`,
        title,
        date: w.date,
        start: w.start,
        end: w.end,
        category: "personal",
        desc: "",
      };
      useWindowsStore.getState().openWindow("calendar");
      store.setEvents((prev) => [...prev, ev]);
      store.flash(ev.id, ev.date);
      const when = describeWhen(ev.date, ev.start);
      const note = w.matched
        ? ""
        : whenText
          ? ` I could not read "${whenText}", so I used the next hour.`
          : " No time was given, so I used the next hour.";
      return {
        ok: true,
        message: `Added "${title}" for ${when}.${note}`,
        data: formatEventLine(ev),
      };
    } catch (err) {
      return { ok: false, message: `Calendar error: ${err?.message || err}` };
    }
  },
  list_events: async () => {
    try {
      const store = useCalendarStore.getState();
      store.hydrate();
      useWindowsStore.getState().openWindow("calendar");
      const list = upcomingEvents(useCalendarStore.getState().events);
      if (!list.length)
        return { ok: true, message: "There are no upcoming events.", data: "No upcoming events." };
      return {
        ok: true,
        message: `You have ${list.length} upcoming event${list.length === 1 ? "" : "s"}.`,
        data: list
          .map((e) => formatEventLine(e))
          .join("\n")
          .slice(0, 5000),
      };
    } catch (err) {
      return { ok: false, message: `Calendar error: ${err?.message || err}` };
    }
  },
};

if (typeof window !== "undefined") {
  registerHandlers("calendar", handlers);
  registerSummary("calendar", () => {
    const store = useCalendarStore.getState();
    store.hydrate();
    const today = isoDate(new Date());
    const todays = useCalendarStore
      .getState()
      .events.filter((e) => e.date === today)
      .sort((a, b) => a.start.localeCompare(b.start));
    return todays.length
      ? `Calendar events today: ${todays.map((e) => `${e.title} ${e.start}-${e.end}`).join("; ")}.`
      : "Calendar has no events today.";
  });
}
