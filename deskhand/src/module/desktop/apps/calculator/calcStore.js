import { create } from "zustand";

const useCalcStore = create((set) => ({
  stamp: 0,
  expr: "",
  result: "",
  show: (expr, result) => set((s) => ({ stamp: s.stamp + 1, expr, result })),
}));

export default useCalcStore;
