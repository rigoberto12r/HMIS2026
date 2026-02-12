'use client';

import { create } from 'zustand';
import { useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  resolved: 'light',
  setTheme: (theme: Theme) => {
    const resolved = resolveTheme(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hmis_theme', theme);
    }
    applyTheme(resolved);
    set({ theme, resolved });
  },
  toggle: () => {
    const current = get().resolved;
    const next = current === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

export function useTheme() {
  const store = useThemeStore();

  // Initialize from localStorage + listen for system changes
  useEffect(() => {
    const stored = localStorage.getItem('hmis_theme') as Theme | null;
    const theme = stored || 'light';
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    useThemeStore.setState({ theme, resolved });

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        useThemeStore.setState({ resolved: newResolved });
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return store;
}
