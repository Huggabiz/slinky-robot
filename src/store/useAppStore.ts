import { create } from 'zustand';

// Single top-level app store. Add new slices of state and their actions
// inline here. Use `get()` for cross-action reads and `set()` for writes,
// always returning new objects/arrays (no in-place mutation).
interface AppState {
  message: string;
  setMessage: (message: string) => void;
  reset: () => void;
}

const INITIAL_MESSAGE = '';

export const useAppStore = create<AppState>((set) => ({
  message: INITIAL_MESSAGE,
  setMessage: (message) => set({ message }),
  reset: () => set({ message: INITIAL_MESSAGE }),
}));
