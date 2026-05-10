import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Menu, X, Hexagon, Github } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const Navbar: React.FC = () => {
  const { isAuthenticated, builder, connectGitHub } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = location.pathname === '/';

  // Fetch full profile (cached alongside Profile/Dashboard — no extra network request)
  const { data: profileData } = useQuery({
    queryKey: ['builderProfile'],
    queryFn: async () => {
      const response: any = await api.get('/builder/profile');
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });

  const avatarUrl: string | null = profileData?.avatarUrl ?? null;
  const displayName: string =
    profileData?.displayName ||
    profileData?.githubProfile?.name ||
    profileData?.githubProfile?.username ||
    builder?.walletAddress?.slice(0, 6) ||
    '';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <Hexagon className="h-8 w-8 text-primary transition-all group-hover:drop-shadow-[0_0_8px_hsl(160_84%_39%/0.5)]" strokeWidth={1.5} />
            <span className="absolute text-[10px] font-bold font-mono text-primary">G</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Graphite
          </span>
        </Link>

        {/* Desktop Navigation */}
        {isAuthenticated && !isLanding && (
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAuthenticated && !builder?.githubConnected && !isLanding && (
            <button
              onClick={connectGitHub}
              className="hidden md:flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              Connect GitHub
            </button>
          )}

          {/* Avatar + name pill (only when authenticated and not on landing) */}
          {isAuthenticated && !isLanding && (
            <Link
              to="/profile"
              className="hidden md:flex items-center gap-2 rounded-full border border-border/40 bg-surface-2 pl-0.5 pr-3 py-0.5 hover:border-primary/30 hover:bg-surface-3 transition-all"
            >
              {/* Avatar or initial */}
              <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 border border-border/50">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                    {displayName.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>
              {/* Name */}
              {displayName && (
                <span className="text-xs font-medium text-foreground max-w-[100px] truncate">
                  {displayName}
                </span>
              )}
            </Link>
          )}

          <WalletMultiButton />

          {/* Mobile menu toggle */}
          {isAuthenticated && !isLanding && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && isAuthenticated && !isLanding && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          {/* Mobile profile row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-border/50 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {displayName.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-foreground truncate">{displayName || 'Builder'}</span>
          </div>
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
