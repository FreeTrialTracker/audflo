'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import AuditResults, { type AuditResultsHandle } from '@/components/diagnostic/AuditResults';
import ScanMap from '@/components/diagnostic/ScanMap';
import LeftPanel from '@/components/diagnostic/LeftPanel';
import { WaitlistModal } from '@/components/waitlist/waitlist-modal';
import { PaywallModal } from '@/components/waitlist/paywall-modal';
import { useWaitlist } from '@/components/waitlist/use-waitlist';
import ChunkErrorBoundary from '@/components/ChunkErrorBoundary';
import type { AuditResult } from '@/components/diagnostic/scannerTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────
function SysLabel({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className="sys-label mb-5 flex items-center gap-1.5" style={{ opacity: dim ? 0.5 : 0.8 }}>
      <span style={{ color: 'var(--accent)' }}>[ </span>
      {children}
      <span style={{ color: 'var(--accent)' }}> ]</span>
    </div>
  );
}

function Section({
  children,
  className = '',
  id = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.section>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />;
}

// ─── GSAP Signal Bars ─────────────────────────────────────────────────────
// Three clusters, each bar independently animated via requestAnimationFrame
type BarState = { current: number; target: number; speed: number; min: number; max: number };

function useSignalBars(count: number, min = 0.1, max = 1.0, speed = 0.03) {
  const barsRef = useRef<BarState[]>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    barsRef.current = Array.from({ length: count }, () => ({
      current: min + Math.random() * (max - min),
      target: min + Math.random() * (max - min),
      speed: speed * (0.5 + Math.random()),
      min,
      max,
    }));
    setHeights(barsRef.current.map(b => b.current));

    let frameCount = 0;
    const tick = () => {
      frameCount++;
      let updated = false;
      barsRef.current.forEach((bar, i) => {
        // Retarget randomly
        if (Math.abs(bar.current - bar.target) < 0.01 || frameCount % (40 + Math.floor(Math.random() * 60)) === i % 60) {
          bar.target = bar.min + Math.random() * (bar.max - bar.min);
        }
        const delta = (bar.target - bar.current) * bar.speed;
        if (Math.abs(delta) > 0.001) {
          bar.current += delta;
          updated = true;
        }
      });
      if (updated) setHeights(barsRef.current.map(b => b.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [count, min, max, speed]);

  return heights;
}

type ClusterConfig = {
  count: number;
  min: number;
  max: number;
  speed: number;
  color: string;
  glow: string;
};

function SignalCluster({ config, label }: { config: ClusterConfig; label: string }) {
  const heights = useSignalBars(config.count, config.min, config.max, config.speed);
  const [peak, setPeak] = useState(false);

  useEffect(() => {
    const avg = heights.reduce((s, h) => s + h, 0) / heights.length;
    setPeak(avg > config.max * 0.8);
  }, [heights, config.max]);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[10px] tracking-[2px] uppercase" style={{ color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
        {heights.map((h, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: `${h * 100}%`,
              background: config.color,
              opacity: 0.3 + h * 0.7,
              flexShrink: 0,
              transition: 'height 0.12s ease-out',
              boxShadow: peak ? `0 0 6px ${config.glow}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LiveSignalBars() {
  const clusters: { config: ClusterConfig; label: string }[] = [
    {
      label: 'DOES AI UNDERSTAND WHAT YOU ARE',
      config: { count: 16, min: 0.05, max: 0.4, speed: 0.025, color: '#ff4444', glow: 'rgba(255,68,68,0.6)' },
    },
    {
      label: 'ARE YOU SHOWING UP ANYWHERE',
      config: { count: 20, min: 0.1, max: 0.7, speed: 0.04, color: '#ffaa33', glow: 'rgba(255,170,51,0.6)' },
    },
    {
      label: 'ARE YOU BEING PICKED UP',
      config: { count: 14, min: 0.05, max: 0.35, speed: 0.02, color: '#00ff88', glow: 'rgba(0,255,136,0.6)' },
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {clusters.map(c => (
        <SignalCluster key={c.label} config={c.config} label={c.label} />
      ))}
    </div>
  );
}

// ─── HERO RIGHT: TERMINAL DIAGNOSIS PANEL ────────────────────────────────

// Typewriter hook — returns the portion of `text` revealed so far.
// `active` controls whether typing is in progress.
// Calls `onDone` when the full string has been typed.
function useTypewriter(text: string, active: boolean, speed = 38, onDone?: () => void) {
  const [displayed, setDisplayed] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    setDisplayed('');
    doneRef.current = false;
    if (!active) return;

    let i = 0;
    const tick = () => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        // vary speed slightly for realism
        const jitter = speed + Math.random() * speed * 0.5 - speed * 0.25;
        timerId = setTimeout(tick, jitter);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    let timerId = setTimeout(tick, speed);
    return () => clearTimeout(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);

  return displayed;
}

// Phases of the animation — each phase has a distinct visual character.
// "type"  → typewriter effect on cmd lines
// "scan"  → rows drop in one by one after a short pause
// "reveal"→ analysis blocks fade in sequentially
// "idle"  → cursor blinks, hold before reset
type Phase = 'type1' | 'type2' | 'scan' | 'reveal' | 'idle';

const SCAN_DOMAINS = ['yourproduct.com', 'myapp.io', 'builtwithvibes.co', 'indie-launch.app'];

const SCAN_ROWS = [
  { icon: '✖', label: 'AI understands your product',   value: 'NO',      vc: '#e05555' },
  { icon: '✖', label: 'Your product is being cited',   value: 'NO',      vc: '#e05555' },
  { icon: '⚠', label: 'Anything online supports you',  value: 'WEAK',    vc: '#d4922a' },
  { icon: '✖', label: 'Clear explanation of what you do', value: 'MISSING', vc: '#e05555' },
  { icon: '⚠', label: 'Showing up anywhere',           value: 'LIMITED', vc: '#d4922a' },
];

// A single typewriter line with its own cursor while typing
function TypeLine({
  text,
  active,
  speed,
  color,
  onDone,
  style,
}: {
  text: string;
  active: boolean;
  speed?: number;
  color?: string;
  onDone?: () => void;
  style?: React.CSSProperties;
}) {
  const displayed = useTypewriter(text, active, speed, onDone);
  const done = displayed.length === text.length;

  return (
    <div
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 12,
        lineHeight: 1.75,
        color: color ?? 'rgba(255,255,255,0.3)',
        ...style,
      }}
    >
      {displayed}
      {active && !done && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 13,
            background: 'var(--accent)',
            opacity: 0.75,
            marginLeft: 1,
            verticalAlign: 'middle',
          }}
        />
      )}
    </div>
  );
}

function HeroTerminalPanel() {
  const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };
  const LBL: React.CSSProperties  = { ...MONO, fontSize: 9, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.45)', marginBottom: 6 };

  const [cycle,       setCycle]       = useState(0);
  const [domain,      setDomain]      = useState(SCAN_DOMAINS[0]);
  const [phase,       setPhase]       = useState<Phase>('type1');
  const [scanCount,   setScanCount]   = useState(0);
  const [revealCount, setRevealCount] = useState(0);

  // Reset everything when cycle increments
  useEffect(() => {
    setDomain(SCAN_DOMAINS[cycle % SCAN_DOMAINS.length]);
    setPhase('type1');
    setScanCount(0);
    setRevealCount(0);
  }, [cycle]);

  // Drive scan rows appearing one by one during 'scan' phase
  useEffect(() => {
    if (phase !== 'scan') return;
    if (scanCount >= SCAN_ROWS.length) {
      const t = setTimeout(() => setPhase('reveal'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setScanCount(c => c + 1), 260);
    return () => clearTimeout(t);
  }, [phase, scanCount]);

  // Drive analysis sections appearing one by one during 'reveal' phase
  const REVEAL_ITEMS = 7; // labels + bullets
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (revealCount >= REVEAL_ITEMS) {
      const t = setTimeout(() => setPhase('idle'), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealCount(c => c + 1), 180);
    return () => clearTimeout(t);
  }, [phase, revealCount]);

  // Hold in idle then restart
  useEffect(() => {
    if (phase !== 'idle') return;
    const t = setTimeout(() => setCycle(c => c + 1), 5500);
    return () => clearTimeout(t);
  }, [phase]);

  const cmd1 = '> analyzing why nobody came...';
  const cmd2 = `> scanning ${domain}`;

  const vis = (idx: number) => revealCount > idx;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-deep)', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '0 24px', height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
          WHY NOBODY CAME
        </span>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          style={{ ...MONO, fontSize: 10, color: 'var(--accent)' }}
        >
          ● LIVE
        </motion.span>
      </div>

      {/* ── BODY ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={cycle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ flex: 1, minHeight: 0, overflowY: 'hidden', padding: '18px 24px 0', display: 'flex', flexDirection: 'column' }}
        >
          {/* PHASE 1 — typewriter cmd lines */}
          <div style={{ marginBottom: 14 }}>
            <div style={LBL}>SCAN OUTPUT</div>

            <TypeLine
              text={cmd1}
              active={phase === 'type1'}
              speed={36}
              color="rgba(255,255,255,0.22)"
              onDone={() => setPhase('type2')}
            />

            {(phase !== 'type1') && (
              <TypeLine
                text={cmd2}
                active={phase === 'type2'}
                speed={42}
                color="rgba(255,255,255,0.22)"
                onDone={() => { setScanCount(0); setPhase('scan'); }}
              />
            )}
          </div>

          {/* PHASE 2 — scan rows drop in */}
          {(phase === 'scan' || phase === 'reveal' || phase === 'idle') && (
            <div style={{ marginBottom: 14 }}>
              {SCAN_ROWS.slice(0, scanCount).map((row, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ ...MONO, fontSize: 12, lineHeight: 1.8, display: 'flex', alignItems: 'baseline' }}
                >
                  <span style={{ color: row.vc, width: 18, flexShrink: 0 }}>{row.icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', flex: 1 }}>
                    {row.label}
                    <span style={{ color: 'rgba(255,255,255,0.09)' }}>
                      {' '}{'·'.repeat(Math.max(2, 22 - row.label.length))}{' '}
                    </span>
                  </span>
                  <motion.span
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
                    style={{ color: row.vc, fontWeight: 700, letterSpacing: '0.5px' }}
                  >
                    {row.value}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          )}

          {/* PHASE 3 — analysis sections reveal */}
          {(phase === 'reveal' || phase === 'idle') && (
            <>
              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: vis(0) ? 1 : 0 }}
                transition={{ duration: 0.4 }}
                style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 14 }}
              />

              {/* Primary failure */}
              {vis(0) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={LBL}>PRIMARY FAILURE</div>
                  {vis(1) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      style={{ ...MONO, fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginBottom: 8 }}
                    >
                      Your product is invisible.
                    </motion.div>
                  )}
                  {vis(2) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                      <div style={{ ...MONO, fontSize: 9, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>WHY THIS HAPPENS:</div>
                      {['AI does not understand what you are', 'Your product is not being cited', 'No clear explanation of what you do'].map(l => (
                        <div key={l} style={{ ...MONO, fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>•</span>{l}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Impact */}
              {vis(3) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={LBL}>IMPACT</div>
                  {[
                    { text: 'Not included in AI answers',  c: '#cc4444' },
                    { text: 'Not recommended',             c: '#cc4444' },
                    { text: 'No users',                    c: '#b87820' },
                  ].map((item, idx) => vis(4 + idx) && (
                    <motion.div
                      key={item.text}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ ...MONO, fontSize: 12, lineHeight: 1.75, color: item.c }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>•</span>{item.text}
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />
        </motion.div>
      </AnimatePresence>

      {/* ── CURSOR LINE ── */}
      <div style={{ padding: '10px 24px 14px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="cursor-blink" style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          &gt; awaiting input_
        </span>
      </div>
    </div>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────
function StageHero({ onRunScan, onGetAccess }: { onRunScan: () => void; onGetAccess: () => void }) {
  const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };

  return (
    <section
      className="relative overflow-hidden sys-grid"
      style={{ background: 'var(--bg)' }}
    >
      {/* Nav — fixed height */}
      <div
        className="relative z-10 flex items-center justify-between border-b"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          height: 52,
          flexShrink: 0,
          padding: '0 clamp(20px, 4vw, 48px)',
        }}
      >
        <span style={{ ...MONO, fontSize: 14, letterSpacing: '2px', fontWeight: 600, color: 'var(--text-primary)' }}>
          AudFlo
        </span>
        <button onClick={onGetAccess} className="sys-btn">
          Get Access
        </button>
      </div>

      {/* Body — desktop: two-column grid; mobile: single column */}
      <div
        className="relative z-10 hero-body"
      >
        {/* ── LEFT COLUMN ── */}
        <div
          className="hero-left border-b md:border-b-0 md:border-r"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {/* [ SYSTEM ACTIVE ] */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.06, duration: 0.5 }}
            style={{ marginBottom: 18 }}
          >
            <SysLabel>SYSTEM ACTIVE</SysLabel>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: 20 }}
          >
            <h1
              style={{
                fontSize: 'clamp(44px, 5.6vw, 88px)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              You launched.<br />
              <span style={{ color: 'var(--accent)' }}>Nobody came.</span>
            </h1>
          </motion.div>

          {/* Sub-headline stacked */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.7 }}
            style={{
              ...MONO,
              fontSize: 'clamp(12px, 1.1vw, 14px)',
              lineHeight: 1.9,
              maxWidth: 400,
              marginBottom: 28,
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.6)' }}>You are not ranking.</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>You are not being cited.</div>
            <div style={{ color: 'rgba(255,255,255,0.42)' }}>AI does not ignore bad products.</div>
            <div style={{ color: 'rgba(255,255,255,0.42)' }}>It ignores products it cannot understand.</div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.58 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <button
              onClick={onRunScan}
              className="sys-btn"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 12, letterSpacing: 2, alignSelf: 'flex-start' }}
            >
              [ RUN CHECK → ]
            </button>
            <p style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' }}>
              No signup required for first check.
            </p>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN — terminal panel ── */}
        <motion.div
          className="hero-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.8 }}
        >
          <HeroTerminalPanel />
        </motion.div>
      </div>

      {/* Bottom status bar */}
      <div
        className="relative z-10 flex items-center justify-between border-t"
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          height: 36,
          flexShrink: 0,
          padding: '0 clamp(20px, 4vw, 48px)',
        }}
      >
        <span style={{ ...MONO, fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,0.12)', textTransform: 'uppercase' }}>
          Real-time system for fixing why nobody came after you launched.
        </span>
        <motion.span
          animate={{ opacity: [0.25, 0.65, 0.25] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{ ...MONO, fontSize: 10, letterSpacing: '2px', color: 'var(--accent)' }}
        >
          ● SYSTEM ACTIVE
        </motion.span>
      </div>
    </section>
  );
}

// ─── RELATABLE MOMENT BLOCK ───────────────────────────────────────────────
function RelatableMoment() {
  const lines = [
    { text: 'You posted it.',  delay: 0 },
    { text: 'You shared it.',  delay: 0.18 },
    { text: 'You waited.',     delay: 0.36 },
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div
        className="px-6 lg:px-14 py-12 lg:py-16 flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-24"
        style={{ background: 'var(--bg-deep)' }}
      >
        {/* Left: emotional lines */}
        <div className="shrink-0 space-y-1">
          <div className="mb-4">
            <SysLabel>WHY NOTHING HAPPENED</SysLabel>
          </div>
          {lines.map(({ text, delay }) => (
            <motion.p
              key={text}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 'clamp(18px, 2.2vw, 28px)',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {text}
            </motion.p>
          ))}
        </div>

        {/* Vertical divider on large screens */}
        <div className="hidden lg:block shrink-0" style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

        {/* Right: the reframe */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45, duration: 0.7 }}
          >
            <p
              style={{
                fontSize: 'clamp(22px, 2.8vw, 40px)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginBottom: 6,
              }}
            >
              You don't have a traffic problem.
            </p>
            <p
              style={{
                fontSize: 'clamp(22px, 2.8vw, 40px)',
                fontWeight: 800,
                color: 'var(--accent)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              You have a distribution problem.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="space-y-1 font-mono"
            style={{ fontSize: 'clamp(12px, 1.1vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.8 }}
          >
            <div>AI already sees your site.</div>
            <div>It just doesn't understand it.</div>
            <div>So it doesn't show it.</div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.95, duration: 0.5 }}
            className="font-mono text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            No understanding → no recommendation → no users
          </motion.p>
        </div>
      </div>
    </Section>
  );
}

// ─── BUILT FOR SECTION ────────────────────────────────────────────────────
function StageBuiltFor() {
  const audience = [
    { label: 'Solo founders',       desc: 'Who built something real and shipped it alone.' },
    { label: 'Indie hackers',       desc: 'Who move fast and need signal, not process.' },
    { label: 'Vibe coders',         desc: 'Who built with AI and are learning distribution.' },
    { label: 'AI builders',         desc: 'Who shipped fast and got no traction.' },
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg)' }}>
        <div
          className="px-6 lg:px-14 py-8 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <SysLabel>BUILT FOR</SysLabel>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {audience.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.55 }}
              className="border-r last:border-r-0 px-8 py-8"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: 8,
                }}
              >
                {a.label}
              </div>
              <div
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.28)',
                  lineHeight: 1.6,
                  letterSpacing: '0.2px',
                }}
              >
                {a.desc}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── SIGNAL DETECTION SECTION ─────────────────────────────────────────────
function StageSignalDetection() {
  const steps = [
    'Checking if AI can find you...',
    'Checking if AI can explain what you do...',
    'Checking if anything online references you...',
    'Finding where you disappear...',
    'Finding who is getting picked up instead...',
  ];
  const [visible, setVisible] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  useEffect(() => {
    if (!inView) return;
    steps.forEach((_, i) => setTimeout(() => setVisible(i + 1), i * 750));
  }, [inView]);

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
        {/* Left: live bars */}
        <div
          className="flex flex-col justify-between px-6 lg:px-14 py-14 border-r sys-grid"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}
        >
          <div>
            <SysLabel>WHY NOBODY CAME</SysLabel>
            <h2
              style={{
                fontSize: 'clamp(36px, 4.5vw, 66px)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 0.92,
                color: 'var(--text-primary)',
              }}
            >
              This is where<br />you lose<br /><span style={{ color: 'var(--accent)' }}>users.</span>
            </h2>
          </div>
          <div className="mt-10 lg:mt-0">
            <LiveSignalBars />
          </div>
        </div>

        {/* Right: why it matters */}
        <div className="flex flex-col justify-center px-8 lg:px-14 py-14 space-y-10" style={{ background: 'var(--bg)' }}>
          {/* Core message */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-3 pb-6 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              AI is trying to answer questions.
            </p>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              It pulls from what it understands.
            </p>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              If your product is unclear,<br />
              or not referenced anywhere,
            </p>
            <p className="font-mono text-[13px] font-semibold" style={{ color: 'var(--danger)' }}>
              you get skipped.
            </p>
          </motion.div>

          <div className="space-y-3">
            <p
              className="font-sans font-semibold"
              style={{ fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}
            >
              This is where you lose users.
            </p>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Before anyone clicks.<br />
              Before anyone signs up.
            </p>
            <p className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
              You disappear here.
            </p>
          </div>

          <div className="space-y-2 border-l-2 pl-5" style={{ borderColor: 'var(--border)' }}>
            <div className="font-mono text-[11px] tracking-[2px] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              SCANNING NOW
            </div>
            {steps.map((step, i) => (
              <AnimatePresence key={step}>
                {visible > i && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="font-mono text-[12px] flex items-center gap-2"
                    style={{ color: visible === i + 1 ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    <span style={{ opacity: visible === i + 1 ? 1 : 0.4 }}>&gt;</span>
                    {step}
                    {visible === i + 1 && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        style={{ color: 'var(--accent)' }}
                      >
                        _
                      </motion.span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>

          {/* Bottom line */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="pt-2 border-t space-y-1"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
              You are not competing on quality.
            </p>
            <p className="font-mono text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              You are competing on being understood.
            </p>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

// ─── GAP DETECTION ────────────────────────────────────────────────────────
type NodeStatus = 'critical' | 'partial' | 'strong';
const STATUS_COLOR: Record<NodeStatus, string> = {
  critical: '#ff4444',
  partial: '#ffaa33',
  strong: '#00ff88',
};

interface PNode {
  id: string;
  label: string;
  badge: string;
  tooltip: string;
  detail: string;
  status: NodeStatus;
}

const PIPELINE: PNode[] = [
  { id: 'entity',    label: 'WHAT YOU ARE',    badge: 'UNCLEAR', tooltip: 'AI cannot explain what your product is',          detail: 'No clear definition AI can use or repeat',        status: 'critical' },
  { id: 'structure', label: 'WHERE YOU SHOW',  badge: 'WEAK',    tooltip: 'You are barely showing up anywhere',               detail: 'Not present in places AI looks for answers',      status: 'partial'  },
  { id: 'authority', label: 'WHAT SUPPORTS',   badge: 'WEAK',    tooltip: 'Nothing online supports or backs you',             detail: 'No mentions, no references outside your site',    status: 'partial'  },
  { id: 'citations', label: 'AI CAN EXPLAIN',  badge: 'NO',      tooltip: 'AI cannot explain your product to anyone',         detail: 'No content for AI to pull from or reference',     status: 'critical' },
  { id: 'class',     label: 'BEING PICKED UP', badge: 'LOW',     tooltip: 'You are not being picked up in AI answers',        detail: 'AI skips you because it does not understand you', status: 'partial'  },
];

const STOPS_AT = 0; // signal dies at entity node

function PipelineDiagram({ hovered, onHover }: { hovered: string | null; onHover: (id: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [sigAt, setSigAt] = useState(-1);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const ts: ReturnType<typeof setTimeout>[] = [];
    PIPELINE.forEach((n, i) => ts.push(setTimeout(() => setShown(p => ({ ...p, [n.id]: true })), 250 + i * 180)));
    const total = 250 + PIPELINE.length * 180 + 150;
    PIPELINE.forEach((_, i) => ts.push(setTimeout(() => setSigAt(i), total + i * 360)));
    ts.push(setTimeout(() => setBlocked(true), total + STOPS_AT * 360 + 300));
    return () => ts.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="w-full px-4 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-0">
        {PIPELINE.map((node, i) => {
          const isShown   = !!shown[node.id];
          const isHov     = hovered === node.id;
          const isActive  = sigAt >= i;
          const isBlock   = blocked && i === STOPS_AT;
          const isDim     = !isActive && sigAt >= 0;
          const color     = isShown ? STATUS_COLOR[node.status] : 'rgba(255,255,255,0.07)';

          return (
            <div key={node.id} className="flex items-center flex-1 last:flex-none">
              <motion.div
                className="flex flex-col items-center gap-2 cursor-pointer relative"
                initial={{ opacity: 0, y: 10 }}
                animate={isShown ? { opacity: isDim && !isHov ? 0.28 : 1, y: 0, scale: isHov ? 1.1 : isBlock ? 1.06 : 1 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                style={{ zIndex: isHov ? 10 : 1 }}
              >
                {/* Glow */}
                {(isBlock || isHov || (node.status === 'critical' && blocked)) && isShown && (
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{
                      inset: -10,
                      background: `radial-gradient(ellipse, ${color}1a 0%, transparent 70%)`,
                      boxShadow: `0 0 ${isBlock ? 28 : 16}px ${color}55`,
                    }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}

                {/* Box */}
                <motion.div
                  className="flex flex-col items-center justify-center px-2 lg:px-3 py-2.5 border"
                  style={{
                    minWidth: 52,
                    borderColor: isShown ? `${color}${isActive ? 'cc' : '44'}` : 'rgba(255,255,255,0.05)',
                    background: isShown ? `linear-gradient(135deg, ${color}0c 0%, rgba(5,6,6,0.96) 55%)` : 'rgba(5,6,6,0.9)',
                  }}
                  animate={isBlock ? { borderColor: [`${color}77`, `${color}ff`, `${color}77`] } : {}}
                  transition={{ duration: 1.1, repeat: Infinity }}
                >
                  {/* Dot */}
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full mb-1.5"
                    style={{ background: isShown ? color : 'rgba(255,255,255,0.08)' }}
                    animate={node.status === 'critical' && blocked ? { opacity: [0.4, 1, 0.4], scale: [0.8, 1.3, 0.8] } : {}}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <div
                    className="font-mono uppercase font-bold text-center"
                    style={{ fontSize: 'clamp(9px, 1.1vw, 12px)', letterSpacing: '1px', color: isShown ? color : 'rgba(255,255,255,0.15)', lineHeight: 1.2 }}
                  >
                    {node.label}
                  </div>
                  {isShown && (
                    <div
                      className="font-mono uppercase mt-1.5 px-1 py-0.5 border text-center"
                      style={{ fontSize: 10, color, borderColor: `${color}44`, background: `${color}0c`, letterSpacing: '0.5px' }}
                    >
                      {node.badge}
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Connector */}
              {i < PIPELINE.length - 1 && (
                <div className="flex-1 relative mx-1" style={{ minWidth: 12, height: 1 }}>
                  {/* Dashed base for weak links */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: node.status !== 'strong'
                        ? `repeating-linear-gradient(90deg, ${color}33 0px, ${color}33 4px, transparent 4px, transparent 9px)`
                        : `linear-gradient(90deg, ${color}55, ${color}33)`,
                    }}
                  />
                  {sigAt > i && (
                    <motion.div
                      className="absolute inset-y-0 left-0"
                      style={{ background: i < STOPS_AT ? STATUS_COLOR.critical : 'rgba(255,255,255,0.1)', opacity: 0.4 }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.28, ease: 'linear' }}
                    />
                  )}
                  {sigAt === i && !blocked && (
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                      style={{ background: '#00d4ff', boxShadow: '0 0 8px #00d4ff' }}
                      initial={{ left: '0%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 0.32, ease: 'linear' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={blocked ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-5 font-mono text-[12px] flex items-center gap-2"
        style={{ color: STATUS_COLOR.critical }}
      >
        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>●</motion.span>
        You get skipped — AI cannot understand or recommend you
      </motion.div>
    </div>
  );
}

function StageGapDetection({ onRunScan }: { onRunScan: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hNode = PIPELINE.find(n => n.id === hovered) ?? null;

  return (
    <Section id="gap-detection" className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="px-6 lg:px-14 py-14 space-y-10">
        <div>
          <SysLabel>WHERE YOU ARE LOSING USERS</SysLabel>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--cyan)' }}>
            You lose users<br />before they<br />even see you.
          </h2>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}>
          <PipelineDiagram hovered={hovered} onHover={setHovered} />
          <div className="border-t px-6 py-4 min-h-[76px] flex items-center" style={{ borderColor: 'var(--border)' }}>
            <AnimatePresence mode="wait">
              {hNode ? (
                <motion.div
                  key={hNode.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] tracking-[2px] uppercase" style={{ color: STATUS_COLOR[hNode.status] }}>{hNode.label}</span>
                    <span className="font-mono text-[11px] uppercase px-1.5 py-0.5 border" style={{ borderColor: `${STATUS_COLOR[hNode.status]}44`, color: STATUS_COLOR[hNode.status], background: `${STATUS_COLOR[hNode.status]}0c` }}>{hNode.badge}</span>
                  </div>
                  <div className="font-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>{hNode.tooltip}</div>
                  <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hNode.detail}</div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="font-mono text-[11px] tracking-[1.5px] uppercase" style={{ color: 'var(--text-dim)' }}>
                  HOVER A NODE TO INSPECT
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              AI looks for answers.
            </p>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              It pulls from things it understands<br />and sees repeated across the internet.
            </p>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              If your product is unclear<br />or not mentioned anywhere,
            </p>
            <p className="font-mono text-[13px] font-semibold" style={{ color: 'var(--danger)' }}>
              you get skipped.
            </p>
            <p className="font-mono text-[13px] leading-relaxed border-l-2 pl-4 pt-1" style={{ color: 'var(--text-primary)', borderColor: 'var(--danger)', fontWeight: 600 }}>
              This is where your distribution breaks.
            </p>
          </div>

          <div className="space-y-6">
            {/* Subtext box */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <p className="font-sans font-semibold text-[18px] leading-snug" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Your product is not being discovered.
              </p>
              <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Not because it's bad.
              </p>
              <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Because it's not showing up.
              </p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              onClick={onRunScan} className="sys-btn"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              [ Run Check → ]
            </motion.button>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── LIVE SCAN ────────────────────────────────────────────────────────────
function LockedPanel({ onUnlock }: { onUnlock: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-5">
      <div className="border px-5 py-4" style={{ borderColor: 'rgba(255,68,68,0.25)', background: 'rgba(255,68,68,0.04)' }}>
        <div className="font-sans font-bold text-[17px] leading-tight mb-1.5" style={{ color: 'var(--danger)', letterSpacing: '-0.02em' }}>
          You are invisible to AI search and citation systems
        </div>
        <div className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>This is your highest-impact issue right now</div>
      </div>
      <div className="border relative overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6"
          style={{ backdropFilter: 'blur(10px)', background: 'rgba(5,6,6,0.62)' }}>
          <div className="text-center">
            <div className="font-mono text-[11px] tracking-[2.5px] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>[ DIAGNOSIS LOCKED ]</div>
            <div className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>Full diagnosis requires system access</div>
          </div>
          <motion.button whileHover={{ boxShadow: '0 0 20px rgba(0,255,136,0.12)' }}
            onClick={onUnlock} className="sys-btn"
            style={{ borderColor: 'rgba(0,255,136,0.4)', color: 'rgba(0,255,136,0.75)' }}>
            UNLOCK FULL DIAGNOSIS →
          </motion.button>
        </div>
        <div className="px-5 py-5 space-y-3" style={{ filter: 'blur(3px)', userSelect: 'none', pointerEvents: 'none' }}>
          <div className="font-mono text-[11px] tracking-[2px] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>DIAGNOSIS REPORT</div>
          {['What AI understands about you', 'Where you are being mentioned', 'What supports you online', 'Where you show up in answers', 'How you get discovered'].map(l => (
            <div key={l} className="flex justify-between py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{l}</span>
              <span className="font-mono text-[14px] font-bold" style={{ color: 'var(--text-muted)' }}>?</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── EXECUTION LAYER ──────────────────────────────────────────────────────────

function ExecutionLayer({ result, onWaitlistOpen, MONO }: {
  result: AuditResult | null;
  onWaitlistOpen: () => void;
  MONO: React.CSSProperties;
}) {
  const [planVisible, setPlanVisible] = useState(false);
  const [checklist, setChecklist] = useState([false, false, false, false]);
  const layers = result?.signalLayers;
  const classification = layers?.entityClass?.classification ?? 'EARLY_PRODUCT';
  const isEstablished = classification === 'ESTABLISHED_ENTITY';
  const isUnverified  = classification === 'UNVERIFIED';

  // Derive a product category hint from the scanned URL hostname
  const hostname = (() => { try { return new URL(result?.url ?? '').hostname.replace('www.', ''); } catch { return 'your product'; } })();
  const productRef = isEstablished ? hostname : 'your product';

  // First 3 moves — path-specific
  const firstMoves: { num: string; action: string; detail: string; color: string }[] = isUnverified ? [
    { num: '01', action: 'Fix page crawlability so discovery systems can read it', detail: 'Ensure key content renders in the initial HTML response — not only after JavaScript executes', color: 'var(--warning)' },
    { num: '02', action: 'Submit your URL to Google Search Console', detail: 'Force a crawl request after fixing the page content exposure issues', color: 'var(--warning)' },
    { num: '03', action: 'Test with JavaScript disabled in your browser', detail: 'If the page looks empty, that is exactly what crawlers see', color: 'var(--warning)' },
  ] : isEstablished ? [
    { num: '01', action: 'Rewrite your homepage headline to explain what users get in 5 seconds', detail: 'Replace abstract benefit language with a specific outcome for a specific user', color: 'var(--accent)' },
    { num: '02', action: 'Add a section showing what happens after clicking your main CTA', detail: 'Walk through the first 3 steps of the experience so users know what to expect', color: 'var(--accent)' },
    { num: '03', action: `Publish 1 comparison or use-case page for ${productRef}`, detail: 'Comparison pages are a primary driver of AI citation — they give AI a clear reason to mention you', color: 'var(--accent)' },
  ] : [
    { num: '01', action: 'Post 1 answer on Reddit solving a real problem your product addresses', detail: 'Find a thread where users are already asking for this. Answer it. Mention your product naturally at the end.', color: 'var(--accent)' },
    { num: '02', action: 'Write 1 X thread explaining what your product does in plain English', detail: 'Avoid jargon. Explain like you are talking to a user, not a builder. Tell them the specific problem you solve.', color: 'var(--accent)' },
    { num: '03', action: 'Publish 1 simple SEO page: "What is [your product category]"', detail: 'This helps AI understand and categorize what you do. It surfaces in AI-generated answers about your space.', color: 'var(--accent)' },
  ];

  const firstMovesSubtext = isUnverified
    ? 'These are the minimum steps to make your page readable to discovery systems.'
    : isEstablished
    ? 'You are already visible. Now you need to convert and be chosen.'
    : 'These are the minimum signals needed for discovery to start.';

  // Distribution plan content — path-specific
  const platforms = isEstablished ? [
    { name: 'Your homepage', desc: 'Where first-time visitors decide whether to stay or leave' },
    { name: 'Comparison pages', desc: 'Where AI pulls structured answers about product alternatives' },
    { name: 'Use-case pages', desc: 'Where intent-matched traffic finds your specific solution' },
    { name: 'LinkedIn', desc: 'Authority and trust layer for decision-makers' },
  ] : isUnverified ? [
    { name: 'Server-rendered HTML', desc: 'Where crawlers read your page content reliably' },
    { name: 'Google Search Console', desc: 'Where you monitor crawl errors and indexation status' },
    { name: 'robots.txt', desc: 'Where you control what crawlers are allowed to access' },
  ] : [
    { name: 'Reddit', desc: 'Where users ask and answers get reused by AI systems' },
    { name: 'X (Twitter)', desc: 'Where discovery starts and ideas spread through shares' },
    { name: 'SEO pages', desc: 'Where AI pulls structured answers about your product category' },
    { name: 'LinkedIn', desc: 'Authority and trust layer for professional audiences' },
  ];

  const redditPost = isEstablished ? null : {
    title: `"How are you solving [the problem ${productRef} addresses]?"`,
    body: `I've been struggling with [problem]. Most tools either [pain point] or require [pain point].\n\nRecently tried [product category] and it helped with [specific outcome].\n\nCurious how others are solving this.`,
  };

  const xThread = isEstablished ? [
    `Most products get passed over not because they're worse.\n\nBut because visitors can't tell what they do in the first 5 seconds.`,
    `The homepage is a first impression.\n\nIf a new visitor can't answer "what is this and who is it for" in under 5 seconds, the page is losing them.`,
    `The fix is almost always the same: replace abstract benefit language with a specific outcome for a specific user.`,
  ] : [
    `Most people launch and get silence.\n\nNot because the product is bad.\n\nBecause nobody understands it.`,
    `If AI cannot understand your product, it cannot recommend it.\n\nThat is the real distribution problem nobody talks about.`,
    `The fix: define what you do in one sentence. Post it. Get it mentioned outside your site. Repeat.`,
  ];

  const seoPage = {
    title: isEstablished ? `"[Product name] vs [Alternative] — Which is right for you?"` : `"What is [your product category]?"`,
    sections: isEstablished
      ? ['What each product does', 'Who each is built for', 'Key differences', 'When to choose each']
      : ['What it is', 'Who it is for', 'Why it matters', 'Example use case'],
  };

  const checklistItems = isEstablished ? [
    'Rewrite homepage headline with specific outcome',
    'Add post-CTA "what happens next" section',
    'Publish 1 comparison page',
    'Test page as a first-time visitor',
  ] : isUnverified ? [
    'Fix server-side rendering for key content',
    'Check robots.txt is not blocking crawlers',
    'Submit URL to Google Search Console',
    'Test page with JavaScript disabled',
  ] : [
    'Post 1 Reddit answer in a relevant community',
    'Publish 1 X thread about your problem space',
    'Create 1 SEO page for your product category',
    'Reply to 10 posts where your target user asks for help',
  ];

  const toggleCheck = (i: number) => setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '0 28px 48px', display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      {/* AuditResults full breakdown */}
      <div style={{ paddingTop: 4 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.22)', marginBottom: 16, paddingTop: 16 }}>
          [ FULL ISSUE BREAKDOWN ]
        </div>
        <AuditResults ref={null} revealed={true} preview={false} result={result} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── WHAT TO DO NEXT ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.28)', marginBottom: 18 }}>
          [ WHAT TO DO NEXT ]
        </div>

        {/* First 3 moves block */}
        <div style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.35)' }}>FIRST 3 MOVES</span>
            <span style={{ ...MONO, fontSize: 9, letterSpacing: '1px', color: 'rgba(255,255,255,0.2)' }}>EXECUTABLE IN 30 MIN EACH</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {firstMoves.map((move, i) => (
              <motion.div
                key={move.num}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                style={{ padding: '14px 16px', borderBottom: i < firstMoves.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}
              >
                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: move.color, opacity: 0.6, flexShrink: 0, paddingTop: 1 }}>{move.num}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{move.action}</span>
                  <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55 }}>→ {move.detail}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>{firstMovesSubtext}</span>
          </div>
        </div>
      </motion.div>

      {/* ── GET USERS ENGINE ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        {!planVisible ? (
          <div style={{ border: '1px solid rgba(0,255,136,0.2)', background: 'rgba(0,255,136,0.03)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(0,255,136,0.55)' }}>[ GET YOUR FIRST USERS ]</span>
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              We generate exactly what to publish, where to publish it, and how to get discovered.
            </div>
            <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>
              {isEstablished
                ? 'A page-level execution plan tailored to an established product trying to convert first-time visitors.'
                : isUnverified
                ? 'A crawlability fix plan so search engines and AI systems can actually read your page.'
                : 'A distribution execution plan for a new product trying to get discovered from zero.'
              }
            </div>
            <button
              onClick={onWaitlistOpen}
              className="sys-btn"
              style={{ ...MONO, fontSize: 11, letterSpacing: '2px', borderColor: 'var(--accent)', color: 'var(--accent)', padding: '12px 20px', background: 'rgba(0,255,136,0.05)', textAlign: 'center', whiteSpace: 'nowrap', marginTop: 4 }}
            >
              [ GENERATE DISTRIBUTION PLAN → ]
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ border: '1px solid rgba(0,255,136,0.2)', background: 'rgba(0,255,136,0.03)', padding: '12px 16px' }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(0,255,136,0.6)' }}>[ DISTRIBUTION EXECUTION PLAN ]</span>
            </div>

            {/* A. Platform Targeting */}
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.28)' }}>A. PLATFORM TARGETING</span>
              </div>
              {platforms.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{ padding: '12px 16px', borderBottom: i < platforms.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <span style={{ ...MONO, fontSize: 11, color: 'var(--accent)', opacity: 0.8, flexShrink: 0, paddingTop: 1 }}>→</span>
                  <div>
                    <div style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* B. Exact Posts */}
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.28)' }}>B. EXACT POSTS</span>
              </div>

              {/* Reddit post */}
              {redditPost && (
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,136,0,0.7)', marginBottom: 10 }}>REDDIT POST</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px' }}>Title:</div>
                    <div style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{redditPost.title}</div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />
                    <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px' }}>Body:</div>
                    <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{redditPost.body}</div>
                  </div>
                </div>
              )}

              {/* X Thread */}
              <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>X THREAD</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {xThread.map((tweet, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', display: 'flex', gap: 10 }}>
                      <span style={{ ...MONO, fontSize: 10, color: 'var(--accent)', opacity: 0.5, flexShrink: 0, paddingTop: 1 }}>{i + 1}</span>
                      <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{tweet}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEO Page */}
              <div style={{ padding: '16px' }}>
                <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(126,240,165,0.6)', marginBottom: 10 }}>SEO PAGE</div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                  <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Title:</div>
                  <div style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>{seoPage.title}</div>
                  <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Sections:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {seoPage.sections.map(s => (
                      <div key={s} style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--accent)', opacity: 0.6 }}>—</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* C. Checklist */}
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.28)' }}>C. CHECKLIST</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {checklistItems.map((item, i) => (
                  <motion.button
                    key={item}
                    onClick={() => toggleCheck(i)}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    <div style={{
                      width: 16, height: 16, border: `1px solid ${checklist[i] ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
                      background: checklist[i] ? 'rgba(0,255,136,0.12)' : 'transparent',
                      flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {checklist[i] && <span style={{ ...MONO, fontSize: 9, color: 'var(--accent)', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ ...MONO, fontSize: 12, color: checklist[i] ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)', lineHeight: 1.5, textDecoration: checklist[i] ? 'line-through' : 'none', transition: 'color 0.15s' }}>
                      {item}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* D. Final CTAs — gate to waitlist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={onWaitlistOpen}
                className="sys-btn"
                style={{ ...MONO, fontSize: 11, letterSpacing: '2px', borderColor: 'var(--accent)', color: 'var(--accent)', padding: '13px 20px', background: 'rgba(0,255,136,0.05)', textAlign: 'center', whiteSpace: 'nowrap' }}
              >
                [ GENERATE MORE POSTS → ]
              </button>
              <button
                onClick={onWaitlistOpen}
                style={{ ...MONO, fontSize: 11, letterSpacing: '2px', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', padding: '13px 20px', background: 'transparent', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
              >
                [ SAVE THIS PLAN ]
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function SignalRowColor(state: import('@/components/diagnostic/scannerTypes').SignalRow['state']): string {
  if (state === 'positive') return 'var(--accent)';
  if (state === 'warn')     return 'var(--warning)';
  if (state === 'danger')   return 'var(--danger)';
  return 'rgba(255,255,255,0.35)';
}

function ScanWaitlistPanel({
  onWaitlistOpen, revealed, hasUrl, preview, result, auditResultsRef, isUnlocked,
}: {
  onWaitlistOpen: () => void;
  revealed: boolean;
  hasUrl: boolean;
  preview: boolean;
  result: AuditResult | null;
  auditResultsRef: React.RefObject<AuditResultsHandle>;
  isUnlocked?: boolean;
}) {
  const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };
  const stage = revealed ? 'scanned' : 'idle';

  const layers = result?.signalLayers ?? null;
  const classification = layers?.entityClass?.classification ?? 'EARLY_PRODUCT';
  const classLabel = layers?.entityClass?.label ?? 'EARLY PRODUCT';
  const scannedUrl = result?.url ?? 'your site';

  // Determine header status indicator colour + text by path
  const isEstablished = classification === 'ESTABLISHED_ENTITY';
  const isUnverified  = classification === 'UNVERIFIED';

  const headerStatusColor = isEstablished ? 'var(--accent)'
    : isUnverified  ? 'rgba(255,255,255,0.3)'
    : 'var(--danger)';
  const headerStatus = isEstablished ? '● PAGE SCAN COMPLETE'
    : isUnverified  ? '○ SCAN LIMITED'
    : '● ISSUES FOUND';

  // Root cause banner colour by path
  const rootBorderColor = isEstablished ? 'rgba(0,255,136,0.2)'
    : isUnverified  ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,68,68,0.25)';
  const rootBgColor = isEstablished ? 'rgba(0,255,136,0.03)'
    : isUnverified  ? 'rgba(255,255,255,0.02)'
    : 'rgba(255,68,68,0.04)';
  const rootLabelColor = isEstablished ? 'rgba(0,255,136,0.55)'
    : isUnverified  ? 'rgba(255,255,255,0.3)'
    : 'rgba(255,68,68,0.6)';
  const rootTextColor = isEstablished ? 'var(--accent)'
    : isUnverified  ? 'rgba(255,255,255,0.6)'
    : 'var(--danger)';
  const rootLabel = isEstablished ? 'ESTABLISHED ENTITY DETECTED'
    : isUnverified  ? 'SCAN LIMITED'
    : 'WHY NOBODY CAME';

  // Issues section colours
  const issuesBorderColor = isEstablished ? 'rgba(0,255,136,0.15)'
    : isUnverified  ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,68,68,0.2)';
  const issuesBgColor = isEstablished ? 'rgba(0,255,136,0.02)'
    : isUnverified  ? 'rgba(255,255,255,0.01)'
    : 'rgba(255,68,68,0.03)';
  const issuesLabelColor = isEstablished ? 'rgba(0,255,136,0.5)'
    : isUnverified  ? 'rgba(255,255,255,0.28)'
    : 'rgba(255,68,68,0.6)';
  const issuesBulletColor = isEstablished ? 'var(--accent)'
    : isUnverified  ? 'rgba(255,255,255,0.3)'
    : 'var(--danger)';

  // CTA
  const ctaLabel = layers?.ctaLabel ?? 'SEE WHAT TO FIX FIRST →';

  // Locked section blurred items
  const blurredItems = isEstablished
    ? ['Specific CTA copy improvements', 'Page hierarchy analysis', 'Conversion friction points', 'Message clarity score']
    : isUnverified
    ? ['Crawlability assessment details', 'Indexation signals', 'Structured data check', 'Content depth analysis']
    : ['Where you are invisible', 'What competitors are doing better', 'Exact content you need to publish', 'Step-by-step distribution plan'];

  // Lock message
  const lockMessage = isEstablished
    ? <>See the full page-level analysis<br />and conversion opportunities.</>
    : isUnverified
    ? <>See what we could assess<br />and how to fix crawlability.</>
    : <>See exactly why nobody came<br />and what to fix first.</>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0 28px', height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.22)' }}>
          {stage === 'scanned' ? 'SYSTEM OUTPUT' : 'SCAN RESULTS'}
        </span>
        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2.2, repeat: Infinity }}
          style={{ ...MONO, fontSize: 10, color: stage === 'scanned' ? headerStatusColor : 'var(--text-dim)' }}>
          {stage === 'scanned' ? headerStatus : '○ AWAITING INPUT'}
        </motion.span>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        {stage === 'scanned' ? (
          <motion.div
            key="scanned"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {/* ── VISIBLE SECTION ── */}
            <div style={{ padding: '24px 28px', flexShrink: 0 }}>

              {/* Classification badge */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.22)' }}>CLASSIFICATION:</span>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: rootTextColor, fontWeight: 700 }}>{classLabel}</span>
              </motion.div>

              {/* Root cause / main result */}
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                style={{ marginBottom: 20, border: `1px solid ${rootBorderColor}`, background: rootBgColor, padding: '14px 16px' }}
              >
                <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: rootLabelColor, marginBottom: 6 }}>
                  {rootLabel} — <span style={{ color: 'rgba(255,255,255,0.28)' }}>{scannedUrl}</span>
                </div>
                <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: rootTextColor, lineHeight: 1.45, marginBottom: layers?.subtext ? 8 : 0 }}>
                  {layers?.rootCause ?? 'Analysis complete.'}
                </div>
                {layers?.subtext && (
                  <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    {layers.subtext}
                  </div>
                )}
              </motion.div>

              {/* Signal Check — uses signalRows from engine */}
              {layers?.signalRows && layers.signalRows.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}
                  style={{ marginBottom: 20, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.3)' }}>[ SIGNAL CHECK ]</span>
                  </div>
                  {layers.signalRows.map((row, i) => (
                    <motion.div
                      key={row.label}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < layers.signalRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    >
                      <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                      <span style={{ ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: SignalRowColor(row.state) }}>{row.value}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Primary Issues */}
              {layers?.primaryIssues && layers.primaryIssues.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}
                  style={{ border: `1px solid ${issuesBorderColor}`, background: issuesBgColor }}
                >
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${issuesBorderColor}` }}>
                    <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: issuesLabelColor }}>
                      [ {layers.issuesSectionLabel ?? 'PRIMARY ISSUES'} ]
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {layers.primaryIssues.map((text, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.12 }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                      >
                        <span style={{ color: issuesBulletColor, opacity: 0.7, fontSize: 10, marginTop: 2, flexShrink: 0 }}>●</span>
                        <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>{text}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {isUnlocked ? (
              /* ── UNLOCKED: full execution layer ── */
              <ExecutionLayer result={result} onWaitlistOpen={onWaitlistOpen} MONO={MONO} />
            ) : (
              /* ── LOCKED: blurred preview + gate ── */
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {/* Gradient fade */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, zIndex: 2, background: 'linear-gradient(to bottom, var(--bg-panel), transparent)', pointerEvents: 'none' }} />
                {/* Blurred content */}
                <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', padding: '0 28px 8px', opacity: 0.6 }}>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.28)', marginBottom: 10, paddingTop: 16 }}>[ FULL BREAKDOWN ]</div>
                  {blurredItems.map(item => (
                    <div key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{item}</span>
                      <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>——</span>
                    </div>
                  ))}
                </div>
                {/* Lock overlay */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
                  style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '28px 32px', backdropFilter: 'blur(2px)', background: 'rgba(5,6,6,0.55)' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(15px, 1.8vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, color: 'var(--text-primary)', marginBottom: 8 }}>
                      {lockMessage}
                    </div>
                    <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                      [ FULL BREAKDOWN LOCKED ]
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                    <button
                      onClick={onWaitlistOpen}
                      className="sys-btn w-full text-center"
                      style={{ fontSize: 11, letterSpacing: '2px', borderColor: 'var(--accent)', color: 'var(--accent)', padding: '12px 24px', background: 'rgba(0,255,136,0.04)', whiteSpace: 'nowrap' }}
                    >
                      [ {ctaLabel} ]
                    </button>
                    <div style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Takes 10 seconds. No spam.</div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ── Idle: ScanMap + AuditResults preview ── */
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '32px 40px', gap: 32 }}
          >
            <ScanMap revealed={false} preview={true} result={null} isUnlocked={false} />
            <AuditResults ref={auditResultsRef} revealed={false} preview={true} result={null} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StageLiveScan({
  revealed, preview, auditResult, isUnlocked, hasUrl,
  onReveal, onAuditStart, onWaitlistOpen, onFixFirst, onOpenUnlock, auditResultsRef, onUrlChange,
}: {
  revealed: boolean; preview: boolean; auditResult: AuditResult | null; isUnlocked: boolean; hasUrl: boolean;
  onReveal: (r: AuditResult) => void; onAuditStart: () => void; onWaitlistOpen: () => void;
  onFixFirst: (id: string) => void; onOpenUnlock: () => void; auditResultsRef: React.RefObject<AuditResultsHandle>;
  onUrlChange: (url: string) => void;
}) {
  return (
    <section id="scan" className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-6 lg:px-12 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <SysLabel dim>RUNNING YOUR SCAN</SysLabel>
        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
          className="font-mono text-[11px] tracking-[2px]"
          style={{ color: revealed ? (isUnlocked ? 'var(--accent)' : 'var(--warning)') : 'var(--text-dim)' }}>
          {revealed ? (isUnlocked ? '● COMPLETE' : '◉ LOCKED') : '○ AWAITING INPUT'}
        </motion.span>
      </div>
      <div className="flex flex-col lg:flex-row min-h-screen">
        <div className="w-full lg:w-[40%] border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}>
          <LeftPanel onReveal={onReveal} onWaitlistOpen={onWaitlistOpen} onAuditStart={onAuditStart} onUrlChange={onUrlChange} />
        </div>
        <div className="w-full lg:w-[60%] overflow-auto" style={{ background: 'var(--bg-panel)' }}>
          <ScanWaitlistPanel onWaitlistOpen={onWaitlistOpen} revealed={revealed} hasUrl={hasUrl} preview={preview} result={auditResult} auditResultsRef={auditResultsRef} isUnlocked={isUnlocked} />
        </div>
      </div>
    </section>
  );
}

// ─── DIAGNOSIS ────────────────────────────────────────────────────────────
const DIAG_METRICS = [
  {
    label: 'AI does not understand what you are',
    value: 'NOT DEFINED',
    color: 'var(--danger)',
    detail: 'You have not clearly defined what your product is in a way AI can read. There is no plain statement of what it is, who it is for, or what it does.',
    fix: 'Write one sentence: "[Product] helps [audience] [outcome]." Put it on your homepage. Repeat it on every major page and every post you publish.',
  },
  {
    label: 'You are not being mentioned anywhere',
    value: 'NOT CITED',
    color: 'var(--danger)',
    detail: 'AI cannot reference you because nothing outside your own site mentions you. No posts, no threads, no external pages.',
    fix: 'Publish 2 posts answering real questions about your problem space. Post on Reddit or LinkedIn. Get at least one mention outside your own site.',
  },
  {
    label: 'Nothing tells AI to recommend you',
    value: 'WEAK',
    color: 'var(--warning)',
    detail: 'AI recommends things that other sources also back up. Right now, almost nothing online supports your product.',
    fix: 'Get listed in 2 to 3 places outside your site. A directory, a community thread, or a guest post all count.',
  },
  {
    label: 'You are not showing up in answers',
    value: 'MISSING',
    color: 'var(--danger)',
    detail: 'AI has to guess what your product does and who it is for. Without a clear description, it skips you entirely.',
    fix: 'Add a plain description to your homepage. State your product type, your audience, and the problem you solve. No jargon.',
  },
  {
    label: 'You have no discovery loops',
    value: 'MINIMAL',
    color: 'var(--warning)',
    detail: 'You are not present in the places where people discover new products. AI finds products where people ask questions and get answers.',
    fix: 'Pick one channel: Reddit, LinkedIn, or a niche community. Answer 3 real questions this week. Mention your product naturally.',
  },
];

function DiagRow({ metric, index }: { metric: (typeof DIAG_METRICS)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
      transition={{ delay: index * 0.08 }} className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-4 text-left" style={{ cursor: 'pointer' }}>
        <div className="flex items-center gap-3">
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}
            className="font-mono text-[11px]" style={{ color: metric.color, opacity: 0.7 }}>{'>'}</motion.span>
          <span className="font-mono text-[12px] leading-snug" style={{ color: open ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {metric.label}
          </span>
        </div>
        <span className="font-mono text-[13px] font-bold tracking-[1px]" style={{ color: metric.color }}>{metric.value}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="d" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: 'hidden' }}>
            <div className="border-l-2 ml-5 pl-5 pb-5 space-y-3" style={{ borderColor: metric.color }}>
              <p className="font-mono text-[12px] leading-loose" style={{ color: 'var(--text-primary)', opacity: 0.72 }}>{metric.detail}</p>
              <div className="space-y-1">
                <div className="font-mono text-[11px] tracking-[2px] uppercase mb-1" style={{ color: 'var(--accent)', opacity: 0.7 }}>ACTION</div>
                <p className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>{metric.fix}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StageDiagnosis() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1700);
    const t3 = setTimeout(() => setPhase(3), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [inView]);

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh] sys-grid" style={{ background: 'var(--bg-deep)' }}>
        <div className="flex flex-col justify-center px-6 lg:px-14 py-16 border-r" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>YOU ARE INVISIBLE</SysLabel>

          {phase >= 1 && (
            <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 'clamp(46px, 6vw, 86px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.88, color: 'var(--danger)' }}>
              You are<br />invisible.
            </motion.h2>
          )}

          {phase >= 2 && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="font-mono text-[16px] mt-6 leading-snug" style={{ color: 'var(--text-secondary)' }}>
              And that's why nobody came.
            </motion.p>
          )}

          {phase >= 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
              className="font-mono text-[13px] mt-5 space-y-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
              <p>This is not a traffic problem.</p>
              <p style={{ color: 'var(--text-secondary)' }}>It's a discovery problem.</p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.5 }} className="mt-10 pt-5 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
            <p className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
              If you are not understood,
            </p>
            <p className="font-mono text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              you are not recommended.
            </p>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.6 }} className="font-mono text-[11px] mt-6" style={{ color: 'var(--text-muted)' }}>
            Click any row to see what is broken and what to do.
          </motion.p>
        </div>

        <div className="flex flex-col justify-center px-8 lg:px-14 py-12">
          {DIAG_METRICS.map((m, i) => <DiagRow key={m.label} metric={m} index={i} />)}
        </div>
      </div>
    </Section>
  );
}

