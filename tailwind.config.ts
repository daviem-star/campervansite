/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: "#05070f",
          surface: "#060a13",
          "surface-alt": "#060b14",
          panel: "#090e1a",
          "panel-alt": "#0b111f",
          map: "#0b1220",
          raised: "#0d1322",
          "raised-2": "#141b2e",
          chrome: "#111827",
          "chrome-soft": "#101625",
          "chrome-hover": "#11172a",
          border: "#1f2740",
          "border-soft": "#334155",
          "nav-active": "#171d47",
          "nav-sub-active": "#152042",
          "nav-border": "#2c3372",
          accent: "#3856ff",
          "accent-strong": "#1d2d75",
          "accent-border": "#334ac2",
          "accent-deep": "#1f2f7f",
          overlay: "#0f172a",
        },
        green: {
          50: '#30AF5B',
          90: '#292C27',
        },
        gray: {
          10: '#EEEEEE',
          20: '#A2A2A2',
          30: '#7B7B7B',
          50: '#585858',
          90: '#141414',
        },
        orange: {
          50: '#FF814C',
        },
        blue: {
          70: '#021639',
        },
        yellow: {
          50: '#FEC601',
        },
      },
      backgroundImage: {
        'bg-img-1': "url('/img-1.png')",
        'bg-img-2': "url('/img-2.png')",
        'feature-bg': "url('/feature-bg.png')",
        pattern: "url('/pattern.png')",
        'pattern-2': "url('/pattern-bg.png')",
      },
      screens: {
        xs: '400px',
        '3xl': '1680px',
        '4xl': '2200px',
      },
      maxWidth: {
        '10xl': '1512px',
      },
      borderRadius: {
        '5xl': '40px',
      },
    },
  },
  plugins: [],
};
