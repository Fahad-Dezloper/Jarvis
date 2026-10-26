import { create } from "zustand";
import { isoDate } from "./calendarCore.js";

const KEY = "deskhand_calendar_events";
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

const seed = () => [
  {
    id: "1",
    title: "Team Sync",
    date: day(0),
    start: "10:00",
    end: "10:30",
    category: "work",
    desc: "Weekly check-in: review priorities and blockers.",
  },
  {
    id: "2",
    title: "Design Review",
    date: day(0),
    start: "14:00",
    end: "15:30",
    category: "work",
    desc: "Walk through the latest mockups and collect feedback.",
  },
  {
    id: "3",
    title: "Lunch with a Friend",
    date: day(1),
    start: "12:30",
    end: "13:30",
    category: "personal",
    desc: "Catch up over lunch.",
  },
  {
    id: "4",
    title: "Project Release",
    date: day(3),
    start: "09:00",
    end: "10:30",
    category: "work",
    desc: "Build the bundle and run the final checks.",
  },
  {
    id: "5",
    title: "Mom's Birthday",
    date: day(5),
    start: "00:00",
    end: "23:59",
    category: "birthdays",
    desc: "Don't forget the card.",
  },
];

function load() {
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (saved) return JSON.parse(saved);
  } catch {
    /* use the seed */
  }
  return seed();
}

const useCalendarStore = create((set, get) => ({
  events: [],
  hydrated: false,
  flashId: null,
  focusDate: null, // 'YYYY-MM-DD' the grid should show
  hydrate: () => {
    if (!get().hydrated) set({ events: load(), hydrated: true });
  },
  setEvents: (updater) => {
    get().hydrate();
    const next = typeof updater === "function" ? updater(get().events) : updater;
    set({ events: next });
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  },
  flash: (id, date) => {
    set({ flashId: id, focusDate: date });
    setTimeout(() => get().flashId === id && set({ flashId: null }), 4500);
  },
  clearFocus: () => set({ focusDate: null }),
}));

export default useCalendarStore;
