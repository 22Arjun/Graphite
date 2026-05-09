import React, { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  AlertCircle,
  Github,
  Linkedin,
  Twitter,
  Link2,
  Trophy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formsApi } from '@/lib/api';
import type { PublicFormConfig } from '@/lib/types';

// ============================================================
// FormPage — public (no auth required)
// ============================================================

interface ProjectLink { url: string; title: string }
interface Hackathon { name: string; year: number; placement: string; prize: string; projectUrl: string }
interface ExtraLink { url: string; label: string }

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const REQUIRED_LABEL: Record<string, string> = {
  fullName: 'Full Name',
  email: 'Email Address',
  linkedin: 'LinkedIn URL',
  twitter: 'Twitter / X Handle',
  github: 'GitHub Username',
  resume: 'Resume (PDF)',
  projectLinks: 'Live Project Links',
  hackathons: 'Hackathon History',
};

export default function FormPage() {
  const { token } = useParams<{ token: string }>();

  const { data: formResponse, isLoading, isError } = useQuery({
    queryKey: ['publicForm', token],
    queryFn: () => formsApi.getPublicForm(token!),
    enabled: !!token,
    retry: false,
  });

  const form: PublicFormConfig | undefined = (formResponse as any)?.data;

  // --- form state ---
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [projectLinks, setProjectLinks] = useState<ProjectLink[]>([{ url: '', title: '' }]);
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (fd: FormData) => formsApi.submitForm(token!, fd),
    onSuccess: () => setSubmitted(true),
  });

  const isRequired = (field: string) => form?.requiredFields.includes(field) ?? false;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (isRequired('fullName') && !fullName.trim()) errs.fullName = 'Full name is required';
    if (isRequired('email') && !email.trim()) errs.email = 'Email is required';
    if (isRequired('linkedin') && !linkedInUrl.trim()) errs.linkedin = 'LinkedIn URL is required';
    if (isRequired('twitter') && !twitterHandle.trim()) errs.twitter = 'Twitter handle is required';
    if (isRequired('github') && !githubUsername.trim()) errs.github = 'GitHub username is required';
    if (isRequired('resume') && !resumeFile) errs.resume = 'Resume is required';
    if (isRequired('projectLinks') && projectLinks.every(p => !p.url.trim())) {
      errs.projectLinks = 'At least one project link is required';
    }
    if (isRequired('hackathons') && hackathons.length === 0) {
      errs.hackathons = 'At least one hackathon entry is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData();
    if (fullName) fd.append('fullName', fullName);
    if (email) fd.append('email', email);
    if (linkedInUrl) fd.append('linkedInUrl', linkedInUrl);
    if (twitterHandle) fd.append('twitterHandle', twitterHandle);
    if (githubUsername) fd.append('githubUsername', githubUsername);
    fd.append('projectLinks', JSON.stringify(projectLinks.filter(p => p.url.trim())));
    fd.append('hackathons', JSON.stringify(hackathons.filter(h => h.name.trim())));
    fd.append('extraLinks', JSON.stringify(extraLinks.filter(l => l.url.trim())));
    if (resumeFile) fd.append('resume', resumeFile);

    mutation.mutate(fd);
  };

  // --- drag-drop ---
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') setResumeFile(file);
  }, []);

  // --- array helpers ---
  const updateProjectLink = (i: number, field: keyof ProjectLink, val: string) =>
    setProjectLinks(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const removeProjectLink = (i: number) =>
    setProjectLinks(prev => prev.filter((_, idx) => idx !== i));

  const updateHackathon = (i: number, field: keyof Hackathon, val: string | number) =>
    setHackathons(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
  const removeHackathon = (i: number) =>
    setHackathons(prev => prev.filter((_, idx) => idx !== i));

  const updateExtraLink = (i: number, field: keyof ExtraLink, val: string) =>
    setExtraLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const removeExtraLink = (i: number) =>
    setExtraLinks(prev => prev.filter((_, idx) => idx !== i));

  // -------------------------------------------------------
  // Loading / Error / Submitted states
  // -------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Form not available</h2>
          <p className="text-muted-foreground text-sm">
            This form may have expired or been deactivated by the sender.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-sm"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Profile submitted!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Thank you for sharing your profile. The analysis will begin shortly and the
            results will be visible to the person who sent you this link.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/50 text-xs">
            <span>Powered by</span>
            <span className="font-bold text-primary">Graphite</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // -------------------------------------------------------
  // Main form
  // -------------------------------------------------------

  const inputCls = (err?: string) =>
    `w-full rounded-md border ${err ? 'border-destructive' : 'border-border/50'} bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors`;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <motion.div
        className="max-w-2xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      >
        {/* Header */}
        <motion.div variants={fadeIn} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Graphite Profile Request
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {form.title || 'Share Your Profile'}
          </h1>
          {form.description && (
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg mx-auto">
              {form.description}
            </p>
          )}
          {form.requiredFields.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground/70">
              Required:{' '}
              {form.requiredFields.map(f => REQUIRED_LABEL[f] || f).join(', ')}
            </p>
          )}
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">1</span>
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Full Name {isRequired('fullName') && <span className="text-destructive">*</span>}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className={inputCls(errors.fullName)}
                />
                {errors.fullName && <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address {isRequired('email') && <span className="text-destructive">*</span>}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className={inputCls(errors.email)}
                />
                {errors.email && <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>}
              </div>
            </div>
          </motion.div>

          {/* Social profiles */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">2</span>
              Social Profiles
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Linkedin className="h-3 w-3 text-blue-500" />
                  LinkedIn URL {isRequired('linkedin') && <span className="text-destructive">*</span>}
                </label>
                <input
                  type="url"
                  value={linkedInUrl}
                  onChange={e => setLinkedInUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className={inputCls(errors.linkedin)}
                />
                {errors.linkedin && <p className="mt-1 text-[11px] text-destructive">{errors.linkedin}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Twitter className="h-3 w-3 text-sky-400" />
                    Twitter / X {isRequired('twitter') && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={e => setTwitterHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className={inputCls(errors.twitter)}
                  />
                  {errors.twitter && <p className="mt-1 text-[11px] text-destructive">{errors.twitter}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Github className="h-3 w-3 text-foreground" />
                    GitHub Username {isRequired('github') && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={e => setGithubUsername(e.target.value)}
                    placeholder="yourusername"
                    className={inputCls(errors.github)}
                  />
                  {errors.github && <p className="mt-1 text-[11px] text-destructive">{errors.github}</p>}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Resume */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">3</span>
              Resume / CV {isRequired('resume') && <span className="text-destructive">*</span>}
            </h3>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : resumeFile
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/40 hover:border-border hover:bg-surface-2/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setResumeFile(f);
                }}
              />
              {resumeFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{resumeFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setResumeFile(null); }}
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop your PDF here, or <span className="text-primary">click to browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">PDF only · Max 10 MB</p>
                </>
              )}
            </div>
            {errors.resume && <p className="text-[11px] text-destructive">{errors.resume}</p>}
          </motion.div>

          {/* Project links */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">4</span>
                Live Projects {isRequired('projectLinks') && <span className="text-destructive text-sm">*</span>}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setProjectLinks(prev => [...prev, { url: '', title: '' }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {errors.projectLinks && <p className="text-[11px] text-destructive">{errors.projectLinks}</p>}
            <div className="space-y-2">
              {projectLinks.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={p.title}
                    onChange={e => updateProjectLink(i, 'title', e.target.value)}
                    placeholder="Project name"
                    className={`${inputCls()} w-36 shrink-0`}
                  />
                  <input
                    type="url"
                    value={p.url}
                    onChange={e => updateProjectLink(i, 'url', e.target.value)}
                    placeholder="https://your-project.com"
                    className={inputCls()}
                  />
                  {projectLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProjectLink(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Hackathons */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">5</span>
                <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                Hackathons {isRequired('hackathons') && <span className="text-destructive text-sm">*</span>}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setHackathons(prev => [...prev, { name: '', year: new Date().getFullYear(), placement: '', prize: '', projectUrl: '' }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {errors.hackathons && <p className="text-[11px] text-destructive">{errors.hackathons}</p>}
            {hackathons.length === 0 && (
              <p className="text-xs text-muted-foreground/60 py-2">No hackathons added yet.</p>
            )}
            <div className="space-y-3">
              {hackathons.map((h, i) => (
                <div key={i} className="rounded-md border border-border/40 bg-surface-2/50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={h.name}
                      onChange={e => updateHackathon(i, 'name', e.target.value)}
                      placeholder="Hackathon name"
                      className={`${inputCls()} flex-1`}
                    />
                    <input
                      type="number"
                      value={h.year}
                      onChange={e => updateHackathon(i, 'year', parseInt(e.target.value) || 2024)}
                      placeholder="Year"
                      className={`${inputCls()} w-24 shrink-0`}
                    />
                    <button
                      type="button"
                      onClick={() => removeHackathon(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={h.placement}
                      onChange={e => updateHackathon(i, 'placement', e.target.value)}
                      placeholder="Placement (e.g. 1st)"
                      className={inputCls()}
                    />
                    <input
                      type="text"
                      value={h.prize}
                      onChange={e => updateHackathon(i, 'prize', e.target.value)}
                      placeholder="Prize (optional)"
                      className={inputCls()}
                    />
                    <input
                      type="url"
                      value={h.projectUrl}
                      onChange={e => updateHackathon(i, 'projectUrl', e.target.value)}
                      placeholder="Project URL"
                      className={inputCls()}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Extra links */}
          <motion.div variants={fadeIn} className="graphite-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">6</span>
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                Additional Links
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setExtraLinks(prev => [...prev, { url: '', label: '' }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {extraLinks.length === 0 && (
              <p className="text-xs text-muted-foreground/60 py-2">Portfolio, blog, paper, anything extra.</p>
            )}
            <div className="space-y-2">
              {extraLinks.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={l.label}
                    onChange={e => updateExtraLink(i, 'label', e.target.value)}
                    placeholder="Label"
                    className={`${inputCls()} w-32 shrink-0`}
                  />
                  <input
                    type="url"
                    value={l.url}
                    onChange={e => updateExtraLink(i, 'url', e.target.value)}
                    placeholder="https://..."
                    className={inputCls()}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraLink(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Submit */}
          <motion.div variants={fadeIn} className="pb-8">
            {mutation.isError && (
              <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Submission failed. Please check your inputs and try again.
              </div>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 font-semibold text-sm"
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><ExternalLink className="h-4 w-4 mr-2" />Submit Profile</>
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground/50">
              Powered by <span className="text-primary font-semibold">Graphite</span>
            </p>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
