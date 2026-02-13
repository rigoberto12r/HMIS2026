import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * 🎨 HMIS Premium Theme Configuration
 *
 * Features:
 * - Full dark mode support (class-based)
 * - Custom glass morphism utilities
 * - Gradient presets
 * - Theme-aware shadows
 * - Medical-specific colors
 */

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--color-accent-50) / <alpha-value>)',
          100: 'rgb(var(--color-accent-100) / <alpha-value>)',
          200: 'rgb(var(--color-accent-200) / <alpha-value>)',
          300: 'rgb(var(--color-accent-300) / <alpha-value>)',
          400: 'rgb(var(--color-accent-400) / <alpha-value>)',
          500: 'rgb(var(--color-accent-500) / <alpha-value>)',
          600: 'rgb(var(--color-accent-600) / <alpha-value>)',
          700: 'rgb(var(--color-accent-700) / <alpha-value>)',
          800: 'rgb(var(--color-accent-800) / <alpha-value>)',
          900: 'rgb(var(--color-accent-900) / <alpha-value>)',
        },
        surface: {
          50: 'rgb(var(--color-surface-50) / <alpha-value>)',
          100: 'rgb(var(--color-surface-100) / <alpha-value>)',
          200: 'rgb(var(--color-surface-200) / <alpha-value>)',
          300: 'rgb(var(--color-surface-300) / <alpha-value>)',
          400: 'rgb(var(--color-surface-400) / <alpha-value>)',
          500: 'rgb(var(--color-surface-500) / <alpha-value>)',
          600: 'rgb(var(--color-surface-600) / <alpha-value>)',
          700: 'rgb(var(--color-surface-700) / <alpha-value>)',
          800: 'rgb(var(--color-surface-800) / <alpha-value>)',
          900: 'rgb(var(--color-surface-900) / <alpha-value>)',
        },
        // Keep neutral as alias of surface for backward compatibility
        neutral: {
          50: 'rgb(var(--color-surface-50) / <alpha-value>)',
          100: 'rgb(var(--color-surface-100) / <alpha-value>)',
          200: 'rgb(var(--color-surface-200) / <alpha-value>)',
          300: 'rgb(var(--color-surface-300) / <alpha-value>)',
          400: 'rgb(var(--color-surface-400) / <alpha-value>)',
          500: 'rgb(var(--color-surface-500) / <alpha-value>)',
          600: 'rgb(var(--color-surface-600) / <alpha-value>)',
          700: 'rgb(var(--color-surface-700) / <alpha-value>)',
          800: 'rgb(var(--color-surface-800) / <alpha-value>)',
          900: 'rgb(var(--color-surface-900) / <alpha-value>)',
        },
        secondary: {
          50: 'rgb(var(--color-accent-50) / <alpha-value>)',
          100: 'rgb(var(--color-accent-100) / <alpha-value>)',
          200: 'rgb(var(--color-accent-200) / <alpha-value>)',
          300: 'rgb(var(--color-accent-300) / <alpha-value>)',
          400: 'rgb(var(--color-accent-400) / <alpha-value>)',
          500: 'rgb(var(--color-accent-500) / <alpha-value>)',
          600: 'rgb(var(--color-accent-600) / <alpha-value>)',
          700: 'rgb(var(--color-accent-700) / <alpha-value>)',
          800: 'rgb(var(--color-accent-800) / <alpha-value>)',
          900: 'rgb(var(--color-accent-900) / <alpha-value>)',
        },
        medical: {
          red: 'rgb(var(--color-danger) / <alpha-value>)',
          'red-light': '#FEE2E2',
          orange: 'rgb(var(--color-warning) / <alpha-value>)',
          'orange-light': '#FFF7ED',
          green: 'rgb(var(--color-success) / <alpha-value>)',
          'green-light': '#F0FDF4',
          blue: 'rgb(var(--color-info) / <alpha-value>)',
          'blue-light': '#EFF6FF',
          yellow: 'rgb(var(--color-warning) / <alpha-value>)',
        },
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -3px rgba(0, 0, 0, 0.04)',
        'sidebar': '2px 0 12px 0 rgba(0, 0, 0, 0.1)',
        'glow-primary': 'var(--shadow-glow-primary)',
        'glow-accent': 'var(--shadow-glow-accent)',
        'glow-danger': 'var(--shadow-glow-danger)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'mesh-gradient': 'meshGradient 8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      // Add background colors using CSS variables
      backgroundColor: {
        'body': 'rgb(var(--bg-body) / <alpha-value>)',
        'card': 'rgb(var(--bg-card) / <alpha-value>)',
        'elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        'hover': 'rgb(var(--bg-hover) / <alpha-value>)',
        'active': 'rgb(var(--bg-active) / <alpha-value>)',
      },
      textColor: {
        'primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
        'disabled': 'rgb(var(--text-disabled) / <alpha-value>)',
        'inverse': 'rgb(var(--text-inverse) / <alpha-value>)',
      },
    },
  },
  plugins: [
    // ══════════════════════════════════════════════════════════════
    // 🎨 Glass Morphism Plugin
    // ══════════════════════════════════════════════════════════════
    plugin(({ addUtilities }) => {
      addUtilities({
        '.glass-card': {
          background: 'var(--glass-medium)',
          backdropFilter: 'blur(var(--glass-backdrop-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-backdrop-blur))',
          borderWidth: '1px',
          borderColor: 'var(--glass-border)',
        },
        '.glass-panel': {
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(calc(var(--glass-backdrop-blur) * 1.5))',
          WebkitBackdropFilter: 'blur(calc(var(--glass-backdrop-blur) * 1.5))',
          borderWidth: '1px',
          borderColor: 'var(--glass-border)',
          boxShadow: 'var(--shadow-card-md)',
        },
        '.glass-overlay': {
          background: 'var(--glass-weak)',
          backdropFilter: 'blur(calc(var(--glass-backdrop-blur) * 0.75))',
          WebkitBackdropFilter: 'blur(calc(var(--glass-backdrop-blur) * 0.75))',
          borderWidth: '1px',
          borderColor: 'var(--glass-border)',
        },
      });
    }),

    // ══════════════════════════════════════════════════════════════
    // 🎨 Gradient Utilities Plugin
    // ══════════════════════════════════════════════════════════════
    plugin(({ addUtilities }) => {
      addUtilities({
        '.bg-gradient-primary': {
          background: 'var(--gradient-primary)',
        },
        '.bg-gradient-accent': {
          background: 'var(--gradient-accent)',
        },
        '.bg-gradient-sidebar': {
          background: 'var(--gradient-sidebar)',
        },
        '.bg-gradient-danger': {
          background: 'var(--gradient-danger)',
        },
        '.bg-gradient-success': {
          background: 'var(--gradient-success)',
        },
        '.bg-gradient-warning': {
          background: 'var(--gradient-warning)',
        },
        '.bg-gradient-card-glow': {
          background: 'var(--gradient-card-glow)',
        },
      });
    }),

    // ══════════════════════════════════════════════════════════════
    // 🌟 Theme-Aware Shadow Utilities
    // ══════════════════════════════════════════════════════════════
    plugin(({ addUtilities }) => {
      addUtilities({
        '.shadow-card-sm': {
          boxShadow: 'var(--shadow-card-sm)',
        },
        '.shadow-card-md': {
          boxShadow: 'var(--shadow-card-md)',
        },
        '.shadow-card-lg': {
          boxShadow: 'var(--shadow-card-lg)',
        },
        '.shadow-glow-success': {
          boxShadow: 'var(--shadow-glow-success)',
        },
      });
    }),

    // ══════════════════════════════════════════════════════════════
    // 🎨 Premium Card Variants
    // ══════════════════════════════════════════════════════════════
    plugin(({ addComponents }) => {
      addComponents({
        '.premium-card': {
          backgroundColor: 'rgb(var(--bg-card))',
          borderRadius: '1rem',
          borderWidth: '1px',
          borderColor: 'rgb(var(--color-surface-200) / 0.5)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-card-md)',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: 'var(--shadow-card-lg)',
            transform: 'translateY(-2px)',
          },
          '@media (prefers-color-scheme: dark)': {
            borderColor: 'rgb(var(--color-surface-200) / 0.1)',
          },
        },
        '.premium-card-flat': {
          backgroundColor: 'rgb(var(--bg-card))',
          borderRadius: '0.75rem',
          borderWidth: '1px',
          borderColor: 'rgb(var(--color-surface-200) / 0.5)',
          padding: '1rem',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgb(var(--bg-hover))',
          },
        },
      });
    }),

    // ══════════════════════════════════════════════════════════════
    // 🎨 Smooth Theme Transition Utilities
    // ══════════════════════════════════════════════════════════════
    plugin(({ addUtilities }) => {
      addUtilities({
        '.theme-transition': {
          transition: 'background-color var(--theme-transition-duration) var(--theme-transition-easing), border-color var(--theme-transition-duration) var(--theme-transition-easing), color var(--theme-transition-duration) var(--theme-transition-easing)',
        },
        '.theme-transition-fast': {
          transition: 'background-color 150ms var(--theme-transition-easing), border-color 150ms var(--theme-transition-easing), color 150ms var(--theme-transition-easing)',
        },
        '.theme-transition-slow': {
          transition: 'background-color 300ms var(--theme-transition-easing), border-color 300ms var(--theme-transition-easing), color 300ms var(--theme-transition-easing)',
        },
      });
    }),
  ],
};

export default config;
