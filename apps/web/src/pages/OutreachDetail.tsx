import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  CheckCheck,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Github,
  Linkedin,
  Twitter,
  FileText,
  ExternalLink,
  Trophy,
  Link2,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScoreRing from '@/components/ScoreRing';
import DimensionBar from '@/components/DimensionBar';
import SkillTagCloud from '@/components/SkillTagCloud';
import { formsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { FormSubmission, FormAnalysisResult, ProfileRequest } from '@/lib/types';
import { DIMENSION_COLORS } from '@/lib/constants';

// ============================================================
// OutreachDetail — form config + submissions + analysis
// ============================================================

const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || 'http://localhost:5173';

const ALL_FIELDS = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'linkedin', label: 'LinkedIn URL' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'github', label: 'GitHub Username' },
  { key: 'resume', label: 'Resume (PDF)' },
  { key: 'projectLinks', label: 'Project Links' },
  { key: 'hackathons', label: 'Hackathons' },
] as const;

// Maps analysis result dimension keys → DimensionScore shape for DimensionBar reuse
const ANALYSIS_DIMENSION_MAP: { key: keyof FormAnalysisResult['dimensions']; dim: string }[] = [
  { key: 'technicalDepth', dim: 'technical_depth' },
  { key: 'executionAbility', dim: 'execution_ability' },
  { key: 'collaborationQuality', dim: 'collaboration_quality' },
  { key: 'consistency', dim: 'consistency' },
  { key: 'innovation', dim: 'innovation' },
];

function statusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
          <CheckCircle className="h-2.5 w-2.5" /> Completed
        </span>
      );
    case 'ANALYZING':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-node-secondary/10 border border-node-secondary/20 px-2 py-0.5 text-[10px] font-semibold text-node-secondary">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Analyzing
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          <XCircle className="h-2.5 w-2.5" /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 border border-border/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          <Clock className="h-2.5 w-2.5" /> Pending
        </span>
      );
  }
}

