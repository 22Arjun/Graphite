import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { api } from '../lib/api';

interface Builder {
  id: string;
  walletAddress: string;
  displayName: string | null;
  githubProfile: any;
  githubConnected: boolean;
}

interface AuthContextType {
  builder: Builder | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  connectGitHub: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, signMessage, disconnect, connected } = useWallet();
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track previous connected value so we only react to transitions, not initial render
  const prevConnected = useRef<boolean | null>(null);

  // Clear auth state without touching the wallet adapter
  const clearAuth = () => {
    localStorage.removeItem('graphite_token');
    setBuilder(null);
  };

  // Full logout: clear auth + disconnect wallet
  const logout = () => {
    clearAuth();
    disconnect();
  };

  const fetchProfile = async () => {
    try {
      const response: any = await api.get('/auth/me');
      if (response.success && response.data) {
        setBuilder({
          ...response.data,
          githubConnected: !!response.data.githubProfile,
        });
      }
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('graphite_token');
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => clearAuth();
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  // Watch wallet connection — if the wallet is disconnected externally (user clicks
  // "Disconnect" in the WalletMultiButton), clear the auth session too.
  useEffect(() => {
    if (isLoading) return; // Don't react during initial load
    if (prevConnected.current === true && !connected) {
      // Wallet transitioned from connected → disconnected
      clearAuth();
    }
    prevConnected.current = connected;
  }, [connected, isLoading]);

  const login = async () => {
    if (!publicKey || !signMessage) throw new Error('Wallet not ready');

    const message = `Sign this message to authenticate with Graphite.\nTimestamp: ${Date.now()}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    const response: any = await api.post('/auth/wallet', {
      walletAddress: publicKey.toBase58(),
      signature,
      message,
    });

    if (response.success && response.data.token) {
      localStorage.setItem('graphite_token', response.data.token);
      setBuilder({ ...response.data.builder, githubConnected: !!response.data.builder.githubConnected });
      await fetchProfile();
    }
  };

  const connectGitHub = async () => {
    try {
      const response: any = await api.get('/auth/github/url');
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      console.error('Failed to get GitHub OAuth URL', err);
    }
  };

  return (
    <AuthContext.Provider value={{ builder, isLoading, login, logout, connectGitHub, isAuthenticated: !!builder }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
