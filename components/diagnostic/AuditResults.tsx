'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AuditIssue, AuditResult, Category, Severity } from './scannerTypes';
import { useCopy } from '@/hooks/use-copy';

// ---------------------------------------------------------------------------
// Severity colour map
// ---------------------------------------------------------------------------
const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--danger)',
  'HIGH IMPACT': 'var(--warning)',
  'LOW IMPACT': 'var(--text-muted)',
};

const CATEGORIES: Category[] = [
  'DISCOVERY',
  'TRUST',
  'CLARITY',
  'FLOW',
  'DIFFERENTIATION',
  'TECH HYGIENE',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] tracking-[2px] uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border-soft)' }} />;
}

function PromptBox({ prompt }: { prompt: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="relative border" style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}>
      <pre
        className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap p-4 pr-24"
        style={{ color: 'var(--text-secondary)' }}
      >
        {prompt}
      </pre>
      <button
        onClick={() => copy(prompt)}
        className="absolute top-3 right-3 font-mono text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 border transition-all duration-200"
        style={{
          borderColor: copied ? 'var(--accent)' : 'var(--border)',
          color: copied ? 'var(--accent)' : 'var(--text-muted)',
          background: 'var(--bg-elevated)',
        }}
        onMouseEnter={e => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={e => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }
        }}
      >
        {copied ? 'COPIED' : 'COPY PROMPT'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue detail panel
// ---------------------------------------------------------------------------
function IssueDetailPanel({ issue, highlightFix }: { issue: AuditIssue; highlightFix?: boolean }) {
  const fixRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightFix && fixRef.current) {
      fixRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightFix]);

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="border overflow-y-auto"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)', maxHeight: 620 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border-soft)' }}>
        <div>
          <SectionLabel>Issue</SectionLabel>
          <div className="font-mono text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
            {issue.title}
          </div>
          <div className="font-mono text-[10px] mt-1 tracking-[1px]" style={{ color: 'var(--text-muted)' }}>
            {issue.category}
          </div>
        </div>
        <div className="text-right shrink-0">
          <SectionLabel>Severity</SectionLabel>
          <div className="font-mono text-[11px] font-bold tracking-[1px]" style={{ color: SEVERITY_COLOR[issue.severity] }}>
            {issue.severity}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* What AudFlo Sees */}
        <section>
          <SectionLabel>What AudFlo Sees</SectionLabel>
          <p className="font-mono text-[12px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
            {issue.what}
          </p>
          {issue.location && (
            <p className="font-mono text-[11px] leading-[1.6] mt-2 italic" style={{ color: 'var(--text-muted)' }}>
              {issue.location}
            </p>
          )}
        </section>

        <Divider />

        {/* Why This Is Happening */}
        <section>
          <SectionLabel>Why This Is Happening</SectionLabel>
          <p className="font-mono text-[12px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
            {issue.causePattern}
          </p>
        </section>

        <Divider />

        {/* Why This Matters */}
        <section>
          <SectionLabel>Why This Matters</SectionLabel>
          <p className="font-mono text-[12px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
            {issue.why}
          </p>
        </section>

        <Divider />

        {/* Estimated Loss */}
        <section>
          <SectionLabel>What Users Do Because of This</SectionLabel>
          <p className="font-mono text-[12px] leading-[1.75] font-bold" style={{ color: 'var(--danger)' }}>
            {issue.estimatedLoss}
          </p>
        </section>

        <Divider />

        {/* Fix */}
        <section ref={fixRef}>
          <motion.div
            animate={highlightFix ? { background: ['rgba(126,240,165,0)', 'rgba(126,240,165,0.07)', 'rgba(126,240,165,0)'] } : {}}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="p-3 -m-3"
          >
            <SectionLabel>Fix</SectionLabel>
            <p className="font-mono text-[12px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
              {issue.fix}
            </p>
          </motion.div>
        </section>

        <Divider />

        {/* Prompt */}
        <section>
          <SectionLabel>Prompt</SectionLabel>
          <PromptBox prompt={issue.prompt} />
        </section>

      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Category tab bar
