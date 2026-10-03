import { useEffect } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useColorScheme, useTheme } from '@mui/material/styles';
import { isNativeApp, setSystemBarsColor } from './platform';

/**
 * App-only wiring (no-op on the website): status/navigation bars (icons and background) follow
 * the light/dark theme, and the Android back button walks the in-app history before closing.
 */
export function NativeBridge() {
  const { mode, systemMode } = useColorScheme();
  const theme = useTheme();
  const dark = (mode === 'system' ? systemMode : mode) === 'dark';
  const barColor = theme.colorSchemes[dark ? 'dark' : 'light']?.palette.background.paper;

  useEffect(() => {
    if (!isNativeApp || !mode) return;
    // DARK = light icons, for the dark theme.
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
    if (barColor) setSystemBarsColor(barColor);
  }, [dark, mode, barColor]);

  useEffect(() => {
    if (!isNativeApp) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      });
      remove = () => void handle.remove();
    });
    return () => remove?.();
  }, []);

  return null;
}
