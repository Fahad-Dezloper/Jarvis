import { create } from "zustand";

const useWeatherStore = create((set) => ({
  stamp: 0,
  latest: null, // { city, condition, tempC, ... }
  show: (latest) => set((s) => ({ stamp: s.stamp + 1, latest })),
}));

export default useWeatherStore;
