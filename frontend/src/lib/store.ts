import { create } from 'zustand';

export type VoteStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface VoteSessionEntry {
  optionId: number | null;
  status: VoteStatus;
  error: string | null;
}

const VOTES_STORAGE_KEY = 'cvp:vote-session';

/** Load persisted vote session entries (survives browser reloads). */
function loadPersistedVotes(): Record<number, VoteSessionEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([key, value]) =>
        /^\d+$/.test(key) &&
        typeof value === 'object' &&
        value !== null &&
        typeof (value as VoteSessionEntry).status === 'string',
    );
    return Object.fromEntries(
      entries.map(([key, value]) => [key, value as VoteSessionEntry]),
    );
  } catch {
    return {};
  }
}

function persistVotes(votes: Record<number, VoteSessionEntry>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Storage unavailable (private mode/quota) — in-memory state still works.
  }
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
  votes: loadPersistedVotes(),
  setVoteStatus: (pollId, entry) =>
    set((state) => {
      const votes = { ...state.votes, [pollId]: entry };
      persistVotes(votes);
      return { votes };
    }),
  resetVote: (pollId) =>
    set((state) => {
      const votes = { ...state.votes };
      delete votes[pollId];
      persistVotes(votes);
      return { votes };
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
