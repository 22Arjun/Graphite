import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { api, API_URL } from '../lib/api';

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
  const { publicKey, signMessage, disconnect } = useWallet();
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const response: any = await api.get('/auth/me');
      if (response.success && response.data) {
        setBuilder(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('graphite_token');
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => logout();
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const login = async () => {
    if (!publicKey || !signMessage) throw new Error('Wallet not ready');

    try {
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
        setBuilder(response.data.builder);
        await fetchProfile(); // Fetch full profile including github
      }
    } catch (err) {
      console.error('Login failed', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('graphite_token');
    setBuilder(null);
    disconnect();
  };

  const connectGitHub = () => {
    // Redirects to backend which handles OAuth; backend redirects back to /dashboard?github=connected
    window.location.href = `${API_URL}/auth/github`;
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
