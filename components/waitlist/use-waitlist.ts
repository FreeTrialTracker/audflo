'use client';

import { create } from 'zustand';

type EntryContext = 'default' | 'signin';

interface WaitlistStore {
  isWaitlistOpen: boolean;
  isPaywallOpen: boolean;
  source: string;
  entryContext: EntryContext;
  openWaitlist: (source: string, entryContext?: EntryContext) => void;
  closeWaitlist: () => void;
  openPaywall: (source?: string) => void;
  closePaywall: () => void;
}

export const useWaitlist = create<WaitlistStore>((set) => ({
  isWaitlistOpen: false,
  isPaywallOpen: false,
  source: 'unknown',
  entryContext: 'default',
  openWaitlist: (source, entryContext = 'default') =>
    set({ isWaitlistOpen: true, source, entryContext }),
  closeWaitlist: () => set({ isWaitlistOpen: false }),
  openPaywall: (source = 'paywall') =>
    set({ isPaywallOpen: true, source }),
  closePaywall: () => set({ isPaywallOpen: false }),
}));
