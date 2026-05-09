import React, { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import AppShell from '@/components/AppShell';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Repositories from '@/pages/Repositories';
import Graph from '@/pages/Graph';
import NotFound from '@/pages/NotFound';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

import '@solana/wallet-adapter-react-ui/styles.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AuthProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/repositories" element={<ProtectedRoute><Repositories /></ProtectedRoute>} />
                <Route path="/graph" element={<ProtectedRoute><Graph /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          </AuthProvider>
          <Toaster />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
