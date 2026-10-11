import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;
const status = ['submitted', 'triaged', 'assigned', 'progress', 'info', 'resolved', 'closed', 'rejected', 'reopened'];

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nmc: {
          DEFAULT: 'rgb(var(--nmc-green-rgb) / <alpha-value>)',
          600: 'rgb(var(--nmc-green-600-rgb) / <alpha-value>)',
        },
        canopy: 'rgb(var(--canopy-rgb) / <alpha-value>)',
        paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
        surface: v('surface'),
        ink: { DEFAULT: v('ink'), muted: v('ink-muted') },
        line: v('line'),
        marigold: 'rgb(var(--marigold-rgb) / <alpha-value>)',
        mint: 'rgb(var(--mint-rgb) / <alpha-value>)',
        coral: { DEFAULT: v('coral'), ink: v('coral-ink') },
        river: v('river'),
        st: Object.fromEntries(
          status.flatMap((s) => [
            [s, v(`st-${s}`)],
            [`${s}-bg`, v(`st-${s}-bg`)],
          ]),
        ),
        sla: { ok: v('sla-ok'), risk: v('sla-risk'), breach: v('sla-breach'), paused: v('sla-paused') },
      },
      borderRadius: { sm: v('radius-sm'), md: v('radius-md'), lg: v('radius-lg') },
      fontFamily: {
        heading: ['"DM Serif Display"', '"Anek Devanagari"', 'serif'],
        sans: ['"DM Sans"', 'Mukta', 'sans-serif'],
      },
      fontSize: {
        xs: '14px',
        sm: '14px',
        base: '16px',
        lg: '20px',
        xl: '25px',
        '2xl': '31px',
        '3xl': '39px',
        '4xl': '49px',
      },
    },
  },
} satisfies Config;
