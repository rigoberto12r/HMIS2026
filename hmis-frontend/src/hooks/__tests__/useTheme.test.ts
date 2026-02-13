/**
 * 🎨 useTheme Hook Tests
 *
 * Tests para el sistema de temas premium
 */

import { renderHook, act } from '@testing-library/react';
import { useTheme, useThemeStore } from '../useTheme';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('useTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset store
    useThemeStore.setState({
      theme: 'dark',
      resolved: 'dark',
      systemTheme: 'dark',
      isTransitioning: false,
    });
  });

  it('should initialize with default dark theme', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('should change theme when setTheme is called', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });

  it('should toggle between light and dark', () => {
    const { result } = renderHook(() => useTheme());

    // Start with dark
    expect(result.current.resolved).toBe('dark');

    // Toggle to light
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolved).toBe('light');

    // Toggle back to dark
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolved).toBe('dark');
  });

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(localStorage.getItem('hmis_theme')).toBe('light');
  });

  it('should load theme from localStorage on mount', () => {
    localStorage.setItem('hmis_theme', 'light');

    const { result } = renderHook(() => useTheme());

    // Give effect time to run
    act(() => {
      // Effects run after initial render
    });

    expect(result.current.theme).toBe('light');
  });

  it('should resolve system theme when theme is "system"', () => {
    // Mock system preference to dark
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolved).toBe('dark');
  });

  it('should detect system theme change when theme is "system"', () => {
    let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

    // Mock matchMedia with listener capture
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) => {
        mediaQueryListener = listener;
      },
      removeEventListener: jest.fn(),
    }));

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    // Simulate system theme change to light
    if (mediaQueryListener) {
      act(() => {
        mediaQueryListener!({
          matches: false,
          media: '(prefers-color-scheme: dark)',
        } as MediaQueryListEvent);
      });
    }

    expect(result.current.resolved).toBe('light');
  });

  it('should expose systemTheme', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.systemTheme).toBeDefined();
    expect(['light', 'dark']).toContain(result.current.systemTheme);
  });

  it('should track isTransitioning state', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.isTransitioning).toBe(false);

    // Note: isTransitioning is set to true briefly during setTheme
    // but is immediately set to false, so we can't easily test it
    // without mocking timers. Just verify it's exposed.
    expect(typeof result.current.isTransitioning).toBe('boolean');
  });
});

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useThemeStore.setState({
      theme: 'dark',
      resolved: 'dark',
      systemTheme: 'dark',
      isTransitioning: false,
    });
  });

  it('should update state when setTheme is called', () => {
    const initialState = useThemeStore.getState();
    expect(initialState.theme).toBe('dark');

    act(() => {
      useThemeStore.getState().setTheme('light');
    });

    const newState = useThemeStore.getState();
    expect(newState.theme).toBe('light');
    expect(newState.resolved).toBe('light');
  });

  it('should update state when toggleTheme is called', () => {
    const initialState = useThemeStore.getState();
    expect(initialState.resolved).toBe('dark');

    act(() => {
      useThemeStore.getState().toggleTheme();
    });

    const newState = useThemeStore.getState();
    expect(newState.resolved).toBe('light');
  });
});
