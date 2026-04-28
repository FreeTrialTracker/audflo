'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LEAKS, type Leak, type Severity } from './leakData';
import { useCopy } from '@/hooks/use-copy';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--danger)',
  HIGH: 'var(--warning)',
  MEDIUM: 'var(--text-muted)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[9px] tracking-[2px] uppercase mb-2"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </div>
  );
}

function PromptBox({ prompt }: { prompt: string }) {
  const { copied, copy } = useCopy();
  return (
    <div
      className="relative border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}
    >
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

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border-soft)' }} />;
}

function LeakDetailPanel({ leak }: { leak: Leak }) {
  return (
    <motion.div
      key={leak.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="border overflow-y-auto"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--bg-elevated)',
        maxHeight: 520,
      }}
    >
      <div
        className="flex items-start justify-between gap-4 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div>
          <SectionLabel>Issue</SectionLabel>
          <div
            className="font-mono text-[13px] font-medium tracking-wide"
            style={{ color: 'var(--text-primary)' }}
          >
            {leak.title}
          </div>
        </div>
        <div className="text-right shrink-0">
          <SectionLabel>Severity</SectionLabel>
          <div
            className="font-mono text-[12px] font-bold tracking-[1px]"
            style={{ color: SEVERITY_COLOR[leak.severity] }}
          >
            {leak.severity}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        <section>
          <SectionLabel>What AudFlo Sees</SectionLabel>
          <p
            className="font-mono text-[12px] leading-[1.75]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {leak.what}
          </p>
          <p
            className="font-mono text-[11px] leading-[1.6] mt-2 italic"
            style={{ color: 'var(--text-muted)' }}
          >
            {leak.location}
          </p>
        </section>

        <Divider />

        <section>
          <SectionLabel>Why This Matters</SectionLabel>
          <p
            className="font-mono text-[12px] leading-[1.75]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {leak.why}
          </p>
        </section>

        <Divider />

        <section>
          <SectionLabel>Estimated Loss</SectionLabel>
          <p
            className="font-mono text-[12px] leading-[1.75] font-bold"
            style={{ color: 'var(--danger)' }}
          >
            {leak.estimatedLoss}
          </p>
        </section>

        <Divider />

        <section>
          <SectionLabel>Fix</SectionLabel>
          <p
            className="font-mono text-[12px] leading-[1.75]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {leak.fix}
          </p>
        </section>

        <Divider />

        <section>
          <SectionLabel>Expected Impact</SectionLabel>
          <p
            className="font-mono text-[12px] leading-[1.75] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            {leak.expectedImpact}
          </p>
        </section>

        <Divider />

        <section>
          <SectionLabel>Prompt</SectionLabel>
          <PromptBox prompt={leak.prompt} />
        </section>
      </div>
    </motion.div>
  );
}

const PREVIEW_LEAKS = LEAKS.slice(0, 3);

export default function LeakTable({ revealed, preview }: { revealed: boolean; preview: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { copied: allCopied, copy: copyAll } = useCopy(2000);

  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => setSelectedId(1), 1200);
      return () => clearTimeout(t);
    } else {
      setSelectedId(null);
    }
  }, [revealed]);

  const selectedLeak = useMemo(
    () => LEAKS.find(l => l.id === selectedId) ?? null,
    [selectedId],
  );

  const handleCopyAll = () => {
    const combined = LEAKS.map(
      l => `=== ${l.title} [${l.severity}] ===\n\n${l.prompt}`,
    ).join('\n\n---\n\n');
    copyAll(combined);
  };

  const displayLeaks = revealed ? LEAKS : preview ? PREVIEW_LEAKS : [];
  const isPreviewOnly = preview && !revealed;

  return (
    <div className="space-y-4">
      {/* Preview mode banner */}
      <AnimatePresence>
        {isPreviewOnly && (
          <motion.div
            key="preview-banner"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2 px-4 py-2 border font-mono text-[10px] tracking-[1.5px] uppercase"
            style={{
              borderColor: 'rgba(126,240,165,0.2)',
              background: 'rgba(126,240,165,0.04)',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ color: 'var(--accent)', fontSize: 8 }}>◆</span>
            PREVIEW MODE — RUN AN AUDIT TO GENERATE YOUR OWN
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="space-y-4"
        animate={{
          opacity: isPreviewOnly ? 0.55 : 1,
          filter: isPreviewOnly ? 'blur(0.5px)' : 'none',
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <div
            className="font-mono text-[11px] tracking-[2px] uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {revealed ? 'Top 5 Leaks Detected' : 'Top 3 Leaks Detected'}
          </div>
          {revealed && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              onClick={handleCopyAll}
              className="font-mono text-[9px] tracking-[1.5px] uppercase px-3 py-1.5 border transition-all duration-200"
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
              {allCopied ? '✓ COPIED ALL' : '[ COPY ALL FIXES ]'}
            </motion.button>
          )}
        </div>

        <div className="border" style={{ borderColor: 'var(--border-soft)' }}>
          <div
            className="grid font-mono text-[10px] tracking-[1.5px] uppercase px-4 py-2 border-b"
            style={{
              gridTemplateColumns: '2.5rem 1fr auto',
              color: 'var(--text-muted)',
              borderColor: 'var(--border-soft)',
            }}
          >
            <span>#</span>
            <span>Issue</span>
            <span>Severity</span>
          </div>

          {displayLeaks.map((leak, i) => {
            const isSelected = selectedId === leak.id;
            return (
              <motion.div
                key={leak.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: isPreviewOnly ? i * 0.08 : 0.6 + i * 0.1, duration: 0.3 }}
                className="grid items-center px-4 py-3 border-b last:border-b-0 transition-all duration-150"
                style={{
                  gridTemplateColumns: '2.5rem 1fr auto',
                  borderColor: 'var(--border-soft)',
                  background: isSelected ? 'rgba(126,240,165,0.06)' : 'transparent',
                  boxShadow: isSelected ? 'inset 2px 0 0 var(--accent)' : 'none',
                  cursor: isPreviewOnly ? 'default' : 'pointer',
                }}
                onClick={() => { if (!isPreviewOnly) setSelectedId(isSelected ? null : leak.id); }}
                onMouseEnter={e => {
                  if (!isSelected && !isPreviewOnly) e.currentTarget.style.background = 'rgba(126,240,165,0.03)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(126,240,165,0.06)' : 'transparent';
                }}
              >
                <span
                  className="font-mono text-[11px]"
                  style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="font-mono text-[12px] tracking-wide"
                  style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {leak.title}
                </span>
                <span
                  className="font-mono text-[10px] font-bold tracking-[1px]"
                  style={{ color: SEVERITY_COLOR[leak.severity] }}
                >
                  {leak.severity}
                </span>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {revealed && selectedLeak ? (
            <LeakDetailPanel key={selectedLeak.id} leak={selectedLeak} />
          ) : revealed ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border px-5 py-6 font-mono text-[11px] tracking-[1.5px] uppercase text-center"
              style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
            >
              SELECT A LEAK TO VIEW DETAILS
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
