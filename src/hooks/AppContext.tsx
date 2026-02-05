import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAppState } from './useAppState';
import type { UseAppStateReturn } from './useAppState';

const AppContext = createContext<UseAppStateReturn | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const appState = useAppState();

  return (
    <AppContext.Provider value={appState}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): UseAppStateReturn {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