// ─── STRUCTURED FIXES ─────────────────────────────────────────────────────
const FIXES = [
  {
    type: 'STEP 1',
    headline: 'Define what your product actually is',
    example: 'Write a clear 1–2 sentence explanation. Make it obvious who it is for. Put it on your homepage and every post you publish.',
    priority: 'CRITICAL' as const,
  },
  {
    type: 'STEP 2',
    headline: 'Tell AI where you belong',
    example: 'Compare your product to known categories. Mention alternatives or similar tools. Use plain language, not branding.',
    priority: 'CRITICAL' as const,
  },
  {
    type: 'STEP 3',
    headline: 'Create content that gets picked up',
    example: 'Write posts answering real user questions. Focus on problems, not features. Publish where people already ask.',
    priority: 'HIGH' as const,
  },
  {
    type: 'STEP 4',
    headline: 'Show up where discovery happens',
    example: 'Post on X, Reddit, LinkedIn. Answer existing discussions. Be useful first, promote second.',
    priority: 'HIGH' as const,
  },
  {
    type: 'STEP 5',
    headline: 'Remove confusion instantly',
    example: 'Simplify your messaging. Remove vague words. Make your value obvious in 5 seconds.',
    priority: 'MEDIUM' as const,
  },
];

function FixRow({ fix, index }: { fix: (typeof FIXES)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const pc = fix.priority === 'CRITICAL' ? 'var(--danger)' : fix.priority === 'HIGH' ? 'var(--warning)' : 'var(--text-muted)';

  return (
    <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
      transition={{ delay: index * 0.09 }} className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start gap-4 py-4 text-left"
        style={{ cursor: 'pointer', background: 'transparent' }}>
        <span className="font-mono text-[12px] tracking-[1px] uppercase px-2 py-0.5 shrink-0 mt-0.5"
          style={{ border: `1px solid ${pc}`, color: pc }}>
          {fix.type}
        </span>
        <span className="font-mono text-[13px] leading-snug flex-1" style={{ color: 'var(--text-secondary)' }}>
          {fix.headline}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}
          className="font-mono text-[11px] shrink-0 mt-0.5" style={{ color: 'var(--text-dim)' }}>{'>'}</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="ex" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-1 border-l-2 mb-2" style={{ borderColor: pc, background: `${pc.replace('var(--danger)', '#ff4444').replace('var(--warning)', '#ffaa33').replace('var(--text-muted)', '#3d4d3d')}09` }}>
              <div className="font-mono text-[10px] tracking-[2px] uppercase mb-1.5" style={{ color: pc, opacity: 0.7 }}>ACTION</div>
              <p className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{fix.example}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StageStructuredFixes({ onGetAccess }: { onGetAccess: () => void }) {
  return (
    <Section id="structured-fixes" className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh]" style={{ background: 'var(--bg)' }}>
        {/* Left: visual */}
        <div className="relative flex items-center justify-center border-r overflow-hidden sys-grid"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)', minHeight: 340 }}>
          <motion.div initial={{ opacity: 0, filter: 'blur(24px)' }} whileInView={{ opacity: 0.1, filter: 'blur(10px)' }}
            viewport={{ once: true }} transition={{ duration: 2.5 }}
            style={{ position: 'absolute', fontSize: 'clamp(90px, 13vw, 170px)', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--accent)', lineHeight: 0.84, textAlign: 'center' }}>
            GET<br />USERS
          </motion.div>
          <div className="relative z-10 px-10 space-y-1.5">
            {FIXES.map((f, i) => (
              <motion.div key={f.type} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }} transition={{ delay: i * 0.14, duration: 0.55 }}
                className="font-mono text-[12px] py-0.5" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)', opacity: 0.4 }}>→ </span>{f.headline}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: list */}
        <div className="flex flex-col justify-center px-8 lg:px-14 py-14 space-y-8">
          <div>
            <SysLabel>WHAT TO DO NEXT</SysLabel>
            <h2 style={{ fontSize: 'clamp(34px, 4vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.92, color: 'var(--text-primary)' }}>
              This is how you<br />start getting users.
            </h2>
          </div>
          <div>{FIXES.map((f, i) => <FixRow key={f.type} fix={f} index={i} />)}</div>
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}
          >
            <p className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>
              Do these, and you start getting discovered.
            </p>
            <button
              onClick={onGetAccess}
              className="sys-btn"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '2px' }}
            >
              [ SEE WHAT TO DO NEXT → ]
            </button>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

// ─── DISTRIBUTION EXECUTION PLAN ─────────────────────────────────────────

const EXEC_CHANNELS = [
  {
    name: 'Reddit',
    why: 'High-intent users already asking your exact problem',
    actions: [
      'Find 3 threads related to your problem space',
      'Answer with actual value, not promotion',
      'Mention your product naturally at the end',
    ],
  },
  {
    name: 'X (Twitter)',
    why: 'Fastest way to get initial visibility without an audience',
    actions: [
      'Post 2 threads explaining your product clearly',
      'First line = the exact problem your user has',
      'Reply to 10 posts in your niche this week',
    ],
  },
  {
    name: 'LinkedIn',
    why: 'Credibility layer that makes AI and people trust you',
    actions: [
      'Post 1 breakdown of your product',
      'Explain what problem it solves in plain language',
      'Add a real use case or outcome',
    ],
  },
  {
    name: 'SEO Pages',
    why: 'Long-term visibility that compounds over time',
    actions: [
      'Create 1 page targeting a problem-based query',
      'Example: "why nobody uses [your category]"',
      'Write it for the person with the problem, not for search',
    ],
  },
];

const EXEC_POSTS = [
  {
    type: 'Reddit Answer',
    goal: 'Get first users from high-intent traffic',
    copy: `I ran into this exact problem recently.

Most people think it is a traffic issue. It is not.

It is a visibility issue.

If AI cannot understand what your product is, it will not recommend it. Not because your product is bad. Because it cannot classify it.

I built something to diagnose this and show exactly where you are invisible.

Happy to share if useful.`,
  },
  {
    type: 'X Thread',
    goal: 'Attract attention and explain the product',
    copy: `You launched.
Nobody came.

It is not a traffic problem.

AI literally does not understand your product.

No understanding = no recommendation.

Here is what is actually broken:`,
  },
  {
    type: 'LinkedIn Post',
    goal: 'Build credibility and reach decision makers',
    copy: `Most founders think they have a distribution problem.

They do not.

They have an understanding problem.

If AI cannot classify your product, it cannot recommend it.

That is where most launches fail silently.`,
  },
];

const EXEC_RULES = [
  'Do NOT sell directly. Explain the problem first.',
  'Always lead with the pain your user already feels.',
  'Keep language simple. AI needs clarity, not cleverness.',
  'Repeat your message across every platform you use.',
  'Ship fast. Imperfect posts still get read.',
];

const TODAY_CHECKLIST = [
  'Post 1 Reddit answer in a relevant thread',
  'Post 1 X thread explaining your product',
  'Reply to 10 posts in your niche',
  'Publish 1 LinkedIn or community post',
];

// Section label used inside the plan panel
function PlanLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-5" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.35)' }}>
      <span style={{ color: 'var(--accent)' }}>[ </span>
      {children}
      <span style={{ color: 'var(--accent)' }}> ]</span>
    </div>
  );
}

