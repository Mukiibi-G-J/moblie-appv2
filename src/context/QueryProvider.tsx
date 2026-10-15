import React, {useState} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {getQueryClient} from '../query/queryClient';

export function QueryProvider({children}: {children: React.ReactNode}) {
  const [client] = useState(() => getQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
