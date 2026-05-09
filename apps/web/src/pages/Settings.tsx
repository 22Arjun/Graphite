import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Hexagon,
  Github,
  User,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Linkedin,
  Twitter,
  Trophy,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, profileApi, sourcesApi } from '@/lib/api';
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

// -------------------------------------------------------
// Source Card wrapper with expand/collapse
// -------------------------------------------------------
function SourceCard({
  icon: Icon,
  title,
  connected,
  connectedLabel,
  children,
  defaultOpen = false,
  colorClass = 'text-primary',
}: {
  icon: React.ElementType;
  title: string;
  connected: boolean;
  connectedLabel?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colorClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="graphite-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 ${colorClass}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {connectedLabel ?? 'Connected'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Not added
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0 border-t border-border/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------
// LinkedIn Panel
// -------------------------------------------------------
function LinkedInPanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ['sources', 'linkedin'],
    queryFn: async () => { const r: any = await sourcesApi.getLinkedIn(); return r.data; },
  });

  const [headline, setHeadline] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [company, setCompany] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [educationLevel, setEducationLevel] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  useEffect(() => {
    if (existing) {
      setHeadline(existing.headline ?? '');
      setCurrentRole(existing.currentRole ?? '');
      setCompany(existing.company ?? '');
      setYearsExperience(String(existing.yearsExperience ?? 0));
      setEducationLevel(existing.educationLevel ?? '');
      setSkillsInput((existing.skills ?? []).join(', '));
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: () => sourcesApi.saveLinkedIn({
      headline: headline || undefined,
      currentRole: currentRole || undefined,
      company: company || undefined,
      yearsExperience: parseInt(yearsExperience) || 0,
      educationLevel: educationLevel || undefined,
      skills: skillsInput ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => {
      toast({ title: 'LinkedIn data saved' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
    onError: () => toast({ title: 'Failed to save LinkedIn data', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: () => sourcesApi.deleteLinkedIn(),
    onSuccess: () => {
      toast({ title: 'LinkedIn data removed' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
  });

  const inputClass = 'w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all';

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Headline</label>
          <input className={inputClass} placeholder="Senior Engineer @ Acme" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Current Role</label>
          <input className={inputClass} placeholder="Software Engineer" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Company</label>
          <input className={inputClass} placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Years of Experience</label>
          <input className={inputClass} type="number" min="0" max="60" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Education Level</label>
          <select className={inputClass} value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
            <option value="">Select...</option>
            {['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD','BOOTCAMP','SELF_TAUGHT','OTHER'].map((v) => (
              <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Skills (comma-separated)</label>
          <input className={inputClass} placeholder="React, TypeScript, Solidity" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save LinkedIn
        </Button>
        {existing && (
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove.mutate()} disabled={remove.isPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Twitter Panel
// -------------------------------------------------------
function TwitterPanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ['sources', 'twitter'],
    queryFn: async () => { const r: any = await sourcesApi.getTwitter(); return r.data; },
  });

  const [handle, setHandle] = useState('');

  useEffect(() => {
    if (existing?.handle) setHandle(existing.handle);
  }, [existing]);

  const save = useMutation({
    mutationFn: () => sourcesApi.saveTwitter(handle),
    onSuccess: () => {
      toast({ title: 'Twitter data fetched and saved' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
    onError: () => toast({ title: 'Failed to fetch Twitter profile', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: () => sourcesApi.deleteTwitter(),
    onSuccess: () => {
      toast({ title: 'Twitter data removed' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
  });

  return (
    <div className="space-y-3 mt-3">
      {existing && (
        <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">@{existing.handle}</span>
          {' · '}{existing.followerCount.toLocaleString()} followers
          {' · '}{existing.tweetCount.toLocaleString()} tweets
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">X / Twitter Handle</label>
          <input
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all"
            placeholder="@yourhandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !handle.trim()}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Twitter className="h-3.5 w-3.5 mr-1.5" />}
          Fetch Profile
        </Button>
        {existing && (
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove.mutate()} disabled={remove.isPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Hackathon Panel
// -------------------------------------------------------
function HackathonPanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [placement, setPlacement] = useState('');
  const [prize, setPrize] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectUrl, setProjectUrl] = useState('');

  const { data: entries = [] } = useQuery({
    queryKey: ['sources', 'hackathon'],
    queryFn: async () => { const r: any = await sourcesApi.getHackathons(); return r.data ?? []; },
  });

  const resetForm = () => {
    setName(''); setYear(String(new Date().getFullYear()));
    setPlacement(''); setPrize(''); setProjectName(''); setProjectUrl('');
    setEditId(null); setShowForm(false);
  };

  const add = useMutation({
    mutationFn: () => editId
      ? sourcesApi.updateHackathon(editId, { name, year: parseInt(year), placement: placement || undefined, prize: prize || undefined, projectName: projectName || undefined, projectUrl: projectUrl || undefined })
      : sourcesApi.addHackathon({ name, year: parseInt(year), placement: placement || undefined, prize: prize || undefined, projectName: projectName || undefined, projectUrl: projectUrl || undefined }),
    onSuccess: () => {
      toast({ title: editId ? 'Hackathon updated' : 'Hackathon added' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      resetForm();
      onSaved();
    },
    onError: () => toast({ title: 'Failed to save hackathon entry', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => sourcesApi.deleteHackathon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
  });

  const startEdit = (entry: any) => {
    setEditId(entry.id);
    setName(entry.name); setYear(String(entry.year));
    setPlacement(entry.placement ?? ''); setPrize(entry.prize ?? '');
    setProjectName(entry.projectName ?? ''); setProjectUrl(entry.projectUrl ?? '');
    setShowForm(true);
  };

  const inputClass = 'w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all';

  return (
    <div className="space-y-3 mt-3">
      {(entries as any[]).map((entry: any) => (
        <div key={entry.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-foreground">{entry.name} <span className="text-muted-foreground">({entry.year})</span></p>
            {(entry.placement || entry.prize) && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {[entry.placement, entry.prize].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
              <Edit2 className="h-3 w-3" />
            </button>
            <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}

      {!showForm && (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Hackathon
        </Button>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="rounded-lg border border-border/50 bg-surface-2 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Hackathon Name *</label>
                  <input className={inputClass} placeholder="ETHGlobal NYC 2024" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Year *</label>
                  <input className={inputClass} type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Placement</label>
                  <input className={inputClass} placeholder="1st Place, Finalist..." value={placement} onChange={(e) => setPlacement(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Prize</label>
                  <input className={inputClass} placeholder="Best DeFi, $5000..." value={prize} onChange={(e) => setPrize(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Project Name</label>
                  <input className={inputClass} placeholder="My project" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Project URL</label>
                  <input className={inputClass} placeholder="https://..." value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !name.trim()}>
                  {add.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  {editId ? 'Update' : 'Add Entry'}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------
// Resume Panel
// -------------------------------------------------------
function ResumePanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['sources', 'resume'],
    queryFn: async () => { const r: any = await sourcesApi.getResume(); return r.data; },
  });

  const upload = useMutation({
    mutationFn: (file: File) => sourcesApi.uploadResume(file),
    onSuccess: () => {
      toast({ title: 'Resume parsed and saved', description: 'Skills and experience extracted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Failed to parse resume';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: () => sourcesApi.deleteResume(),
    onSuccess: () => {
      toast({ title: 'Resume data removed' });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
      onSaved();
    },
  });

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Only PDF files are accepted', variant: 'destructive' });
      return;
    }
    upload.mutate(file);
  };

  return (
    <div className="space-y-3 mt-3">
      {existing && (
        <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
          {existing.currentRole && <p className="font-medium text-foreground">{existing.currentRole}</p>}
          <p>{existing.yearsExperience} years experience · {existing.parsedSkills?.length ?? 0} skills · {existing.parsedTechStack?.length ?? 0} technologies</p>
          {existing.parsedSkills?.length > 0 && (
            <p className="truncate">{existing.parsedSkills.slice(0, 8).join(', ')}{existing.parsedSkills.length > 8 ? '...' : ''}</p>
          )}
        </div>
      )}

      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-primary/60 bg-primary/5' : 'border-border/50 hover:border-primary/40 hover:bg-surface-2'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {upload.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Parsing resume with AI...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Drop a PDF here or click to browse</p>
            <p className="text-[10px] text-muted-foreground/50">Max 10 MB · PDF only</p>
          </div>
        )}
      </div>

      {existing && (
        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => remove.mutate()} disabled={remove.isPending}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Remove Resume
        </Button>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Main Settings Page
// -------------------------------------------------------
const Settings: React.FC = () => {
  const { builder: authBuilder, connectGitHub } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

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

  const { data: sourcesSummary } = useQuery({
    queryKey: ['sources', 'summary'],
    queryFn: async () => { const r: any = await sourcesApi.getSummary(); return r.data; },
  });

  useEffect(() => {
    if (profileData) {
      setDisplayName(profileData.displayName ?? '');
      setBio(profileData.bio ?? '');
    }
  }, [profileData]);

  const updateProfile = useMutation({
    mutationFn: () => profileApi.update({ displayName: displayName || undefined, bio: bio || undefined }),
    onSuccess: () => {
      toast({ title: 'Profile updated' });
      queryClient.invalidateQueries({ queryKey: ['builderProfile'] });
    },
    onError: () => toast({ title: 'Failed to update profile', variant: 'destructive' }),
  });

  const reanalyzeAll = useMutation({
    mutationFn: () => profileApi.triggerAnalyzeAll(),
    onSuccess: () => toast({ title: 'Re-analysis started', description: 'All pending and failed repos are being re-analyzed.' }),
    onError: () => toast({ title: 'Failed to start re-analysis', variant: 'destructive' }),
  });

  const githubConnected = authBuilder?.githubConnected ?? !!profileData?.githubProfile;
  const githubUsername = profileData?.githubProfile?.username;
  const lastSynced = profileData?.githubProfile?.lastSyncedAt;

  const refreshSources = () => {
    queryClient.invalidateQueries({ queryKey: ['sources'] });
  };

  const connectedCount = [
    githubConnected,
    sourcesSummary?.linkedin?.connected,
    sourcesSummary?.twitter?.connected,
    (sourcesSummary?.hackathons?.count ?? 0) > 0,
    sourcesSummary?.resume?.connected,
  ].filter(Boolean).length;

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
            Manage your builder profile and connected reputation sources.
          </p>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </motion.div>

        {/* Sources overview */}
        <motion.div custom={1} variants={fadeIn} className="graphite-card p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Connected Reputation Sources</h2>
            <span className="text-xs font-mono text-primary">{connectedCount} / 5</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            More sources = higher score accuracy and confidence. GitHub is always primary.
          </p>
          <div className="flex gap-1.5">
            {[
              { label: 'GitHub', active: githubConnected, color: 'bg-emerald-500' },
              { label: 'LinkedIn', active: sourcesSummary?.linkedin?.connected, color: 'bg-blue-500' },
              { label: 'Twitter', active: sourcesSummary?.twitter?.connected, color: 'bg-sky-500' },
              { label: 'Hackathon', active: (sourcesSummary?.hackathons?.count ?? 0) > 0, color: 'bg-yellow-500' },
              { label: 'Resume', active: sourcesSummary?.resume?.connected, color: 'bg-purple-500' },
            ].map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full ${s.active ? s.color : 'bg-surface-3'}`} />
                <span className={`text-[9px] font-medium ${s.active ? 'text-foreground' : 'text-muted-foreground/40'}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Source cards */}
        <div className="space-y-3 mb-4">
          <motion.div custom={2} variants={fadeIn}>
            <SourceCard
              icon={Github}
              title="GitHub"
              connected={githubConnected}
              connectedLabel={githubUsername ? `@${githubUsername}` : 'Connected'}
              defaultOpen={!githubConnected}
              colorClass="text-foreground"
            >
              {githubConnected ? (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Connected as @{githubUsername}</p>
                      {lastSynced && <p className="text-xs text-muted-foreground mt-0.5">Last synced {new Date(lastSynced).toLocaleDateString()}</p>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={connectGitHub}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Reconnect GitHub
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-foreground">GitHub not connected. Connect to enable reputation analysis.</p>
                  </div>
                  <Button size="sm" onClick={connectGitHub}>
                    <Github className="h-3.5 w-3.5 mr-2" />
                    Connect GitHub
                  </Button>
                </div>
              )}
            </SourceCard>
          </motion.div>

          <motion.div custom={3} variants={fadeIn}>
            <SourceCard
              icon={Linkedin}
              title="LinkedIn"
              connected={!!sourcesSummary?.linkedin?.connected}
              connectedLabel={sourcesSummary?.linkedin?.currentRole ?? 'Connected'}
              colorClass="text-blue-500"
            >
              <LinkedInPanel onSaved={refreshSources} />
            </SourceCard>
          </motion.div>

          <motion.div custom={4} variants={fadeIn}>
            <SourceCard
              icon={Twitter}
              title="X / Twitter"
              connected={!!sourcesSummary?.twitter?.connected}
              connectedLabel={sourcesSummary?.twitter?.handle ? `@${sourcesSummary.twitter.handle}` : 'Connected'}
              colorClass="text-sky-500"
            >
              <TwitterPanel onSaved={refreshSources} />
            </SourceCard>
          </motion.div>

          <motion.div custom={5} variants={fadeIn}>
            <SourceCard
              icon={Trophy}
              title="Hackathons"
              connected={(sourcesSummary?.hackathons?.count ?? 0) > 0}
              connectedLabel={`${sourcesSummary?.hackathons?.count ?? 0} entr${(sourcesSummary?.hackathons?.count ?? 0) === 1 ? 'y' : 'ies'}`}
              colorClass="text-yellow-500"
            >
              <HackathonPanel onSaved={refreshSources} />
            </SourceCard>
          </motion.div>

          <motion.div custom={6} variants={fadeIn}>
            <SourceCard
              icon={FileText}
              title="Resume"
              connected={!!sourcesSummary?.resume?.connected}
              connectedLabel={sourcesSummary?.resume?.currentRole ?? 'Uploaded'}
              colorClass="text-purple-500"
            >
              <ResumePanel onSaved={refreshSources} />
            </SourceCard>
          </motion.div>
        </div>

        {/* Profile section */}
        <motion.div custom={7} variants={fadeIn} className="graphite-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Builder Profile</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or handle"
                className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short description of what you build..."
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Wallet Address</label>
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-mono text-muted-foreground">
                {profileData?.walletAddress
                  ? `${profileData.walletAddress.slice(0, 8)}...${profileData.walletAddress.slice(-6)}`
                  : '—'}
              </div>
            </div>

            <Button size="sm" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
              Save Changes
            </Button>
          </div>
        </motion.div>

        {/* Analysis section */}
        <motion.div custom={8} variants={fadeIn} className="graphite-card p-6">
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
          >
            {reanalyzeAll.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Re-analyze All Repos
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Settings;
