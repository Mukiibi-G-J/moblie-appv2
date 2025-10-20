import React, {createContext, useContext} from 'react';
import {useTenant} from '../hooks/useTenant';

interface TenantContextType {
  currentTenant: string | null;
  isLoading: boolean;
  error: Error | null;
  changeTenant: (newTenant: string) => Promise<void>;
  retryConnection: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({children}: {children: React.ReactNode}) {
  const tenantState = useTenant();

  return (
    <TenantContext.Provider value={tenantState}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}