// --- Send email dialog ---
function SendEmailDialog({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      formsApi.sendEmail(formId, {
        emails: emails.split(',').map(e => e.trim()).filter(Boolean),
        personalMessage: message || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Emails sent', description: 'Invitations have been delivered.' });
      setOpen(false);
      setEmails('');
      setMessage('');
      setErrorMsg('');
    },
    onError: (err: any) => {
      const raw: string =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to send emails.';
      // Resend free-tier restriction — surface a clear explanation
      if (raw.toLowerCase().includes('testing emails') || raw.toLowerCase().includes('own email')) {
        setErrorMsg(
          'Resend is in test mode: emails can only be delivered to the address registered on your Resend account. ' +
          'To send to any recipient, verify a domain at resend.com/domains.'
        );
      } else {
        setErrorMsg(raw);
      }
    },
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" /> Send Email
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-1 border border-border/50 rounded-xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Send Form Invitation</h3>
        <p className="text-sm text-muted-foreground mb-5">Enter email addresses to invite recipients.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email addresses <span className="text-destructive">*</span>
            </label>
            <textarea
              value={emails}
              onChange={e => { setEmails(e.target.value); setErrorMsg(''); }}
              placeholder="alice@example.com, bob@example.com"
              rows={3}
              className="w-full rounded-md border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
            <p className="text-[11px] text-muted-foreground/60 mt-1">Separate multiple addresses with commas</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Personal message (optional)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Hey! I'd love to see your profile..."
              rows={2}
              maxLength={500}
              className="w-full rounded-md border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setErrorMsg(''); }}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !emails.trim()}
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Submission analysis panel ---
function AnalysisPanel({ submission }: { submission: FormSubmission }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reanalyzeMutation = useMutation({
    mutationFn: () => formsApi.reanalyze(submission.id),
    onSuccess: () => {
      toast({ title: 'Re-analysis started' });
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to start re-analysis' }),
  });

  const result: FormAnalysisResult | null = submission.analysisResult as any;

  const renderReanalyze = () => (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={() => reanalyzeMutation.mutate()}
      disabled={reanalyzeMutation.isPending}
    >
      {reanalyzeMutation.isPending
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <RefreshCw className="h-3 w-3" />}
      Re-analyze
    </Button>
  );

  if (submission.analysisStatus === 'ANALYZING' || submission.analysisStatus === 'PENDING') {
    return (
      <div className="px-4 pb-4 pt-2">
        <div className="rounded-lg border border-border/30 bg-surface-2/50 p-6 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full border border-node-secondary/30 bg-node-secondary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-node-secondary animate-spin" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {submission.analysisStatus === 'PENDING' ? 'Analysis queued...' : 'Analysis in progress...'}
          </p>
          <p className="text-xs text-muted-foreground">This usually takes 20–40 seconds.</p>
        </div>
      </div>
    );
  }

  if (submission.analysisStatus === 'FAILED' || !result) {
    return (
      <div className="px-4 pb-4 pt-2">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 flex flex-col items-center gap-3 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">Analysis failed</p>
          <p className="text-xs text-muted-foreground mb-1">There was an error processing this profile.</p>
          {renderReanalyze()}
        </div>
      </div>
    );
  }

  // COMPLETED
  const dimensions = ANALYSIS_DIMENSION_MAP.map(({ key, dim }) => ({
    dimension: dim as any,
    score: result.dimensions[key]?.score ?? 0,
    confidence: 1,
    signals: [result.dimensions[key]?.reasoning ?? ''],
    trend: 'stable' as const,
  }));

  const skills = result.skills.map(name => ({
    name,
    category: 'language' as const,
    confidence: 0.9,
    inferred_from: [] as string[],
  }));

  const expColor = (() => {
    switch (result.experienceLevel) {
      case 'Junior': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Mid': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Senior': return 'text-primary bg-primary/10 border-primary/20';
      case 'Staff': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Principal': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-muted-foreground bg-muted/20 border-border/30';
    }
  })();

  return (
    <div className="px-4 pb-5 pt-2 space-y-5">
      {/* Score + summary row */}
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreRing score={result.overallScore} size={100} strokeWidth={7} label="Overall Score" />
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${expColor}`}>
            {result.experienceLevel}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed mb-3">{result.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h5 className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">Strengths</h5>
              <ul className="space-y-0.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-1.5">Growth Areas</h5>
              <ul className="space-y-0.5">
                {result.growthAreas.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div>
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dimensions</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dimensions.map(d => (
            <DimensionBar key={d.dimension} dimension={d} />
          ))}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills</h5>
          <SkillTagCloud skills={skills} />
        </div>
      )}

      {/* Tech stack */}
      {result.techStack.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tech Stack</h5>
          <div className="flex flex-wrap gap-1.5">
            {result.techStack.map(t => (
              <span key={t} className="rounded-md border border-border/40 bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source links */}
      <div className="flex flex-wrap gap-2">
        {submission.githubUsername && (
          <a href={`https://github.com/${submission.githubUsername}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Github className="h-3 w-3" /> GitHub
            </Button>
          </a>
        )}
        {submission.linkedInUrl && (
          <a href={submission.linkedInUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Linkedin className="h-3 w-3 text-blue-500" /> LinkedIn
            </Button>
          </a>
        )}
        {submission.twitterHandle && (
          <a href={`https://twitter.com/${submission.twitterHandle}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Twitter className="h-3 w-3 text-sky-400" /> @{submission.twitterHandle}
            </Button>
          </a>
        )}
        {submission.resumeUrl && (
          <a href={submission.resumeUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <FileText className="h-3 w-3 text-purple-400" /> Resume
            </Button>
          </a>
        )}
        <div className="ml-auto">{renderReanalyze()}</div>
      </div>

      {/* Project links */}
      {Array.isArray(submission.projectLinks) && (submission.projectLinks as any[]).length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Projects</h5>
          <div className="flex flex-wrap gap-2">
            {(submission.projectLinks as any[]).map((p: any, i: number) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7">
                  <ExternalLink className="h-3 w-3" /> {p.title || p.url}
                </Button>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Hackathons */}
      {Array.isArray(submission.hackathons) && (submission.hackathons as any[]).length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hackathons</h5>
          <div className="flex flex-wrap gap-2">
            {(submission.hackathons as any[]).map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-2.5 py-1.5">
                <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
                <span className="text-xs text-foreground font-medium">{h.name}</span>
                <span className="text-[10px] text-muted-foreground">({h.year})</span>
                {h.placement && <span className="text-[10px] text-yellow-500 font-semibold">· {h.placement}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Submission row ---
function SubmissionRow({ submission }: { submission: FormSubmission }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/40 bg-surface-1 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {submission.fullName || submission.email || submission.githubUsername || 'Anonymous'}
            </p>
            {submission.email && (
              <p className="text-[11px] text-muted-foreground truncate">{submission.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {submission.githubUsername && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Github className="h-3 w-3" />{submission.githubUsername}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(submission.analysisStatus)}
            <span className="text-[11px] text-muted-foreground ml-auto sm:ml-0">
              {new Date(submission.submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden border-t border-border/30"
          >
            <AnalysisPanel submission={submission} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main page ---
export default function OutreachDetail() {
  const { formId } = useParams<{ formId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const formQuery = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.get(formId!),
    enabled: !!formId,
  });

  const form: (ProfileRequest & { _count?: { submissions: number } }) | undefined =
    (formQuery.data as any)?.data;

  const submissionsQuery = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: () => formsApi.listSubmissions(formId!),
    enabled: !!formId,
    refetchInterval: (query) => {
      const subs: any[] = (query.state.data as any)?.data ?? [];
      const hasAnalyzing = subs.some(
        (s: any) => s.analysisStatus === 'ANALYZING' || s.analysisStatus === 'PENDING'
      );
      return hasAnalyzing ? 5000 : false;
    },
  });

  const submissions: FormSubmission[] = (submissionsQuery.data as any)?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: object) => formsApi.update(formId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form', formId] }),
    onError: () => toast({ variant: 'destructive', title: 'Update failed' }),
  });

  const toggleField = (key: string) => {
    if (!form) return;
    const current = form.requiredFields ?? [];
    const updated = current.includes(key)
      ? current.filter(f => f !== key)
      : [...current, key];
    updateMutation.mutate({ requiredFields: updated });
  };

  const toggleActive = () => {
    if (!form) return;
    updateMutation.mutate({ isActive: !form.isActive });
  };

  const formUrl = form ? `${APP_BASE_URL}/form/${form.token}` : '';

  const copy = () => {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (formQuery.isLoading) {
    return (
      <div className="container max-w-4xl py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (formQuery.isError || !form) {
    return (
      <div className="container max-w-4xl py-20 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Form not found.</p>
        <Link to="/outreach"><Button variant="ghost" size="sm">Back to Outreach</Button></Link>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6">
      {/* Back */}
      <Link to="/outreach" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Outreach
      </Link>

      {/* Form config card */}
      <div className="graphite-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground">
                {form.title || 'Untitled Form'}
              </h1>
              <button
                onClick={toggleActive}
                disabled={updateMutation.isPending}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  form.isActive
                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20'
                    : 'bg-muted/30 text-muted-foreground border-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/20'
                }`}
              >
                {form.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
            {form.description && (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SendEmailDialog formId={formId!} />
          </div>
        </div>

        {/* Share link */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Share link</label>
          <div className="flex items-center gap-2 rounded-md bg-surface-2 border border-border/30 px-3 py-2">
            <span className="text-xs text-muted-foreground font-mono truncate flex-1">{formUrl}</span>
            <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a href={formUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Required fields toggles */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Required fields</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_FIELDS.map(f => {
              const active = (form.requiredFields ?? []).includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleField(f.key)}
                  disabled={updateMutation.isPending}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/40 bg-surface-2 text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  {active ? <ToggleRight className="h-3 w-3 shrink-0" /> : <ToggleLeft className="h-3 w-3 shrink-0" />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Submissions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Submissions
            {submissions.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                {submissions.length}
              </span>
            )}
          </h2>
          {submissionsQuery.isFetching && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Refreshing...
            </span>
          )}
        </div>

        {submissionsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center rounded-lg border border-border/30 bg-surface-1">
            <Zap className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">No submissions yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share your form link and submissions will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map(s => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
