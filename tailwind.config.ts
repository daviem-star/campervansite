/** @type {import('tailwindcss').Config} */
const withOpacity = (variableName: string) => `rgb(var(${variableName}) / <alpha-value>)`;

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: withOpacity('--color-app-bg'),
          surface: withOpacity('--color-app-surface'),
          'surface-muted': withOpacity('--color-app-surface-muted'),
          border: withOpacity('--color-app-border'),
          text: withOpacity('--color-app-text'),
          muted: withOpacity('--color-app-muted'),
          overlay: withOpacity('--color-app-overlay'),
        },
        brand: {
          primary: withOpacity('--color-brand-primary'),
          'primary-variant': withOpacity('--color-brand-primary-variant'),
          secondary: withOpacity('--color-brand-secondary'),
          'secondary-variant': withOpacity('--color-brand-secondary-variant'),
          support: withOpacity('--color-brand-support'),
          'on-primary': withOpacity('--color-brand-on-primary'),
          'on-secondary': withOpacity('--color-brand-on-secondary'),
          'on-support': withOpacity('--color-brand-on-support'),
        },
        state: {
          neutral: withOpacity('--color-state-neutral'),
          'neutral-surface': withOpacity('--color-state-neutral-surface'),
          'neutral-border': withOpacity('--color-state-neutral-border'),
          info: withOpacity('--color-state-info'),
          'info-surface': withOpacity('--color-state-info-surface'),
          'info-border': withOpacity('--color-state-info-border'),
          success: withOpacity('--color-state-success'),
          'success-surface': withOpacity('--color-state-success-surface'),
          'success-border': withOpacity('--color-state-success-border'),
          warning: withOpacity('--color-state-warning'),
          'warning-surface': withOpacity('--color-state-warning-surface'),
          'warning-border': withOpacity('--color-state-warning-border'),
          error: withOpacity('--color-state-error'),
          'error-surface': withOpacity('--color-state-error-surface'),
          'error-border': withOpacity('--color-state-error-border'),
        },
      },
    },
  },
  plugins: [],
};