// Checklist item with checkbox
function CheckItem({ text, index }: { text: string; index: number }) {
  const [checked, setChecked] = useState(false);
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={() => setChecked(v => !v)}
      className="w-full flex items-start gap-3 py-2 text-left"
      style={{ background: 'transparent', cursor: 'pointer' }}
    >
      <span
        className="font-mono text-[13px] mt-0.5 shrink-0"
        style={{ color: checked ? 'var(--accent)' : 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }}
      >
        {checked ? '[x]' : '[ ]'}
      </span>
      <span
        className="font-mono text-[13px] leading-snug"
        style={{ color: checked ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)', textDecoration: checked ? 'line-through' : 'none', transition: 'all 0.2s' }}
      >
        {text}
      </span>
    </motion.button>
  );
}

// Post card with copy-to-clipboard
function PostCard({ post, index, onCopy }: { post: typeof EXEC_POSTS[0]; index: number; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(post.copy).then(() => {
      setCopied(true);
      onCopy(post.copy);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className="border"
      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] tracking-[2px] uppercase px-2 py-0.5 border" style={{ borderColor: 'var(--accent)44', color: 'var(--accent)', fontSize: 9 }}>
            {post.type}
          </span>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Goal: {post.goal}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="font-mono text-[10px] tracking-[1px] uppercase px-3 py-1 border transition-colors"
          style={{
            borderColor: copied ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
            color: copied ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        className="font-mono text-[12px] leading-relaxed px-5 py-4"
        style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, background: 'transparent' }}
      >
        {post.copy}
      </pre>
    </motion.div>
  );
}

// Full-screen execution plan panel
// Additional posts generated on "Generate More Posts" click
const BONUS_POSTS = [
  {
    type: 'Hacker News Comment',
    goal: 'Reach technical early adopters',
    copy: `Late to this thread but this is exactly the problem I ran into.

The issue is not that your product is bad. It is that AI systems cannot classify it.

If you have not explicitly defined your product category in plain language on your site, AI cannot surface you when someone asks for a recommendation.

Took me a while to figure this out. Happy to share what worked.`,
  },
  {
    type: 'Product Hunt Launch Post',
    goal: 'Convert launch traffic into users',
    copy: `We built this after watching good products fail silently.

The problem was never the product. It was that AI could not understand what the product was.

No clear category. No plain-language description. No presence in the places AI looks for answers.

We made a tool that shows you exactly where you are invisible and what to do about it.`,
  },
  {
    type: 'Newsletter Blurb',
    goal: 'Warm audience re-engagement',
    copy: `Quick one this week.

If you launched something and it did not get the traction you expected, there is a good chance AI is not recommending you.

Not because your product is bad. Because AI does not understand it well enough to mention it.

I wrote up exactly what to fix. Worth 5 minutes if you have a product live right now.`,
  },
];

// Locked post preview shown in the paywall block
const LOCKED_POST_PREVIEW = `Your competitors are getting recommended because AI understands them better than it understands you.

They published in the right places. They defined their product clearly. They showed up where the questions are asked.

You still can. Here is exactly how...`;

function ExecutionPlanPanel({ onClose, onGetAccess }: { onClose: () => void; onGetAccess: () => void }) {
  const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };
  const [phase, setPhase] = useState<'typing' | 'revealed'>('typing');
  const [moreState, setMoreState] = useState<'idle' | 'loading' | 'done'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  const typingText = 'Generating distribution execution plan...';
  const displayed = useTypewriter(typingText, phase === 'typing', 32, () => {
    setTimeout(() => setPhase('revealed'), 400);
  });

  const totalPosts = EXEC_POSTS.length + (moreState === 'done' ? BONUS_POSTS.length : 0);
  const totalAvailable = 15;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGenerateMore = () => {
    setMoreState('loading');
    setTimeout(() => {
      setMoreState('done');
      // scroll to newly revealed posts after short delay
      setTimeout(() => {
        scrollRef.current?.scrollBy({ top: 400, behavior: 'smooth' });
      }, 200);
    }, 2200);
  };

  const sectionDelay = (n: number) => ({ delay: 0.1 + n * 0.15 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(4,5,5,0.97)',
        backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div style={{
        height: 54, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px, 4vw, 48px)',
      }}>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--accent)' }}>[ </span>
          <span style={{ ...MONO, fontSize: 10, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.55)' }}>
            DISTRIBUTION EXECUTION PLAN
          </span>
          <span style={{ color: 'var(--accent)' }}> ]</span>
        </div>
        <div className="flex items-center gap-4">
          {phase === 'revealed' && (
            <span style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
              <span style={{ color: 'var(--accent)' }}>{totalPosts}</span>/{totalAvailable} posts generated
            </span>
          )}
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ ...MONO, fontSize: 10, color: phase === 'revealed' ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            {phase === 'revealed' ? '● READY' : '● GENERATING'}
          </motion.span>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-[1px] uppercase"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 12px' }}
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'clamp(24px, 4vw, 48px) clamp(20px, 6vw, 80px)' }}>

        {/* Typewriter line */}
        <div style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 32 }}>
          {displayed}
          {phase === 'typing' && (
            <span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--accent)', opacity: 0.7, marginLeft: 2, verticalAlign: 'middle' }} />
          )}
        </div>

        {phase === 'revealed' && (
          <div className="space-y-16">

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ ...MONO, fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 560, lineHeight: 1.7 }}
            >
              Do these next. This is how you get your first users.
            </motion.p>

            {/* SECTION 1: Where to show up */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={sectionDelay(0)}>
              <PlanLabel>WHERE YOU NEED TO BE</PlanLabel>
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                {EXEC_CHANNELS.map((ch, i) => (
                  <motion.div
                    key={ch.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="grid grid-cols-1 lg:grid-cols-[180px_1fr] border-b py-6 gap-4 lg:gap-10"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        &gt; {ch.name}
                      </div>
                      <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                        {ch.why}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {ch.actions.map((a, j) => (
                        <div key={j} className="flex gap-2 font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--accent)', opacity: 0.6, flexShrink: 0 }}>-</span>
                          {a}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* SECTION 2: What to post */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={sectionDelay(1)}>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <PlanLabel>WHAT TO POST</PlanLabel>
                <span style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
                  {totalPosts} of {totalAvailable} posts
                </span>
              </div>
              <p style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20, lineHeight: 1.7 }}>
                Ready to paste. Pick one and send it today.
              </p>

              {/* Progress bar */}
              <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${(totalPosts / totalAvailable) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'var(--accent)', borderRadius: 2 }}
                />
              </div>

              {/* Initial 3 posts */}
              <div className="space-y-4">
                {EXEC_POSTS.map((post, i) => (
                  <PostCard key={post.type} post={post} index={i} onCopy={() => {}} />
                ))}
              </div>

              {/* Bonus posts revealed after clicking "Generate More" */}
              <AnimatePresence>
                {moreState === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-4 mt-4"
                  >
                    {BONUS_POSTS.map((post, i) => (
                      <PostCard key={post.type} post={post} index={i} onCopy={() => {}} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading state while generating */}
              <AnimatePresence>
                {moreState === 'loading' && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="mt-6 border px-5 py-4 flex items-center gap-4"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      style={{ ...MONO, fontSize: 11, color: 'var(--accent)' }}
                    >
                      ●
                    </motion.span>
                    <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      Generating posts tailored to your product...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generate More button (only shown before clicking) */}
              {moreState === 'idle' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="mt-6"
                >
                  <button
                    onClick={handleGenerateMore}
                    className="sys-btn"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '2px', padding: '12px 28px' }}
                  >
                    [ GENERATE MORE POSTS → ]
                  </button>
                </motion.div>
              )}

              {/* Value stacking + paywall after bonus posts appear */}
              <AnimatePresence>
                {moreState === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-8 space-y-0"
                  >
                    {/* "More content ready" banner */}
                    <div
                      className="border px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                      style={{ borderColor: 'rgba(0,255,136,0.2)', background: 'rgba(0,255,136,0.04)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ color: 'var(--accent)', fontSize: 13 }}>●</span>
                        <span style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                          MORE CONTENT READY
                        </span>
                      </div>
                      <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        12 more tailored posts ready based on your product
                      </span>
                    </div>

                    {/* Locked post preview */}
                    <div className="border border-t-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="px-5 py-3 border-b flex items-center justify-between"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span style={{ ...MONO, fontSize: 9, letterSpacing: '2px', color: '#e05555', border: '1px solid rgba(224,85,85,0.3)', padding: '2px 8px' }}>
                            LOCKED
                          </span>
                          <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                            Post type: Competitive angle
                          </span>
                        </div>
                      </div>
                      <div style={{ position: 'relative', overflow: 'hidden' }}>
                        <pre
                          style={{
                            ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8,
                            padding: '20px 24px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            background: 'transparent',
                          }}
                        >
                          {LOCKED_POST_PREVIEW}
                        </pre>
                        {/* Blur gradient over bottom half */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
                          background: 'linear-gradient(to bottom, transparent, rgba(4,5,5,0.97))',
                          pointerEvents: 'none',
                        }} />
                      </div>
                    </div>

                    {/* Paywall unlock block */}
                    <div
                      className="border border-t-0 px-6 py-8 space-y-6"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}
                    >
                      <div className="space-y-2">
                        <div style={{ ...MONO, fontSize: 10, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.3)' }}>
                          [ UNLOCK FULL DISTRIBUTION PACK ]
                        </div>
                        <p style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 480 }}>
                          Everything you need to go from invisible to getting your first real users.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          '15+ tailored posts ready to paste',
                          'Multi-platform variations per post',
                          'Weekly execution plan',
                          'Content angles that get cited by AI',
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2 font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>+</span>
                            {item}
                          </div>
                        ))}
                      </div>

                      {/* Urgency line */}
                      <p style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.28)', borderLeft: '2px solid rgba(0,255,136,0.3)', paddingLeft: 12 }}>
                        Early users are getting full access free.
                      </p>

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={onGetAccess}
                          className="sys-btn"
                          style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '2px', padding: '12px 28px' }}
                        >
                          [ UNLOCK FULL PLAN → ]
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* SECTION 3: How to execute */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={sectionDelay(2)}>
              <PlanLabel>HOW TO EXECUTE WITHOUT FAILING</PlanLabel>
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                {EXEC_RULES.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span style={{ ...MONO, fontSize: 11, color: 'var(--accent)', opacity: 0.5, flexShrink: 0, marginTop: 1 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ ...MONO, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {rule}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* SECTION 4: Do this today */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={sectionDelay(3)}>
              <PlanLabel>DO THIS TODAY</PlanLabel>
              <div className="border" style={{ borderColor: 'var(--border)', background: 'rgba(0,255,136,0.025)', maxWidth: 560 }}>
                <div className="border-b px-5 py-3" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ ...MONO, fontSize: 10, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.2)' }}>
                    CHECKLIST
                  </span>
                </div>
                <div className="px-5 py-3">
                  {TODAY_CHECKLIST.map((item, i) => (
                    <CheckItem key={i} text={item} index={i} />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Bottom save CTA */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="pb-8"
            >
              <button
                onClick={() => { window.print(); }}
                className="sys-btn"
                style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '2px', padding: '12px 28px' }}
              >
                [ SAVE THIS PLAN ]
              </button>
            </motion.div>

          </div>
        )}
      </div>
    </motion.div>
  );
}

