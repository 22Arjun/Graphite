import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Send,
  Copy,
  CheckCheck,
  Users,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { formsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ProfileRequest } from '@/lib/types';

// ============================================================
// Outreach — form management list
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

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// --- Create form dialog ---
function CreateFormDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => formsApi.create({ title: title || null, description: description || null, requiredFields }),
    onSuccess: () => {
      toast({ title: 'Form created', description: 'Your outreach link is ready to share.' });
      setOpen(false);
      setTitle('');
      setDescription('');
      setRequiredFields([]);
      onCreated();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to create form' }),
  });

  const toggleField = (key: string) =>
    setRequiredFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Form Link
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-surface-1 border border-border/50 rounded-xl shadow-2xl p-6">
          <Dialog.Title className="text-lg font-bold text-foreground mb-1">New Outreach Form</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mb-5">
            Create a shareable link to collect profiles from anyone.
          </Dialog.Description>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title (optional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. React Developer Assessment"
                className="w-full rounded-md border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell recipients what you're looking for..."
                rows={3}
                className="w-full rounded-md border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Required fields</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_FIELDS.map(f => {
                  const active = requiredFields.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleField(f.key)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                        active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/40 bg-surface-2 text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      {active ? <ToggleRight className="h-3.5 w-3.5 shrink-0" /> : <ToggleLeft className="h-3.5 w-3.5 shrink-0" />}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </Dialog.Close>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- Form card ---
function FormCard({ form, onDelete }: { form: ProfileRequest; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const url = `${APP_BASE_URL}/form/${form.token}`;
  const count = form._count?.submissions ?? form.submissionCount ?? 0;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteMutation = useMutation({
    mutationFn: () => formsApi.remove(form.id),
    onSuccess: () => {
      toast({ title: 'Form deleted' });
      onDelete();
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to delete form' }),
  });

  return (
    <div className="graphite-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {form.title || 'Untitled Form'}
            </h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              form.isActive
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-muted/30 text-muted-foreground border border-border/30'
            }`}>
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {form.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{form.description}</p>
          )}
        </div>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        >
          {deleteMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Trash2 className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Token link */}
      <div className="flex items-center gap-2 rounded-md bg-surface-2 border border-border/30 px-3 py-2">
        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{url}</span>
        <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
          {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Required fields */}
      {form.requiredFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {form.requiredFields.map(f => (
            <span key={f} className="rounded bg-surface-2 border border-border/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{count} submission{count !== 1 ? 's' : ''}</span>
        </div>
        <Link to={`/outreach/${form.id}`}>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5">
            View Submissions <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// --- Main page ---
export default function Outreach() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['forms'],
    queryFn: () => formsApi.list(),
  });

  const forms: ProfileRequest[] = (data as any)?.data ?? [];

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['forms'] });

  return (
    <div className="container max-w-4xl py-8 px-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      >
        {/* Header */}
        <motion.div variants={fadeIn} custom={0} className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Create shareable form links to collect and analyze profiles from developers.
            </p>
          </div>
          <CreateFormDialog onCreated={refetch} />
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <motion.div variants={fadeIn} custom={1} className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </motion.div>
        ) : isError ? (
          <motion.div variants={fadeIn} custom={1} className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load forms. Please refresh.</p>
          </motion.div>
        ) : forms.length === 0 ? (
          <motion.div variants={fadeIn} custom={1} className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 border border-border/40">
              <Send className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">No forms yet</h3>
              <p className="text-sm text-muted-foreground">Create your first outreach form to start collecting profiles.</p>
            </div>
            <CreateFormDialog onCreated={refetch} />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {forms.map((form, i) => (
              <motion.div key={form.id} variants={fadeIn} custom={i + 1}>
                <FormCard form={form} onDelete={refetch} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
