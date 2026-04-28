'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AuditResult, Category, CategoryScore, Severity, SignalRow } from './scannerTypes';

// ---------------------------------------------------------------------------
// Animated number
// ---------------------------------------------------------------------------
function AnimatedNumber({ target, duration = 1100 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(e * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return <>{current}</>;
}

// ---------------------------------------------------------------------------
// Signal row colour helper
// ---------------------------------------------------------------------------
function signalRowColor(state: SignalRow['state']): string {
  if (state === 'positive') return 'var(--accent)';
  if (state === 'warn')     return 'var(--warning)';
  if (state === 'danger')   return 'var(--danger)';
  return 'rgba(255,255,255,0.35)';
}

// ---------------------------------------------------------------------------
// Severity colour
// ---------------------------------------------------------------------------
const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--danger)',
  'HIGH IMPACT': 'var(--warning)',
  'LOW IMPACT': 'var(--text-muted)',
};

// ---------------------------------------------------------------------------
// Score gauge
// ---------------------------------------------------------------------------
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--accent)' : score >= 45 ? 'var(--warning)' : 'var(--danger)';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <motion.circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-[22px] font-bold leading-none" style={{ color }}>
          <AnimatedNumber target={score} duration={1200} />
        </span>
        <span className="font-mono text-[8px] tracking-[2px] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>
          / 100
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category score row
// ---------------------------------------------------------------------------
function CategoryScoreRow({ cs, delay }: { cs: CategoryScore; delay: number }) {
  const color = cs.worstSeverity ? SEVERITY_COLOR[cs.worstSeverity] : 'var(--accent)';
  const label = cs.worstSeverity ?? 'CLEAR';
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-center gap-3 px-3 py-2 border"
      style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elevated)' }}
    >
      <span className="font-mono text-[9px] tracking-[1.5px] uppercase shrink-0" style={{ color: 'var(--text-muted)', width: 110 }}>
        {cs.category}
      </span>
      <div className="flex-1 h-1 overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div style={{ background: color, height: '100%' }}
          initial={{ width: 0 }}
          animate={{ width: `${cs.score}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: delay + 0.15 }}
        />
      </div>
      <span className="font-mono text-[10px] font-bold shrink-0" style={{ color, width: 26, textAlign: 'right' }}>
        {cs.score}
      </span>
      <span className="font-mono text-[9px] tracking-[1px] uppercase shrink-0" style={{ color, opacity: 0.85, width: 82, textAlign: 'right' }}>
        {label}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Signal pill
// ---------------------------------------------------------------------------
function SignalPill({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] tracking-[1px] whitespace-nowrap"
      style={{
        borderColor: ok ? 'rgba(126,240,165,0.2)' : 'rgba(255,92,92,0.2)',
        background: ok ? 'rgba(126,240,165,0.04)' : 'rgba(255,92,92,0.04)',
        color: ok ? 'var(--text-secondary)' : 'var(--text-muted)',
      }}
    >
      <span style={{ color: ok ? 'var(--accent)' : 'var(--danger)', fontSize: 8 }}>{ok ? '●' : '○'}</span>
      <span>{label}</span>
      {value && <span style={{ color: ok ? 'var(--accent)' : 'var(--danger)', marginLeft: 2 }}>{value}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview skeleton
// ---------------------------------------------------------------------------
function PreviewSkeleton({ preview }: { preview: boolean }) {
  if (!preview) return null;
  const CATS: Category[] = ['DISCOVERY', 'TRUST', 'CLARITY', 'FLOW', 'DIFFERENTIATION', 'TECH HYGIENE'];
  return (
    <motion.div className="space-y-5" animate={{ opacity: 0.5, filter: 'blur(0.5px)' }}>
      <span className="font-mono text-[11px] tracking-[2px] uppercase" style={{ color: 'var(--text-muted)' }}>
        Diagnosis Score
      </span>
      <div className="flex items-start gap-6">
        <div className="shrink-0 rounded-full" style={{ width: 96, height: 96, border: '4px solid var(--border)', opacity: 0.4 }} />
        <div className="space-y-2 flex-1">
          <div className="h-3 rounded" style={{ background: 'var(--border)', width: '60%' }} />
          <div className="h-3 rounded" style={{ background: 'var(--border)', width: '80%' }} />
        </div>
      </div>
      <div className="space-y-1.5">
        {CATS.map(c => (
          <div key={c} className="h-8 border flex items-center px-3 gap-3"
            style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elevated)' }}>
            <span className="font-mono text-[9px] tracking-[1.5px] uppercase" style={{ color: 'var(--text-muted)', width: 110 }}>{c}</span>
            <div className="flex-1 h-1" style={{ background: 'var(--border)' }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border font-mono text-[10px] tracking-[1.5px] uppercase"
        style={{ borderColor: 'rgba(126,240,165,0.2)', background: 'rgba(126,240,165,0.04)', color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--accent)', fontSize: 8 }}>◆</span>
        ENTER A URL AND RUN AUDIT TO SEE YOUR DIAGNOSIS
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface ScanMapProps {
  revealed: boolean;
  preview: boolean;
  result: AuditResult | null;
  isUnlocked?: boolean;
  onFixFirst?: (issueId: string) => void;
}

export default function ScanMap({ revealed, preview, result, isUnlocked = false, onFixFirst }: ScanMapProps) {
  if (!revealed || !result) return <PreviewSkeleton preview={preview} />;

  const { score, verdict, whyScore, primaryFailure, topFixes, signals, categoryScores } = result;
  // One CRITICAL signal always shown, rest gated
  const firstCritical = result.issues.find(i => i.severity === 'CRITICAL') ?? result.issues[0];

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-[11px] tracking-[2px] uppercase" style={{ color: 'var(--text-muted)' }}>
          {isUnlocked ? 'Diagnosis Score' : 'Signal Detected'}
        </span>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="font-mono text-[10px] tracking-widest"
          style={{ color: isUnlocked ? 'var(--accent)' : 'var(--warning)' }}>
          {isUnlocked ? '● LIVE' : '◉ PARTIAL'}
        </motion.span>
      </div>

      {/* LOCKED: signal check + partial issues — path-aware */}
      {!isUnlocked && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-4"
        >
          {/* Classification badge */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.22)' }}>CLASSIFICATION:</span>
            <span className="font-mono text-[9px] tracking-[2px] uppercase font-bold" style={{ color: signalRowColor(result.signalLayers.signalRows[0]?.state ?? 'neutral') }}>
              {result.signalLayers.entityClass.label}
            </span>
          </div>

          {/* Root cause banner */}
          <div
            className="border px-5 py-4 space-y-1.5"
            style={{
              borderColor: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'rgba(0,255,136,0.25)' : result.signalLayers.entityClass.classification === 'UNVERIFIED'
                ? 'rgba(255,255,255,0.1)' : 'rgba(255,68,68,0.3)',
              background: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'rgba(0,255,136,0.03)' : result.signalLayers.entityClass.classification === 'UNVERIFIED'
                ? 'rgba(255,255,255,0.02)' : 'rgba(255,68,68,0.04)',
            }}
          >
            <div className="font-mono text-[9px] tracking-[2.5px] uppercase" style={{
              color: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'rgba(0,255,136,0.6)' : result.signalLayers.entityClass.classification === 'UNVERIFIED'
                ? 'rgba(255,255,255,0.3)' : 'rgba(255,68,68,0.7)',
              opacity: 0.9,
            }}>
              {result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY' ? 'ESTABLISHED ENTITY DETECTED'
                : result.signalLayers.entityClass.classification === 'UNVERIFIED' ? 'SCAN LIMITED'
                : 'WHY NOBODY CAME'}
            </div>
            <div className="font-mono text-[13px] font-bold leading-snug" style={{
              color: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'var(--accent)' : result.signalLayers.entityClass.classification === 'UNVERIFIED'
                ? 'rgba(255,255,255,0.6)' : 'var(--danger)',
            }}>
              {result.signalLayers.rootCause}
            </div>
            {result.signalLayers.subtext && (
              <div className="font-mono text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {result.signalLayers.subtext}
              </div>
            )}
          </div>

          {/* Signal Check table — from signalRows */}
          {result.signalLayers.signalRows.length > 0 && (
            <div className="border" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="px-4 py-2 border-b font-mono text-[9px] tracking-[2px] uppercase" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.28)' }}>
                [ SIGNAL CHECK ]
              </div>
              {result.signalLayers.signalRows.map((row: SignalRow, i: number, arr: SignalRow[]) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1 }}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                  <span className="font-mono text-[11px] font-bold tracking-[1px]" style={{ color: signalRowColor(row.state) }}>
                    {row.value}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Primary Issues */}
          {result.signalLayers.primaryIssues.length > 0 && (
            <div className="border" style={{
              borderColor: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.18)',
              background: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                ? 'rgba(0,255,136,0.02)' : 'rgba(255,68,68,0.03)',
            }}>
              <div className="px-4 py-2 border-b font-mono text-[9px] tracking-[2px] uppercase" style={{
                borderColor: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                  ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                color: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                  ? 'rgba(0,255,136,0.5)' : 'rgba(255,68,68,0.55)',
              }}>
                [ {result.signalLayers.issuesSectionLabel ?? 'PRIMARY ISSUES'} ]
              </div>
              <div className="px-4 py-3 space-y-2.5">
                {result.signalLayers.primaryIssues.map((issue, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.1 }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{
                      color: result.signalLayers.entityClass.classification === 'ESTABLISHED_ENTITY'
                        ? 'var(--accent)' : 'var(--danger)',
                      opacity: 0.65,
                    }}>●</span>
                    <span className="font-mono text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>{issue}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Hint at more */}
          {result.issues.length > 1 && (
            <div className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--warning)', opacity: 0.55 }}>+ {result.issues.length - 1} more findings in full breakdown</span>
            </div>
          )}
        </motion.div>
      )}

      {/* UNLOCKED: full scan map */}
      {isUnlocked && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {/* IF YOU FIX ONLY ONE THING banner */}
          <AnimatePresence>
            {primaryFailure && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="border px-4 py-3 space-y-2"
                style={{ borderColor: 'rgba(255,92,92,0.3)', background: 'rgba(255,92,92,0.05)', boxShadow: '0 0 16px rgba(255,92,92,0.06)' }}
              >
                <div className="font-mono text-[9px] tracking-[2.5px] uppercase" style={{ color: 'var(--danger)', opacity: 0.7 }}>
                  IF YOU FIX ONLY ONE THING
                </div>
                <div className="font-mono text-[13px] font-bold leading-snug" style={{ color: 'var(--danger)' }}>
                  {primaryFailure.title}
                </div>
                <div className="font-mono text-[10px] leading-[1.65] space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                  <div>THIS IS CAUSING:</div>
                  <div style={{ paddingLeft: 8 }}>— the largest drop-off on your page</div>
                  <div style={{ paddingLeft: 8 }}>— the most user hesitation</div>
                  <div style={{ paddingLeft: 8 }}>— the biggest missed conversion opportunity</div>
                </div>
                {onFixFirst && (
                  <button
                    onClick={() => onFixFirst(primaryFailure.id)}
                    className="font-mono text-[10px] tracking-[1.5px] uppercase px-3 py-1.5 border transition-all duration-150 mt-1"
                    style={{ borderColor: 'rgba(255,92,92,0.4)', color: 'var(--danger)', background: 'transparent' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,92,92,0.08)';
                      e.currentTarget.style.borderColor = 'var(--danger)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(255,92,92,0.4)';
                    }}
                  >
                    Fix my biggest problem →
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score + verdict */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex items-start gap-6">
            <ScoreGauge score={score} />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="font-mono text-[11px] tracking-[2px] uppercase" style={{ color: 'var(--text-muted)' }}>VERDICT</div>
              <p className="font-mono text-[12px] leading-[1.65]" style={{ color: 'var(--text-secondary)' }}>{verdict}</p>
              <div className="font-mono text-[10px] leading-[1.65]" style={{ color: 'var(--text-muted)' }}>{whyScore}</div>
              <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                {result.issues.filter(i => i.severity === 'CRITICAL').length} critical ·{' '}
                {result.issues.filter(i => i.severity === 'HIGH IMPACT').length} high impact ·{' '}
                {result.issues.filter(i => i.severity === 'LOW IMPACT').length} low impact
              </div>
            </div>
          </motion.div>

          {/* Score breakdown */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="space-y-1.5">
            <div className="font-mono text-[9px] tracking-[2px] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>BREAKDOWN</div>
            {categoryScores.map((cs, i) => (
              <CategoryScoreRow key={cs.category} cs={cs} delay={0.5 + i * 0.07} />
            ))}
          </motion.div>

          {/* WHAT TO FIX FIRST */}
          <AnimatePresence>
            {topFixes.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="border px-4 py-3 space-y-2"
                style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-elevated)' }}
              >
                <div className="font-mono text-[9px] tracking-[2.5px] uppercase" style={{ color: 'var(--text-muted)' }}>
                  WHAT TO FIX FIRST
                </div>
                {topFixes.map((issue, i) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 + i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <span className="font-mono text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className="font-mono text-[11px] leading-snug cursor-pointer transition-colors duration-150"
                        style={{ color: SEVERITY_COLOR[issue.severity] }}
                        onClick={() => onFixFirst?.(issue.id)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      >
                        {issue.title}
                      </span>
                      <span className="font-mono text-[9px] ml-2 tracking-[1px] uppercase" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                        {issue.severity}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signal pills */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <SignalPill label="Title" ok={!!signals.title} value={signals.title ? `${signals.title.length}ch` : 'missing'} />
              <SignalPill label="Description" ok={!!signals.description} value={signals.description ? `${signals.description.length}ch` : 'missing'} />
              <SignalPill label="H1" ok={!!signals.h1} value={signals.h1 ? 'found' : 'missing'} />
              <SignalPill label="Robots.txt" ok={signals.hasRobotsTxt && !signals.robotsBlocksRoot} value={signals.robotsBlocksRoot ? 'blocks /' : signals.hasRobotsTxt ? 'found' : 'missing'} />
              <SignalPill label="Sitemap" ok={signals.hasSitemap} value={signals.hasSitemap ? 'found' : 'missing'} />
              <SignalPill label="JSON-LD" ok={signals.structuredDataTypes.length > 0} value={signals.structuredDataTypes.length > 0 ? `${signals.structuredDataTypes.length} type${signals.structuredDataTypes.length > 1 ? 's' : ''}` : 'missing'} />
              <SignalPill label="OG Tags" ok={signals.hasOgTitle && signals.hasOgDescription && signals.hasOgImage} value={signals.hasOgTitle && signals.hasOgDescription && signals.hasOgImage ? 'complete' : 'incomplete'} />
              <SignalPill label="Canonical" ok={signals.hasCanonical} value={signals.hasCanonical ? 'set' : 'missing'} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SignalPill label="Product Proof" ok={signals.hasScreenshots} value={signals.hasScreenshots ? 'found' : 'missing'} />
              <SignalPill label="Testimonials" ok={signals.hasTestimonials} value={signals.hasTestimonials ? 'found' : 'missing'} />
              <SignalPill label="Post-Signup" ok={signals.hasPostSignupExplanation} value={signals.hasPostSignupExplanation ? 'explained' : 'missing'} />
              <SignalPill label="Pricing" ok={signals.hasPricingMention} value={signals.hasPricingMention ? 'mentioned' : 'missing'} />
              <SignalPill label="Privacy" ok={signals.hasPrivacyLink} value={signals.hasPrivacyLink ? 'linked' : 'missing'} />
              <SignalPill label="Terms" ok={signals.hasTermsLink} value={signals.hasTermsLink ? 'linked' : 'missing'} />
              <SignalPill label="Generic AI" ok={!signals.genericAIPattern} value={signals.genericAIPattern ? 'detected' : 'clear'} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
