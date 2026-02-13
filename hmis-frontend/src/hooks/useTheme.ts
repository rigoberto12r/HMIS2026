'use client';

import { create } from 'zustand';
import { useEffect } from 'react';

/**
 * 🎨 Premium Dark Mode System - SaaS Level
 *
 * Features:
 * - System preference detection
 * - Smooth transitions (200ms)
 * - FOUC prevention (Flash of Unstyled Content)
 * - Persistent storage (localStorage)
 * - Media query listener for system changes
 */

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;                     // User preference ('light' | 'dark' | 'system')
  resolved: 'light' | 'dark';       // Actual active theme
  systemTheme: 'light' | 'dark';    // Current system preference
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const THEME_STORAGE_KEY = 'hmis_theme';
const TRANSITION_DURATION = 200; // ms - matches CSS var(--theme-transition-duration)

/**
 * Detects system color scheme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolves theme setting to actual theme
 * 'system' → detects from OS, others pass through
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

/**
 * Applies theme to DOM with smooth transition
 * - Adds 'transitioning' class to enable CSS transitions
 * - Updates 'dark' class on <html>
 * - Removes 'transitioning' after animation completes
 */
function applyTheme(resolved: 'light' | 'dark', enableTransition = true) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Enable smooth transitions
  if (enableTransition) {
    root.classList.add('transitioning');
  }

  // Apply dark mode class
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Remove transitioning class after animation
  if (enableTransition) {
    setTimeout(() => {
      root.classList.remove('transitioning');
    }, TRANSITION_DURATION);
  }
}

/**
 * Zustand store for theme state
 */
export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark',
  resolved: 'dark',
  systemTheme: 'dark',
  isTransitioning: false,

  setTheme: (theme: Theme) => {
    const resolved = resolveTheme(theme);

    // Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }

    // Apply to DOM with transition
    set({ isTransitioning: true });
    applyTheme(resolved, true);

    // Update state
    set({
      theme,
      resolved,
      isTransitioning: false
    });
  },

  toggleTheme: () => {
    const current = get().resolved;
    const next: Theme = current === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

/**
 * Hook to access theme state and controls
 *
 * Usage:
 * ```tsx
 * const { theme, setTheme, toggleTheme, systemTheme } = useTheme();
 *
 * <button onClick={toggleTheme}>Toggle Dark Mode</button>
 * <select onChange={(e) => setTheme(e.target.value)}>
 *   <option value="light">Light</option>
 *   <option value="dark">Dark</option>
 *   <option value="system">System</option>
 * </select>
 * ```
 */
export function useTheme() {
  const store = useThemeStore();

  // Initialize from localStorage + listen for system changes
  useEffect(() => {
    // 1. Get stored preference or default to 'dark'
    const stored = (typeof localStorage !== 'undefined'
      ? localStorage.getItem(THEME_STORAGE_KEY)
      : null) as Theme | null;

    const theme = stored || 'dark';
    const systemTheme = getSystemTheme();
    const resolved = resolveTheme(theme);

    // 2. Apply immediately (no transition on first load to prevent FOUC)
    applyTheme(resolved, false);

    // 3. Update store
    useThemeStore.setState({ theme, resolved, systemTheme });

    // 4. Listen for system theme changes (only if user chose 'system')
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      useThemeStore.setState({ systemTheme: newSystemTheme });

      // Only apply if user preference is 'system'
      const currentTheme = useThemeStore.getState().theme;
      if (currentTheme === 'system') {
        applyTheme(newSystemTheme, true);
        useThemeStore.setState({ resolved: newSystemTheme });
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  return {
    theme: store.theme,
    resolved: store.resolved,
    systemTheme: store.systemTheme,
    setTheme: store.setTheme,
    toggleTheme: store.toggleTheme,
    isTransitioning: store.isTransitioning,
  };
}
