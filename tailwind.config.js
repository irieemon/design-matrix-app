/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // Explicitly list only production directories to avoid permission-denied directories
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "!./src/components/dev/**",
    "!./src/components/test/**",
    "./src/contexts/**/*.{js,ts,jsx,tsx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/styles/**/*.{js,ts,jsx,tsx}",
    "./src/types/**/*.{js,ts,jsx,tsx}",
    "./src/utils/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Brand Color System for Clean Light Theme
      colors: {
        // Primary brand colors
        brand: {
          primary: '#000000',      // Pure black for text and primary elements
          secondary: '#6C6C6C',    // Muted gray for secondary text
        },

        // Clean neutral palette for light theme
        neutral: {
          50: '#FAFBFC',           // Lightest background
          100: '#F9FAFB',          // Card/surface backgrounds
          150: '#F4F6F8',          // Subtle contrast backgrounds
          200: '#E5E7EB',          // Light borders and dividers
          300: '#D1D5DB',          // Medium borders
          400: '#9CA3AF',          // Placeholder text
          500: '#6B7280',          // Body text secondary
          600: '#4B5563',          // Body text primary
          700: '#374151',          // Headings
          800: '#1F2937',          // Dark text
          900: '#111827',          // Darkest text
        },

        // ANIMATED LUX: Graphite Text Hierarchy
        graphite: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },

        // ANIMATED LUX: Canvas & Surface Colors
        canvas: {
          primary: '#FAFBFC',
          secondary: '#F9FAFB',
          tertiary: '#F3F4F6',
        },
        surface: {
          primary: '#FFFFFF',
          secondary: '#FEFEFE',
        },

        // ANIMATED LUX: Hairline Borders
        hairline: {
          default: '#E8EBED',
          hover: '#D1D5DB',
          focus: '#3B82F6',
        },

        // Semantic status colors
        success: {
          50: '#E9FCEB',           // Light success background
          100: '#D1F7D6',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#3CCF4E',          // Success primary
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },

        info: {
          50: '#EEF3FD',           // Light info background
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#5B8DEF',          // Info primary
          600: '#3B82F6',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },

        warning: {
          50: '#FFFBEB',           // Light warning background
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#FFCC00',          // Warning primary
          600: '#F59E0B',
          700: '#D97706',
          800: '#B45309',
          900: '#92400E',
        },

        error: {
          50: '#FFECEC',           // Light error background
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#FF6B6B',          // Error primary
          600: '#EF4444',
          700: '#DC2626',
          800: '#B91C1C',
          900: '#991B1B',
        },

        accent: {
          50: '#F2EFFF',           // Light accent background
          100: '#E9E5FF',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#A28CFF',          // Accent primary
          600: '#8B5CF6',
          700: '#7C3AED',
          800: '#6D28D9',
          900: '#5B21B6',
        },

        // Monochrome-Lux gem-tone accents
        sapphire: {
          50: '#EFF6FF',           // Soft sapphire tint
          700: '#1D4ED8',          // Strong sapphire foreground
        },
        emerald: {
          50: '#ECFDF5',           // Soft emerald tint
          700: '#047857',          // Strong emerald foreground
        },
        amber: {
          50: '#FFFBEB',           // Soft amber tint
          700: '#B45309',          // Strong amber foreground
        },
        garnet: {
          50: '#FEF2F2',           // Soft garnet tint
          700: '#B91C1C',          // Strong garnet foreground
        },

        // Component state colors (addressing analysis gaps)
        disabled: {
          bg: '#F3F4F6',           // Disabled background
          text: '#9CA3AF',         // Disabled text
          border: '#E5E7EB',       // Disabled borders
        },

        loading: {
          bg: '#F9FAFB',           // Loading background
          text: '#6B7280',         // Loading text
          accent: '#3B82F6',       // Loading accent
        },

        // Semantic component tokens (unifying design system)
        component: {
          surface: '#FFFFFF',      // Component surface
          border: '#E5E7EB',       // Component borders
          focus: '#3B82F6',        // Focus indication
          hover: '#F3F4F6',        // Hover states
          active: '#E5E7EB',       // Active states
        }
      },

      // Typography scale aligned with brand standards
      fontSize: {
        'xs': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'base': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'lg': ['18px', { lineHeight: '28px', fontWeight: '500' }],
        'xl': ['20px', { lineHeight: '30px', fontWeight: '600' }],
        '2xl': ['24px', { lineHeight: '36px', fontWeight: '600' }],
        '3xl': ['32px', { lineHeight: '48px', fontWeight: '700' }],
      },

      // Font weights for clean hierarchy
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // Sophisticated shadow system for depth
      boxShadow: {
        'card': '0px 2px 6px rgba(0, 0, 0, 0.05)',                    // Subtle card elevation
        'card-hover': '0px 4px 10px rgba(0, 0, 0, 0.08)',           // Card hover state
        'modal': '0px 10px 25px rgba(0, 0, 0, 0.1)',                // Modal overlay
        'sidebar': '2px 0px 8px rgba(0, 0, 0, 0.04)',               // Sidebar depth
        'button': '0px 1px 3px rgba(0, 0, 0, 0.1)',                 // Button depth
        'button-hover': '0px 2px 6px rgba(0, 0, 0, 0.15)',          // Button hover
        'input-focus': '0px 0px 0px 3px rgba(91, 141, 239, 0.1)',   // Focus ring
        'dropdown': '0px 4px 12px rgba(0, 0, 0, 0.1)',              // Dropdown menus
        'none': 'none',

        // ANIMATED LUX: Width-Dominant Shadows (never darker)
        'button-lux': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'button-lux-hover': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-lux': '0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 24px rgba(0, 0, 0, 0.03)',
        'card-lux-hover': '0 1px 3px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.05)',
        'modal-lux': '0 4px 16px rgba(0, 0, 0, 0.08), 0 20px 48px rgba(0, 0, 0, 0.12)',
        'focus-ring-lux': '0 0 0 4px rgba(59, 130, 246, 0.1)',
      },

      // Border radius system for clean aesthetics
      borderRadius: {
        'none': '0px',
        'sm': '4px',             // Small elements (tags, badges)
        'DEFAULT': '6px',        // Default inputs, buttons
        'md': '8px',             // Cards, panels
        'lg': '12px',            // Large cards, modals
        'xl': '16px',            // Hero sections
        'full': '9999px',        // Pills, avatars
      },

      // Spacing scale based on 8px grid
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '14px',
        '4.5': '18px',
        '5.5': '22px',
        '6.5': '26px',
        '7.5': '30px',
        '8.5': '34px',
        '9.5': '38px',
        '13': '52px',
        '15': '60px',
        '17': '68px',
        '18': '72px',
        '19': '76px',
        '21': '84px',
        '22': '88px',
        '25': '100px',
        '30': '120px',
        '35': '140px',
        '40': '160px',
        '45': '180px',
        '50': '200px',
        '60': '240px',           // Sidebar width
        '70': '280px',
        '80': '320px',
        '90': '360px',
        '100': '400px',
        // Semantic spacing tokens (unifying design system)
        'component-xs': '8px',       // Tight component spacing
        'component-sm': '12px',      // Small component spacing
        'component-md': '16px',      // Standard component spacing
        'component-lg': '24px',      // Large component spacing
        'section-gap': '32px',       // Gap between page sections
        'page-padding': '48px',      // Page container padding
        'sidebar-width': '240px',    // Sidebar standard width
        'sidebar-collapsed': '80px', // Sidebar collapsed width
        'modal-padding': '24px',     // Modal content padding
        'card-padding': '20px',      // Card content padding
      },

      // Enhanced animations for smooth interactions
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-subtle': 'pulseSubtle 2s infinite',
        'bounce-gentle': 'bounceGentle 1s infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },

      // Transition timing for consistency
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',

        // ANIMATED LUX: Motion System Durations
        '120': '120ms',   // instant
        '140': '140ms',   // fast
        '190': '190ms',   // base
        '220': '220ms',   // moderate
        '260': '260ms',   // slow
      },

      transitionTimingFunction: {
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0.0, 0.2, 1)',

        // ANIMATED LUX: Confident Glide Easing
        'glide': 'cubic-bezier(0.2, 0.6, 0, 0.98)',
      },

      // Z-index scale for layering
      zIndex: {
        '1': '1',
        '5': '5',
        '15': '15',
        '25': '25',
        '35': '35',
        '45': '45',
        '55': '55',
        'dropdown': '100',
        'modal': '200',
        'tooltip': '300',
        'notification': '400',
      },

      // Backdrop blur for modern glass effects
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [],
}