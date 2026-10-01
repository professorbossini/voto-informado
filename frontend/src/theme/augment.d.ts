import type {} from '@mui/material/themeCssVarsAugmentation';

declare module '@mui/material/styles' {
  interface PaletteColor {
    /** Low-emphasis background for chips, alerts and tonal buttons (M3 "container"). */
    container: string;
    /** Text/icon color on top of `container`. */
    onContainer: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
  interface Palette {
    lime: Palette['primary'];
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    lime?: PaletteOptions['primary'];
    neutral?: PaletteOptions['primary'];
  }
  interface TypeBackground {
    /** Slightly tinted surface for inputs and secondary panels. */
    subtle: string;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    lime: true;
  }
  interface ButtonPropsVariantOverrides {
    tonal: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    lime: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    lime: true;
  }
  interface ChipPropsVariantOverrides {
    soft: true;
  }
}

declare module '@mui/material/LinearProgress' {
  interface LinearProgressPropsColorOverrides {
    lime: true;
  }
}
