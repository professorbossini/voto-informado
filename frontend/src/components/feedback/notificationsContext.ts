import { createContext, useContext, type ReactNode } from 'react';
import type { AlertColor } from '@mui/material';

export type Notify = (message: ReactNode, severity?: AlertColor) => void;

export const NotificationsContext = createContext<Notify>(() => {});

export function useNotify(): Notify {
  return useContext(NotificationsContext);
}
