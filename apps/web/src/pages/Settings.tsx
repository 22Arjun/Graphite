import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Hexagon,
  Github,
  User,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, profileApi } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5 },
  }),
};

const Settings: React.FC = () => {
  const { builder: authBuilder, connectGitHub } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Show OAuth error if redirected with error param
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'github_denied') {
      toast({ title: 'GitHub connection cancelled', variant: 'destructive' });
    } else if (error === 'github_failed') {
      toast({ title: 'GitHub connection failed', description: 'Please try again.', variant: 'destructive' });
    } else if (error === 'invalid_callback') {
      toast({ title: 'Invalid OAuth callback', description: 'Please try connecting GitHub again.', variant: 'destructive' });
    }
  }, []);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['builderProfile'],
    queryFn: async () => {
      const response: any = await api.get('/builder/profile');
      return response.data;
    },
    retry: false,
  });

  // Populate form once data loads
  useEffect(() => {
    if (profileData) {
      setDisplayName(profileData.displayName ?? '');
      setBio(profileData.bio ?? '');
    }
  }, [profileData]);

  const updateProfile = useMutation({
    mutationFn: () => profileApi.update({ displayName: displayName || undefined, bio: bio || undefined }),
    onSuccess: () => {
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
    },
    onError: () => {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    },
  });

  const reanalyzeAll = useMutation({
    mutationFn: () => profileApi.triggerAnalyzeAll(),
    onSuccess: () => {
      toast({ title: 'Re-analysis started', description: 'All pending and failed repos are being re-analyzed.' });
    },
    onError: () => {
      toast({ title: 'Failed to start re-analysis', variant: 'destructive' });
    },
  });

  const githubConnected = authBuilder?.githubConnected ?? !!profileData?.githubProfile;
  const githubUsername = profileData?.githubProfile?.username;
  const lastSynced = profileData?.githubProfile?.lastSyncedAt;

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-8 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* Header */}
        <motion.div custom={0} variants={fadeIn} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your builder profile and connected accounts.
          </p>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </motion.div>

        {/* Profile section */}
        <motion.div custom={1} variants={fadeIn} className="graphite-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Builder Profile</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or handle"
                className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short description of what you build..."
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Wallet Address
              </label>
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-mono text-muted-foreground">
                {profileData?.walletAddress
                  ? `${profileData.walletAddress.slice(0, 8)}...${profileData.walletAddress.slice(-6)}`
                  : '—'}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="w-full sm:w-auto"
            >
              {updateProfile.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </motion.div>

        {/* GitHub section */}
        <motion.div custom={2} variants={fadeIn} className="graphite-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Github className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">GitHub Account</h2>
          </div>

          {githubConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Connected as @{githubUsername}
                  </p>
                  {lastSynced && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last synced {new Date(lastSynced).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={connectGitHub}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Reconnect GitHub
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-sm text-foreground">GitHub not connected</p>
              </div>
              <Button
                size="sm"
                onClick={connectGitHub}
                className="w-full sm:w-auto"
              >
                <Github className="h-3.5 w-3.5 mr-2" />
                Connect GitHub
              </Button>
            </div>
          )}
        </motion.div>

        {/* Analysis section */}
        <motion.div custom={3} variants={fadeIn} className="graphite-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Analysis</h2>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Re-analyze all pending and failed repositories. This queues AI analysis for any repos
            that haven't been analyzed yet or failed in a previous run.
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={() => reanalyzeAll.mutate()}
            disabled={reanalyzeAll.isPending || !githubConnected}
            className="w-full sm:w-auto"
          >
            {reanalyzeAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            Re-analyze All Repos
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Settings;
