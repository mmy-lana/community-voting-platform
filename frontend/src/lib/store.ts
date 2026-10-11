import { create } from 'zustand';

export type VoteStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface VoteSessionEntry {
  optionId: number | null;
  status: VoteStatus;
  error: string | null;
}

interface VoteSessionSlice {
  votes: Record<number, VoteSessionEntry>;
  setVoteStatus: (pollId: number, entry: VoteSessionEntry) => void;
  resetVote: (pollId: number) => void;
}

interface UiSlice {
  modal: string | null;
  theme: 'light' | 'dark';
  openModal: (id: string | null) => void;
  toggleTheme: () => void;
}

interface AuthSlice {
  staffToken: string | null;
  /** True when the user chose to proceed without a bearer token (session auth). */
  staffSessionMode: boolean;
  setStaffToken: (token: string | null) => void;
  setStaffSessionMode: (enabled: boolean) => void;
}

export const useAppStore = create<VoteSessionSlice & UiSlice & AuthSlice>()((set) => ({
  votes: {},
  setVoteStatus: (pollId, entry) =>
    set((state) => ({ votes: { ...state.votes, [pollId]: entry } })),
  resetVote: (pollId) =>
    set((state) => {
      const next = { ...state.votes };
      delete next[pollId];
      return { votes: next };
    }),

  modal: null,
  theme: 'light',
  openModal: (id) => set({ modal: id }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  staffToken: null,
  staffSessionMode: false,
  setStaffToken: (token) => set({ staffToken: token }),
  setStaffSessionMode: (enabled) => set({ staffSessionMode: enabled }),
}));
