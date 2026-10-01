import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

/** Access the current session and auth actions from any component. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
