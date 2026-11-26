/** @type {import('tailwindcss').Config} */
// Colours resolve to CSS variables (see app/theme.css) so light and dark themes share every class.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (hue, steps) => Object.fromEntries(steps.map((s) => [s, v(`${hue}-${s}`)]));

module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        white: v('card'),
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), mute: v('ink-mute') },
        paper: { DEFAULT: v('paper'), card: v('card'), tint: v('tint') },
        edge: v('edge'),
        mint: scale('mint', [50, 100, 200, 500, 600, 700, 800]),
        sky: scale('sky', [50, 200, 500, 600, 700]),
        ember: scale('ember', [50, 600]),
        honey: scale('honey', [50, 600, 700]),
        plum: scale('plum', [50, 600]),
        rose: scale('rose', [50, 600]),
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), dark: v('danger-dark') },
      },
    },
  },
  plugins: [],
};