// Inline panel shown inside the distribution section before the full plan opens
function DistributionOutputPanel({ onGetAccess }: { onGetAccess: () => void }) {
  const MONO: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };
  const [planOpen, setPlanOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [generated, setGenerated] = useState(false);
  const displayed = useTypewriter('Generating distribution steps...', typing, 40, () => {
    setTimeout(() => setGenerated(true), 300);
  });

  const handleGenerate = () => {
    setTyping(true);
  };

  const handleOpenPlan = () => {
    setPlanOpen(true);
  };

  return (
    <>
      <AnimatePresence>
        {planOpen && (
          <ExecutionPlanPanel onClose={() => setPlanOpen(false)} onGetAccess={onGetAccess} />
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-deep)' }}>
        <div style={{ padding: '0 24px', height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ ...MONO, fontSize: 9, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.22)' }}>
            DISTRIBUTION OUTPUT
          </span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{ ...MONO, fontSize: 10, color: generated ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            {generated ? '● READY' : '○ WAITING'}
          </motion.span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {!typing && !generated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <p style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
                Run your check to see exactly where you are invisible and what to publish first.
              </p>
              <button
                onClick={handleGenerate}
                className="sys-btn"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '2px' }}
              >
                [ GENERATE STEPS → ]
              </button>
            </motion.div>
          )}

          {(typing || generated) && (
            <div>
              <div style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                {displayed}
                {typing && !generated && (
                  <span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--accent)', opacity: 0.7, marginLeft: 2, verticalAlign: 'middle' }} />
                )}
              </div>

              {generated && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-3">
                  <p style={{ ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
                    Your distribution execution plan is ready.
                  </p>
                  <div className="space-y-2">
                    {['4 channels with exact steps', '3 ready-to-paste posts', 'Rules to avoid failing', 'A checklist for today'].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex gap-2 font-mono text-[12px]"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        <span style={{ color: 'var(--accent)', opacity: 0.6 }}>+</span>
                        {item}
                      </motion.div>
                    ))}
                  </div>
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                    onClick={handleOpenPlan}
                    className="sys-btn mt-4"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11, letterSpacing: '2px' }}
                  >
                    [ VIEW EXECUTION PLAN → ]
                  </motion.button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StageDistribution({ onGetAccess }: { onGetAccess: () => void }) {
  return (
    <Section id="distribution" className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg-deep)' }}>
        <div className="px-6 lg:px-14 py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>HOW YOU ACTUALLY GET USERS</SysLabel>
          <h2 style={{ fontSize: 'clamp(38px, 5vw, 76px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--text-primary)' }}>
            Get your<br />first users.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh]">
          {/* Left */}
          <div className="flex flex-col justify-center px-6 lg:px-14 py-14 border-r space-y-8" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-4">
              <p className="font-sans font-semibold" style={{ fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                We show you exactly what to publish, where to publish it, and how to get found by AI.
              </p>
              <p className="font-mono text-[13px] leading-relaxed border-l-2 pl-4" style={{ color: 'var(--text-muted)', borderColor: 'var(--danger)' }}>
                If you are not publishing in the right places, in the right format, you do not exist to AI.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { n: '01', t: 'Where you are invisible right now' },
                { n: '02', t: 'What to publish in each channel' },
                { n: '03', t: 'How to get picked up and cited' },
              ].map(item => (
                <div key={item.n} className="flex items-start gap-4 font-mono text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent)', opacity: 0.5, flexShrink: 0 }}>{item.n}</span>
                  {item.t}
                </div>
              ))}
            </div>
          </div>

          {/* Right: output panel */}
          <DistributionOutputPanel onGetAccess={onGetAccess} />
        </div>
      </div>
    </Section>
  );
}