// ---------------------------------------------------------------------------
function CategoryTabs({
  categories, active, result, onChange,
}: {
  categories: Category[];
  active: Category;
  result: AuditResult;
  onChange: (c: Category) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(cat => {
        const catIssues = result.issues.filter(i => i.category === cat);
        const hasCritical = catIssues.some(i => i.severity === 'CRITICAL');
        const hasHigh = catIssues.some(i => i.severity === 'HIGH IMPACT');
        const dotColor = catIssues.length === 0 ? 'var(--accent)'
          : hasCritical ? 'var(--danger)' : hasHigh ? 'var(--warning)' : 'var(--text-muted)';
        const isActive = active === cat;
        return (
          <button key={cat} onClick={() => onChange(cat)}
            className="font-mono text-[9px] tracking-[1.5px] uppercase px-2.5 py-1.5 border transition-all duration-150 flex items-center gap-1.5"
            style={{
              borderColor: isActive ? 'var(--accent)' : 'var(--border-soft)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(126,240,165,0.08)' : 'transparent',
            }}
          >
            <span style={{ color: dotColor, fontSize: 7 }}>●</span>
            {cat}
            {catIssues.length > 0 && (
              <span className="font-mono text-[9px] font-bold" style={{ color: dotColor }}>{catIssues.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview skeleton
// ---------------------------------------------------------------------------
function PreviewRows() {
  const fakeRows = [
    { title: 'Users are asked to commit before seeing anything real', severity: 'CRITICAL' as Severity, cat: 'TRUST' },
    { title: 'You look interchangeable with every other AI tool', severity: 'CRITICAL' as Severity, cat: 'DIFFERENTIATION' },
    { title: 'Visitors leave in the first 5 seconds', severity: 'CRITICAL' as Severity, cat: 'CLARITY' },
  ];
  return (
    <div className="space-y-4">
      <motion.div
        className="flex items-center gap-2 px-4 py-2 border font-mono text-[10px] tracking-[1.5px] uppercase"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ borderColor: 'rgba(126,240,165,0.2)', background: 'rgba(126,240,165,0.04)', color: 'var(--text-muted)' }}
      >
        <span style={{ color: 'var(--accent)', fontSize: 8 }}>◆</span>
        PREVIEW — ENTER A URL TO SEE WHERE YOU ARE LOSING USERS
      </motion.div>
      <motion.div animate={{ opacity: 0.45, filter: 'blur(0.5px)' }} className="border" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="grid font-mono text-[10px] tracking-[1.5px] uppercase px-4 py-2 border-b"
          style={{ gridTemplateColumns: '2.5rem 1fr auto auto', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
          <span>#</span><span>Issue</span>
          <span className="mr-4 hidden sm:block">Category</span>
          <span>Severity</span>
        </div>
        {fakeRows.map((row, i) => (
          <div key={i} className="grid items-center px-4 py-3 border-b last:border-b-0"
            style={{ gridTemplateColumns: '2.5rem 1fr auto auto', borderColor: 'var(--border-soft)' }}>
            <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{String(i + 1).padStart(2, '0')}</span>
            <span className="font-mono text-[12px] leading-snug" style={{ color: 'var(--text-primary)' }}>{row.title}</span>
            <span className="font-mono text-[9px] tracking-[1px] uppercase mr-4 hidden sm:block" style={{ color: 'var(--text-muted)' }}>{row.cat}</span>
            <span className="font-mono text-[10px] font-bold tracking-[1px]" style={{ color: SEVERITY_COLOR[row.severity] }}>{row.severity}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exposed handle for parent to trigger scroll-to-issue
// ---------------------------------------------------------------------------
export interface AuditResultsHandle {
  scrollToIssue: (issueId: string) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface AuditResultsProps {
  revealed: boolean;
  preview: boolean;
  result: AuditResult | null;
}

const AuditResults = forwardRef<AuditResultsHandle, AuditResultsProps>(
  function AuditResults({ revealed, preview, result }, ref) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [highlightFix, setHighlightFix] = useState(false);
    const [activeCategory, setActiveCategory] = useState<Category>('DISCOVERY');
    const { copied: allCopied, copy: copyAll } = useCopy(2000);
    const issueListRef = useRef<HTMLDivElement>(null);

    // Expose scroll-to-issue for parent (ScanMap "Fix my biggest problem" button)
    useImperativeHandle(ref, () => ({
      scrollToIssue(issueId: string) {
        if (!result) return;
        const issue = result.issues.find(i => i.id === issueId);
        if (!issue) return;
        setActiveCategory(issue.category);
        setSelectedId(issueId);
        setHighlightFix(true);
        setTimeout(() => {
          issueListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        setTimeout(() => setHighlightFix(false), 2000);
      },
    }));

    // Auto-select first issue when revealed
    useEffect(() => {
      if (revealed && result && result.issues.length > 0) {
        const t = setTimeout(() => {
          const first = result.issues[0];
          setActiveCategory(first.category);
          setSelectedId(first.id);
        }, 1200);
        return () => clearTimeout(t);
      } else {
        setSelectedId(null);
        setHighlightFix(false);
      }
    }, [revealed, result]);

    const categoryIssues = useMemo(
      () => result?.issues.filter(i => i.category === activeCategory) ?? [],
      [result, activeCategory],
    );

    const selectedIssue = useMemo(
      () => result?.issues.find(i => i.id === selectedId) ?? null,
      [result, selectedId],
    );

    const handleCopyAll = () => {
      if (!result) return;
      const combined = result.issues.map(
        i => `=== ${i.title} [${i.severity}] — ${i.category} ===\n\nWHY THIS IS HAPPENING:\n${i.causePattern}\n\nFIX:\n${i.fix}\n\nPROMPT:\n${i.prompt}`,
      ).join('\n\n---\n\n');
      copyAll(combined);
    };

    if (!revealed || !result) {
      return preview ? <PreviewRows /> : null;
    }

    const totalIssues = result.issues.length;
    const criticalCount = result.issues.filter(i => i.severity === 'CRITICAL').length;

    return (
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <div className="font-mono text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              You are losing users in {criticalCount > 0 ? criticalCount : totalIssues} critical place{(criticalCount !== 1) ? 's' : ''}
            </div>
            <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''} — prioritized by impact
            </div>
          </div>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            onClick={handleCopyAll}
            className="shrink-0 font-mono text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 border transition-all duration-200"
            style={{
              borderColor: allCopied ? 'var(--accent)' : 'var(--border)',
              color: allCopied ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent',
            }}
            onMouseEnter={e => {
              if (!allCopied) {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.boxShadow = '0 0 8px rgba(126,240,165,0.1)';
              }
            }}
            onMouseLeave={e => {
              if (!allCopied) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {allCopied ? '✓ COPIED ALL' : '[ COPY ALL PROMPTS ]'}
          </motion.button>
        </div>

        {/* Category tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <CategoryTabs
            categories={CATEGORIES}
            active={activeCategory}
            result={result}
            onChange={cat => {
              setActiveCategory(cat);
              setSelectedId(null);
              setHighlightFix(false);
            }}
          />
        </motion.div>

        {/* Issue list */}
        <div ref={issueListRef} className="border" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="grid font-mono text-[10px] tracking-[1.5px] uppercase px-4 py-2 border-b"
            style={{ gridTemplateColumns: '2.5rem 1fr auto auto', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
            <span>#</span>
            <span>Issue</span>
            <span className="mr-4 hidden sm:block">Category</span>
            <span>Severity</span>
          </div>

          {categoryIssues.length === 0 ? (
            <div className="px-4 py-5 font-mono text-[11px] tracking-wide text-center" style={{ color: 'var(--accent)' }}>
              ● No friction detected in this category
            </div>
          ) : (
            categoryIssues.map((issue, i) => {
              const isSelected = selectedId === issue.id;
              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.08, duration: 0.3 }}
                  className="grid items-center px-4 py-3 border-b last:border-b-0 transition-all duration-150"
                  style={{
                    gridTemplateColumns: '2.5rem 1fr auto auto',
                    borderColor: 'var(--border-soft)',
                    background: isSelected ? 'rgba(126,240,165,0.06)' : 'transparent',
                    boxShadow: isSelected ? 'inset 2px 0 0 var(--accent)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setSelectedId(isSelected ? null : issue.id);
                    setHighlightFix(false);
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(126,240,165,0.03)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="font-mono text-[11px]" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[12px] leading-snug" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                    {issue.title}
                  </span>
                  <span className="font-mono text-[9px] tracking-[1px] uppercase mr-4 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                    {issue.category}
                  </span>
                  <span className="font-mono text-[10px] font-bold tracking-[1px]" style={{ color: SEVERITY_COLOR[issue.severity] }}>
                    {issue.severity}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence mode="wait">
          {selectedIssue ? (
            <IssueDetailPanel
              key={selectedIssue.id}
              issue={selectedIssue}
              highlightFix={highlightFix && selectedIssue.id === selectedId}
            />
          ) : categoryIssues.length > 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="border px-5 py-6 font-mono text-[11px] tracking-[1.5px] uppercase text-center"
              style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
            >
              SELECT AN ISSUE TO VIEW DETAILS
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="border px-4 py-3 font-mono text-[10px] leading-[1.7]"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-muted)' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>AudFlo scans public signals from your URL.</span>
          {' '}Connect analytics or code for deeper insights into user behavior, conversion funnels, and runtime performance.
        </motion.div>
      </div>
    );
  }
);

export default AuditResults;
