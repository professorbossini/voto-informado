/** Chart colors, validated with the dataviz palette validator against the site surfaces (light #FFFFFF, dark #1C1433). */
/** Single-series mark color: violet in light mode, light violet in dark (validated ≥3:1 on both surfaces). */
export const SERIES = { light: '#5B2DB0', dark: '#9674E0' } as const;
/** Categorical slots for nominal part-to-whole (validated all-pairs, light/dark). */
export const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a'],
  dark: ['#3987e5', '#d95926', '#199e70'],
} as const;