// ─── COMPARISON ───────────────────────────────────────────────────────────
function StageComparison({ onGetAccess }: { onGetAccess: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const leftItems = [
    'Show keyword data',
    'Track rankings',
    'Analyze backlinks',
    'Require strategy + interpretation',
    'Built for marketers',
  ];
  const rightItems = [
    'Scans your product, not keywords',
    'Finds why nobody came',
    'Identifies where you are invisible',
    'Tells you exactly what to publish',
    'Built for founders with 0 users',
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg-deep)' }}>
        {/* Header */}
        <div className="px-6 lg:px-14 py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>WHY THIS IS DIFFERENT</SysLabel>
          <h2 style={{ fontSize: 'clamp(34px, 5vw, 72px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.92, color: 'var(--text-primary)' }}>
            This is not SEMrush.<br />
            <span style={{ color: 'var(--text-muted)' }}>This is not Ahrefs.</span>
          </h2>
          <p className="mt-5 font-mono" style={{ fontSize: 'clamp(13px, 1.4vw, 16px)', color: 'var(--text-secondary)', maxWidth: 480, lineHeight: 1.6 }}>
            Those tools give you data.<br />
            <span style={{ color: 'var(--text-primary)' }}>This tells you what to do next.</span>
          </p>
        </div>

        {/* Comparison grid */}
        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2">
          {/* LEFT — Traditional tools */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            whileHover={{ opacity: 0.55 }}
            transition={{ duration: 0.6 }}
            className="px-6 lg:px-12 py-10 border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: 'var(--border)', filter: 'saturate(0.7)' }}
          >
            <div className="font-mono text-[11px] tracking-[2px] uppercase mb-6" style={{ color: 'var(--text-muted)' }}>
              Traditional SEO Tools
            </div>
            <div className="space-y-3">
              {leftItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -6 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="flex items-start gap-3 font-mono text-[13px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'rgba(200,200,200,0.4)', flexShrink: 0 }}>•</span>
                  {item}
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.55 }}
              className="mt-8 pt-6 border-t font-mono text-[12px]"
              style={{ borderColor: 'rgba(255,68,68,0.25)', color: 'rgba(255,100,100,0.85)' }}
            >
              → You still have to figure out what to do
            </motion.div>
          </motion.div>

          {/* RIGHT — AudFlo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="px-6 lg:px-12 py-10 relative"
            style={{ background: 'rgba(0,255,136,0.03)' }}
          >
            {/* subtle glow border */}
            <div className="absolute inset-0 pointer-events-none" style={{
              boxShadow: 'inset 0 0 40px rgba(0,255,136,0.04)',
              border: '1px solid rgba(0,255,136,0.1)',
            }} />
            <div className="font-mono text-[11px] tracking-[2px] uppercase mb-6" style={{ color: 'var(--accent)' }}>
              AudFlo
            </div>
            <div className="space-y-3">
              {rightItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 6 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.25 + i * 0.07 }}
                  className="flex items-start gap-3 font-mono text-[13px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>
                  {item}
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.7 }}
              className="mt-8 pt-6 border-t font-mono text-[12px] font-bold"
              style={{ borderColor: 'rgba(0,255,136,0.2)', color: 'var(--accent)' }}
            >
              → You get actions you can execute today
            </motion.div>
          </motion.div>
        </div>

        {/* Killer line + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="px-6 lg:px-14 py-12 border-t flex flex-col items-center text-center gap-6"
          style={{ borderColor: 'var(--border)' }}
        >
          <p style={{ fontSize: 'clamp(16px, 1.8vw, 22px)', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.02em', lineHeight: 1.4, maxWidth: 520 }}>
            Most tools help you understand the problem.<br />
            <span style={{ color: 'var(--text-primary)' }}>This helps you fix it.</span>
          </p>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={onGetAccess}
              className="w-full font-mono text-[13px] tracking-[2px] uppercase py-3 px-6 transition-all duration-200"
              style={{
                background: 'var(--accent)',
                color: '#000',
                fontWeight: 700,
                letterSpacing: '1.5px',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              Get my first users →
            </button>
            <p className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
              No dashboards. No fluff. Just actions.
            </p>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── BEFORE / AFTER ───────────────────────────────────────────────────────
function StageBeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const before = [
    { l: 'Schema',                       v: 'None' },
    { l: 'AI understands your product',  v: 'No' },
    { l: 'Appearing in AI answers',      v: 'No' },
    { l: 'Users from AI discovery',      v: 'Zero' },
    { l: 'Structured context',           v: 'Missing' },
  ];
  const after = [
    { l: 'Schema',                       v: 'Organization + Product' },
    { l: 'AI understands your product',  v: 'Yes' },
    { l: 'Appearing in AI answers',      v: 'Yes' },
    { l: 'Users from AI discovery',      v: 'Growing' },
    { l: 'Structured context',           v: 'Present' },
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg)' }}>
        <div className="px-6 lg:px-14 py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>BEFORE / AFTER</SysLabel>
          <h2 style={{ fontSize: 'clamp(34px, 4.5vw, 62px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--text-primary)' }}>
            What changes.
          </h2>
        </div>

        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-[1fr_2px_1fr]">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.9 }}
            className="px-6 lg:px-12 py-10" style={{ background: 'rgba(255,68,68,0.025)' }}
          >
            <div className="font-mono text-[12px] tracking-[2px] uppercase mb-6" style={{ color: 'var(--danger)' }}>BEFORE — NO USERS</div>
            {before.map((r, i) => (
              <motion.div key={r.l} initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15 + i * 0.09 }} className="flex justify-between py-3 border-b"
                style={{ borderColor: 'rgba(255,68,68,0.08)' }}>
                <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                <span className="font-mono text-[12px]" style={{ color: 'var(--danger)' }}>{r.v}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Gradient divider */}
          <motion.div initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.9, delay: 0.4 }}
            style={{ background: 'linear-gradient(180deg, var(--danger) 0%, var(--warning) 50%, var(--accent) 100%)', transformOrigin: 'top', width: 2 }}
          />

          {/* After */}
          <motion.div
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.9, delay: 0.35 }}
            className="px-6 lg:px-12 py-10" style={{ background: 'rgba(0,255,136,0.015)' }}
          >
            <div className="font-mono text-[12px] tracking-[2px] uppercase mb-6" style={{ color: 'var(--accent)' }}>AFTER — GETTING DISCOVERED</div>
            {after.map((r, i) => (
              <motion.div key={r.l} initial={{ opacity: 0, x: 8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.55 + i * 0.09 }} className="flex justify-between py-3 border-b"
                style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
                <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{r.l}</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--accent)' }}>{r.v}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────
function StageFAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    {
      q: 'Why did nobody come after I launched?',
      a: 'Because AI did not understand what you built. When someone asked ChatGPT or Perplexity about tools in your space, your product was not in the answer. Not because your product was bad. Because AI had no structured way to define what it was. No entity. No category. No reason to cite you.',
    },
    {
      q: 'Why does SEO not work anymore?',
      a: 'SEO gets you into a list of links. AI answers do not come from that list. They come from a model that was trained on structured, authoritative, clearly-attributed content. Ranking number one on Google and being invisible to AI are two separate problems now.',
    },
    {
      q: 'Why does AI recommend my competitors instead of me?',
      a: 'Your competitors gave AI enough structured signal to define them: what they are, who they serve, why they matter. AI repeated that back when asked. You did not give AI that signal, so it defaulted to whoever did.',
    },
    {
      q: 'What does "being cited" actually mean?',
      a: 'When someone asks ChatGPT, Perplexity, or Google AI about your category, being cited means your product appears in the answer. This requires AI to have clear structured data about who you are, what you do, and why you are worth recommending.',
    },
    {
      q: 'How long until I start getting users after fixing this?',
      a: 'Structured data and entity fixes can be picked up by AI crawlers within days. Building citation signals takes 4 to 12 weeks for meaningful change. The fastest wins are schema, entity definition, and product categorization. These are readable by AI on next crawl.',
    },
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg-deep)' }}>
        <div className="px-6 lg:px-14 py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>QUESTIONS YOU ALREADY ASKED YOURSELF</SysLabel>
          <h2 style={{ fontSize: 'clamp(34px, 4.5vw, 62px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--text-primary)' }}>
            Things you are<br />wondering right now.
          </h2>
        </div>
        <div className="px-6 lg:px-14 py-10 max-w-3xl">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-start justify-between py-5 text-left gap-6">
                <span className="font-sans text-[15px] font-medium" style={{ color: open === i ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1.45 }}>
                  {faq.q}
                </span>
                <span className="font-mono text-[16px] shrink-0" style={{ color: 'var(--text-muted)' }}>{open === i ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: 'hidden' }}>
                    <p className="font-mono text-[13px] leading-relaxed pb-5" style={{ color: 'var(--text-muted)' }}>{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── PRE-PRICING CONVERSION LINE ─────────────────────────────────────────
function PrePricingBridge() {
  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div
        className="px-6 lg:px-14 py-14 lg:py-20 flex flex-col items-start gap-2"
        style={{ background: 'var(--bg-deep)' }}
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(22px, 3vw, 40px)',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          If you are a solo founder,
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(22px, 3vw, 40px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          this is the fastest way to understand
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(22px, 3vw, 40px)',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          why you are invisible.
        </motion.p>
      </div>
    </Section>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────
function StagePricing({ onGetAccess }: { onGetAccess: () => void }) {
  const tiers = [
    {
      id: 'FREE',
      name: 'Post-Launch Check',
      tagline: 'Find out why nobody came.',
      desc: 'Run a full check on any URL. See exactly why AI is not finding, citing, or recommending your product.',
      features: [
        { text: 'Diagnose why AI skips your product', highlight: false },
        { text: 'See where you are invisible', highlight: false },
        { text: 'Understand why discovery is not happening', highlight: false },
        { text: 'Get your first set of fixes', highlight: false },
      ],
      accent: 'rgba(255,255,255,0.45)',
      ctaText: 'Run Check',
      ctaAccent: 'rgba(255,255,255,0.45)',
      isPro: false,
    },
    {
      id: 'PRO',
      name: 'Visibility Tracking',
      tagline: 'See if anything is working yet.',
      desc: 'Track progress week over week. Know the moment your product starts getting picked up by AI.',
      features: [
        { text: 'Everything in Post-Launch Check', highlight: false },
        { text: 'Track when AI starts picking you up', highlight: true },
        { text: 'Know when you get cited', highlight: true },
        { text: 'See what content actually gets discovered', highlight: true },
        { text: 'Get notified when visibility changes', highlight: true },
      ],
      accent: 'var(--cyan)',
      ctaText: 'Join Waitlist',
      ctaAccent: 'var(--cyan)',
      isPro: true,
    },
    {
      id: 'ENGINE',
      name: 'Get Users',
      tagline: 'Turn your product into something AI actually distributes.',
      desc: 'Get exact content to publish. Know where to publish it. Go from zero to being found.',
      features: [
        { text: 'Everything in Visibility Tracking', highlight: false },
        { text: 'Get exact content to publish', highlight: true },
        { text: 'Know where to publish it', highlight: true },
        { text: 'Turn your product into something AI can recommend', highlight: true },
        { text: 'Go from zero to first real discovery', highlight: true },
      ],
      accent: 'var(--accent)',
      ctaText: 'Get Users',
      ctaAccent: 'var(--accent)',
      isPro: false,
    },
  ];

  return (
    <Section className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div style={{ background: 'var(--bg)' }}>
        <div className="px-6 lg:px-14 py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <SysLabel>HOW DEEP DO YOU WANT TO FIX THIS</SysLabel>
          <h2 style={{ fontSize: 'clamp(34px, 4.5vw, 62px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--text-primary)' }}>
            Diagnose. Track. Grow.
          </h2>
          <p className="font-mono text-[13px] leading-relaxed mt-5" style={{ color: 'rgba(255,255,255,0.3)', maxWidth: 480 }}>
            If you launched and nothing happened, this is how you fix it.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.11 }}
              className="border-r last:border-r-0 px-8 py-12 flex flex-col"
              style={{
                borderColor: 'var(--border)',
                background: t.isPro ? 'rgba(0,200,200,0.03)' : 'transparent',
                position: 'relative',
              }}
            >
              {t.isPro && (
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'var(--cyan)', opacity: 0.6 }} />
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 20 }}>
                <div className="font-mono text-[10px] tracking-[2.5px] uppercase mb-3" style={{ color: t.accent, opacity: 0.8 }}>
                  [ {t.id} ]
                </div>
                <div style={{ fontSize: 'clamp(20px, 2.2vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {t.name}
                </div>
                <div className="font-mono text-[12px]" style={{ color: t.isPro ? 'var(--cyan)' : 'rgba(255,255,255,0.35)', letterSpacing: '0.2px' }}>
                  {t.tagline}
                </div>
              </div>

              {/* Description */}
              <p className="font-mono text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
                {t.desc}
              </p>

              {/* Features */}
              <div className="flex flex-col gap-3 flex-1" style={{ marginBottom: 32 }}>
                {t.features.map(f => (
                  <div key={f.text} className="flex items-start gap-2.5 font-mono text-[12px]"
                    style={{ color: f.highlight ? 'var(--text-secondary)' : 'rgba(255,255,255,0.3)' }}>
                    <span style={{ color: f.highlight ? t.accent : 'rgba(255,255,255,0.2)', fontSize: 7, marginTop: 4, flexShrink: 0 }}>●</span>
                    {f.text}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={onGetAccess}
                className="sys-btn self-start"
                style={{ borderColor: t.ctaAccent, color: t.ctaAccent, fontSize: 11, letterSpacing: '2px' }}
              >
                [ {t.ctaText} → ]
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────
function Footer({ onGetAccess }: { onGetAccess: () => void }) {
  return (
    <footer style={{ background: 'var(--bg-deep)', borderTop: '1px solid var(--border)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="border-r px-8 py-12" style={{ borderColor: 'var(--border)' }}>
          <div className="font-mono text-[15px] tracking-[2px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>AudFlo</div>
          <p className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Real-time system for fixing why nobody came after you launched.
          </p>
        </div>
        <div className="border-r px-8 py-12" style={{ borderColor: 'var(--border)' }}>
          <div className="font-mono text-[11px] tracking-[2px] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>SYSTEM</div>
          <div className="space-y-2">
            {[
              { label: 'Run Scan',           href: '#scan' },
              { label: 'Gap Detection',      href: '#gap-detection' },
              { label: 'Structured Fixes',   href: '#structured-fixes' },
              { label: 'Distribution Engine',href: '#distribution' },
            ].map(({ label, href }) => (
              <a key={label} href={href}
                className="block font-mono text-[13px] transition-colors duration-150"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >{label}</a>
            ))}
          </div>
        </div>
        <div className="px-8 py-12 flex flex-col justify-between">
          <div className="font-mono text-[11px] tracking-[2px] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>EARLY ACCESS</div>
          <div className="space-y-4">
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Private beta. Founding member access available.
            </p>
            <button onClick={onGetAccess} className="sys-btn">Request Access →</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-8 py-4">
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>© 2026 AudFlo — Real-Time Visibility Engine</span>
        <motion.span animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3, repeat: Infinity }}
          className="font-mono text-[11px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          ● SYSTEM ACTIVE
        </motion.span>
      </div>
    </footer>
  );
}

// ─── UNLOCK MODAL ─────────────────────────────────────────────────────────
function UnlockModal({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div key="uo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(5,6,6,0.9)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md w-full mx-4 border"
          style={{ background: 'var(--bg-deep)', borderColor: 'rgba(0,255,136,0.2)', boxShadow: '0 0 60px rgba(0,255,136,0.06)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
          <div className="px-8 py-10 space-y-7">
            <div>
              <SysLabel>ACCESS REQUIRED</SysLabel>
              <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text-primary)' }}>Full Diagnosis</h2>
            </div>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              This system maps how AI understands your business. The full report shows every signal being missed — and exactly how to fix each one.
            </p>
            <div className="space-y-2 border-l-2 pl-4" style={{ borderColor: 'var(--accent)' }}>
              <div className="font-mono text-[11px] tracking-[2px] uppercase mb-2.5" style={{ color: 'var(--accent)', opacity: 0.7 }}>UNLOCKS</div>
              {['Complete visibility score + breakdown', 'Entity mapping — all signals', 'Citation gap analysis', 'Structured fixes + copy-paste prompts', 'Distribution plan'].map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.06 }}
                  className="flex items-center gap-2 font-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 7 }}>●</span>{item}
                </motion.div>
              ))}
            </div>
            <motion.button whileHover={{ boxShadow: '0 0 24px rgba(0,255,136,0.14)' }} onClick={onUnlock}
              className="w-full sys-btn text-center"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(0,255,136,0.04)' }}>
              [ UNLOCK SYSTEM ACCESS ]
            </motion.button>
            <button onClick={onClose} className="w-full font-mono text-[11px] tracking-[1.5px] uppercase" style={{ color: 'var(--text-dim)' }}>close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [revealed, setRevealed]       = useState(false);
  const [preview, setPreview]         = useState(true);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isUnlocked, setIsUnlocked]   = useState(false);
  const [showUnlock, setShowUnlock]   = useState(false);
  const [hasUrl, setHasUrl]           = useState(false);
  const { openWaitlist, openPaywall } = useWaitlist();
  const auditResultsRef = useRef<AuditResultsHandle>(null);

  const handleGetAccess  = useCallback(() => openWaitlist('homepage-cta'), [openWaitlist]);
  const handleOpenPaywall = useCallback(() => openPaywall('cta-trigger'), [openPaywall]);
  const handleAuditStart = useCallback(() => setPreview(false), []);
  const handleReveal     = useCallback((r: AuditResult) => { setAuditResult(r); setRevealed(true); }, []);
  const handleFixFirst   = useCallback((id: string) => { auditResultsRef.current?.scrollToIssue(id); }, []);
  const handleRunScan    = useCallback(() => { document.getElementById('scan')?.scrollIntoView({ behavior: 'smooth' }); }, []);
  const handleUnlock     = useCallback(() => { setIsUnlocked(true); setShowUnlock(false); }, []);

  return (
    <ChunkErrorBoundary>
      <div style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="grain-overlay" aria-hidden="true" />

        <StageHero onRunScan={handleRunScan} onGetAccess={handleGetAccess} />
        <RelatableMoment />
        <StageBuiltFor />
        <StageSignalDetection />
        <StageGapDetection onRunScan={handleRunScan} />
        <StageLiveScan
          revealed={revealed} preview={preview} auditResult={auditResult} isUnlocked={isUnlocked} hasUrl={hasUrl}
          onReveal={handleReveal} onAuditStart={handleAuditStart} onWaitlistOpen={handleGetAccess}
          onFixFirst={handleFixFirst} onOpenUnlock={() => setShowUnlock(true)} auditResultsRef={auditResultsRef}
          onUrlChange={(u) => setHasUrl(u.trim().length > 0)}
        />
        <StageDiagnosis />
        <StageStructuredFixes onGetAccess={handleOpenPaywall} />
        <StageDistribution onGetAccess={handleOpenPaywall} />
        <StageComparison onGetAccess={handleOpenPaywall} />
        <StageBeforeAfter />
        <StageFAQ />
        <PrePricingBridge />
        <StagePricing onGetAccess={handleGetAccess} />
        <Footer onGetAccess={handleGetAccess} />

        <WaitlistModal />
        <PaywallModal />
        {showUnlock && <UnlockModal onUnlock={handleUnlock} onClose={() => setShowUnlock(false)} />}
      </div>
    </ChunkErrorBoundary>
  );
}
