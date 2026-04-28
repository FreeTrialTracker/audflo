'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

// ─── SVG path strings (reused for both the visible lines and offsetPath) ────
const PATH_1_2 = 'M 168 134 C 168 175 290 185 290 220';
const PATH_2_4 = 'M 340 308 C 400 340 490 340 520 355';
const PATH_2_3 = 'M 240 308 C 200 340 130 340 110 355';

// Node positions (center x, top y) — these drive both SVG rendering and label placement
const N1 = { x: 90,  y: 32,  w: 240, h: 102 }; // trigger
const N2 = { x: 215, y: 210, w: 240, h: 98 };  // branch
const N3 = { x: 10,  y: 345, w: 220, h: 98 };  // action false
const N4 = { x: 400, y: 345, w: 220, h: 98 };  // action true

// ─── Sub-components ──────────────────────────────────────────────────────────

function SlackIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 10a1.5 1.5 0 1 0-3 0v4a1.5 1.5 0 0 0 3 0v-4z" fill="#E01E5A"/>
      <path d="M10 9.5a1.5 1.5 0 1 0 0-3H6a1.5 1.5 0 0 0 0 3h4z" fill="#36C5F0"/>
      <path d="M9.5 14a1.5 1.5 0 1 0 0 3h4a1.5 1.5 0 0 0 0-3h-4z" fill="#2EB67D"/>
      <path d="M14 14.5a1.5 1.5 0 1 0 3 0v-4a1.5 1.5 0 0 0-3 0v4z" fill="#ECB22E"/>
    </svg>
  );
}

function LinearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4l16 16M4 4l16 16" stroke="#5E6AD2" strokeWidth="0" />
      <path fillRule="evenodd" clipRule="evenodd" d="M3.5 14.5L14.5 3.5a1 1 0 0 1 1.414 0l4.586 4.586a1 1 0 0 1 0 1.414L9.5 20.5 3.5 14.5z" fill="#5E6AD2"/>
    </svg>
  );
}

function BranchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3v12M6 15c0 3 3 3 3 6M6 15c0 3-3 3-3 6M18 3v6M18 9c0 3-3 3-3 6" stroke="#7A4FE8" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function NodeCard({
  accent,
  style,
  children,
  reduced,
}: {
  accent: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  reduced?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ y: hovered ? -2 : 0, boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'absolute',
        background: '#FDFAF4',
        border: '1px solid #E8DFD0',
        borderRadius: 14,
        padding: '14px 14px 14px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        opacity: reduced ? 0.62 : 1,
        overflow: 'hidden',
        transition: 'opacity 0.3s',
        ...style,
      }}
    >
      {/* Left accent strip */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: '14px 0 0 14px' }} />
      {children}
    </motion.div>
  );
}

function MonoLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
      {children}
    </div>
  );
}

// ─── Canvas Scaler ────────────────────────────────────────────────────────────
// Renders a fixed 700×520 canvas and scales it proportionally to the container.
function CanvasScaler({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const apply = () => {
      const scale = outer.offsetWidth / 700;
      inner.style.transform = `scale(${scale})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} style={{ position: 'relative', width: '100%', paddingBottom: `${(520/700)*100}%`, overflow: 'hidden', background: '#FDFAF4' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <div ref={innerRef} style={{ position: 'absolute', top: 0, left: 0, width: 700, height: 520, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface RunEntry { id: number; label: string; time: string }

export default function HeroFlowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [branchResult, setBranchResult] = useState<'evaluating' | 'true'>('evaluating');
  const [node4done, setNode4done] = useState(false);
  const [runEntries, setRunEntries] = useState<RunEntry[]>([
    { id: 1, label: '12s ago · 0.3s', time: '12s ago' },
    { id: 2, label: '47s ago · 0.5s', time: '47s ago' },
    { id: 3, label: '1m ago · 0.4s', time: '1m ago' },
  ]);
  const [showJustNow, setShowJustNow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(true);
  const runRef = useRef(false);
  const entryIdRef = useRef(10);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Intersection observer — pause when off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const runCycle = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;

    // t=0: reset
    setPhase('idle');
    setBranchResult('evaluating');
    setNode4done(false);
    setShowJustNow(false);
    await sleep(200);

    // t=0.2: node1 pulse
    setPhase('running');
    await sleep(400);

    // dot travels 1→2 (handled by Framer via phase trigger), branch evaluates at t=1.4
    await sleep(1000);
    setBranchResult('true');
    await sleep(600);

    // dot travels 2→4 (~1s)
    await sleep(1000);
    setNode4done(true);

    // t=3: run history entry
    await sleep(400);
    setShowJustNow(true);
    setRunEntries(prev => prev.slice(0, 2));

    // t=4.5: fade indicators
    await sleep(1500);
    setPhase('done');

    // t=5.8: reset
    await sleep(1300);
    runRef.current = false;
  }, []);

  // Loop controller
  useEffect(() => {
    if (reducedMotion || !inView) return;
    runCycle();
    const id = setInterval(() => { runCycle(); }, 6200);
    return () => clearInterval(id);
  }, [reducedMotion, inView, runCycle]);

  // Frozen frame for reduced-motion
  if (reducedMotion) {
    return <HeroFlowStatic />;
  }

  const dot12Visible = phase === 'running';
  const dot24Visible = phase === 'running' && branchResult === 'true';
  const line12Bright = phase === 'running' || phase === 'done';
  const line24Bright = dot24Visible || phase === 'done';

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Animated demonstration of an AudFlo workflow: an urgent Slack message in the #support channel triggers a branch that sends a DM to the on-call engineer in 0.4 seconds."
      style={{ position: 'relative', width: '100%' }}
    >
      {/* Screen-reader run history */}
      <div className="sr-only" aria-live="polite" aria-atomic="false">
        {showJustNow && 'Flow ran successfully in 0.4 seconds.'}
      </div>

      {/* Browser chrome wrapper */}
      <div style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #D4CCBF',
        boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
        background: '#FDFAF4',
      }}>
        {/* Chrome bar */}
        <div style={{
          background: '#F5F1E8',
          borderBottom: '1px solid #E8DFD0',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6357' }}>
            audflo.com / live-runs
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4A9B5C' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9B5C', display: 'inline-block' }} />
            LIVE
          </div>
        </div>

        {/* Canvas — scales inner 700×520 content to container width */}
        <CanvasScaler>

          {/* Dot-grid pattern */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            <defs>
              <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="0.9" fill="#D4CCBF" />
              </pattern>
              {/* Gradient defs for lines */}
              <linearGradient id="lg-12" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2845D4" />
                <stop offset="100%" stopColor="#7A4FE8" />
              </linearGradient>
              <linearGradient id="lg-24" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7A4FE8" />
                <stop offset="100%" stopColor="#F26B3A" />
              </linearGradient>
              <linearGradient id="lg-23" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7A4FE8" />
                <stop offset="100%" stopColor="#E8497A" />
              </linearGradient>
              <linearGradient id="lg-dot" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2845D4" />
                <stop offset="40%" stopColor="#7A4FE8" />
                <stop offset="70%" stopColor="#E8497A" />
                <stop offset="100%" stopColor="#F26B3A" />
              </linearGradient>
              <filter id="dot-glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="orb-blur">
                <feGaussianBlur stdDeviation="60" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />

            {/* Ambient orb */}
            <motion.ellipse
              cx="50%" cy="48%"
              rx="200" ry="180"
              fill="url(#lg-dot)"
              opacity={0.07}
              filter="url(#orb-blur)"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '50% 48%' }}
            />

            {/* Base connection lines (dim) */}
            <path d={PATH_1_2} stroke="url(#lg-12)" strokeWidth="2" fill="none" opacity={0.3} strokeDasharray="6 4" />
            <path d={PATH_2_4} stroke="url(#lg-24)" strokeWidth="2" fill="none" opacity={0.3} />
            <path d={PATH_2_3} stroke="url(#lg-23)" strokeWidth="2" fill="none" opacity={0.3} strokeDasharray="6 4" />

            {/* Brightening overlay lines (animate pathLength) */}
            <motion.path
              d={PATH_1_2}
              stroke="url(#lg-12)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={line12Bright ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
            <motion.path
              d={PATH_2_4}
              stroke="url(#lg-24)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={line24Bright ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          </svg>

          {/* Branch label pills */}
          <div style={{ position: 'absolute', left: 148, top: 338, zIndex: 4, pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#E8497A', background: '#FDFAF4', border: '1px solid #E8DFD0', borderRadius: 99, padding: '2px 7px', letterSpacing: '0.06em' }}>FALSE</div>
          </div>
          <div style={{ position: 'absolute', left: 430, top: 338, zIndex: 4, pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#F26B3A', background: '#FDFAF4', border: '1px solid #E8DFD0', borderRadius: 99, padding: '2px 7px', letterSpacing: '0.06em' }}>TRUE</div>
          </div>

          {/* Animated travel dots using offsetPath */}
          <AnimatePresence>
            {dot12Visible && (
              <motion.div
                key="dot12"
                aria-hidden="true"
                initial={{ offsetDistance: '0%', opacity: 1 }}
                animate={{ offsetDistance: '100%', opacity: [1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0, ease: 'easeInOut', opacity: { times: [0, 0.85, 1], duration: 1.0 } }}
                style={{
                  position: 'absolute',
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2845D4, #7A4FE8)',
                  boxShadow: '0 0 12px 4px rgba(122,79,232,0.7)',
                  offsetPath: `path("${PATH_1_2}")`,
                  offsetRotate: '0deg',
                  transform: 'translate(-7px, -7px)',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              />
            )}
            {dot24Visible && (
              <motion.div
                key="dot24"
                aria-hidden="true"
                initial={{ offsetDistance: '0%', opacity: 1 }}
                animate={{ offsetDistance: '100%', opacity: [1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0, ease: 'easeInOut', delay: 0.1, opacity: { times: [0, 0.85, 1], duration: 1.0 } }}
                style={{
                  position: 'absolute',
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7A4FE8, #F26B3A)',
                  boxShadow: '0 0 12px 4px rgba(232,73,122,0.7)',
                  offsetPath: `path("${PATH_2_4}")`,
                  offsetRotate: '0deg',
                  transform: 'translate(-7px, -7px)',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>

          {/* NODE 1 — TRIGGER */}
          <NodeCard accent="#2845D4" style={{ left: N1.x, top: N1.y, width: N1.w }}>
            <motion.div
              animate={phase === 'running' ? {
                boxShadow: ['0 0 0 0px rgba(40,69,212,0)', '0 0 0 8px rgba(40,69,212,0.2)', '0 0 0 0px rgba(40,69,212,0)'],
              } : { boxShadow: '0 0 0 0px rgba(40,69,212,0)' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, borderRadius: 14, pointerEvents: 'none' }}
            />
            <MonoLabel color="#2845D4">
              <SlackIcon size={11} /> TRIGGER · slack.message.new
            </MonoLabel>
            {/* Channel pill */}
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4B5563', background: '#EDE9FE', padding: '2px 8px', borderRadius: 4 }}>#support</span>
            </div>
            {/* Message preview */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4A9B8E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#fff', fontWeight: 600 }}>MK</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>Maya K.</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#9CA3AF' }}>2:47 PM</span>
                </div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#374151', lineHeight: 1.4, margin: 0 }}>
                  Server is down, this is urgent - anyone available?
                </p>
              </div>
            </div>
          </NodeCard>

          {/* NODE 2 — BRANCH */}
          <NodeCard accent="#7A4FE8" style={{ left: N2.x, top: N2.y, width: N2.w }}>
            <MonoLabel color="#7A4FE8">
              <BranchIcon size={11} /> BRANCH · branch.if
            </MonoLabel>
            {/* Code block */}
            <div style={{ background: '#F0ECF8', border: '1px solid #E8DFD0', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#4C1D95' }}>
                message.text.includes("urgent")
              </code>
            </div>
            {/* Result indicator */}
            <AnimatePresence mode="wait">
              {branchResult === 'evaluating' ? (
                <motion.div key="eval" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#9CA3AF' }}>
                  → Evaluating...
                </motion.div>
              ) : (
                <motion.div key="true" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#4A9B5C', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="#4A9B5C" opacity="0.15"/><path d="M3 6L5.5 8.5L9 4" stroke="#4A9B5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  → TRUE
                </motion.div>
              )}
            </AnimatePresence>
          </NodeCard>

          {/* NODE 3 — ACTION (false, skipped) */}
          <NodeCard accent="#E8497A" style={{ left: N3.x, top: N3.y, width: N3.w }} reduced>
            <MonoLabel color="#E8497A">
              <LinearIcon size={11} /> ACTION · linear.create.ticket
            </MonoLabel>
            {/* Linear ticket preview */}
            <div style={{ background: '#FDF2F7', border: '1px solid #F9D0E3', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>ENG-1247</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>Support: Server is down</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, background: '#FFE4E6', color: '#9F1239', padding: '2px 6px', borderRadius: 4 }}>P3 - Low</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, background: '#F3F4F6', color: '#6B7280', padding: '2px 6px', borderRadius: 4 }}>Backlog</span>
              </div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
              Skipped (branch took TRUE path)
            </div>
          </NodeCard>

          {/* NODE 4 — ACTION (true branch) */}
          <NodeCard accent="#F26B3A" style={{ left: N4.x, top: N4.y, width: N4.w }}>
            <MonoLabel color="#F26B3A">
              <SlackIcon size={11} /> ACTION · slack.send.dm
            </MonoLabel>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#6B7280', marginBottom: 5 }}>To: @oncall-engineer</div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#1A1A1A', margin: 0, lineHeight: 1.4 }}>
                🚨 Urgent in #support: Server is down, this is urgent...
              </p>
            </div>
            <AnimatePresence mode="wait">
              {node4done ? (
                <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4A9B5C', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="#4A9B5C" opacity="0.15"/><path d="M2.5 5L4.5 7L8 3" stroke="#4A9B5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Delivered in 0.4s
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#D1D5DB' }}>
                  Waiting...
                </motion.div>
              )}
            </AnimatePresence>
          </NodeCard>

          {/* STATS BADGE */}
          <motion.div
            aria-hidden="true"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 20,
              background: '#fff', border: '1px solid #E8DFD0',
              borderRadius: 999, padding: '4px 12px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: '#4A9B5C', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A9B5C', display: 'inline-block' }} />
            1,247 runs this week
          </motion.div>

          {/* RUN HISTORY WIDGET */}
          <div
            style={{
              position: 'absolute', bottom: 14, right: 14, zIndex: 20,
              background: '#0F0E13', borderRadius: 12, padding: 12, width: 220,
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4A9B5C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A9B5C', display: 'inline-block' }} />
              RECENT RUNS
            </div>
            <AnimatePresence initial={false}>
              {showJustNow && (
                <motion.div
                  key="justnow"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #2A2520', background: 'rgba(74,155,92,0.06)', borderRadius: 4, paddingLeft: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9B5C', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#F5F1E8' }}>Just now · 0.4s</div>
                    </div>
                  </div>
                </motion.div>
              )}
              {runEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: i === runEntries.length - 1 && showJustNow ? 0 : 1 }}
                  transition={{ duration: 0.4 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < runEntries.length - 1 ? '1px solid #2A2520' : 'none' }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A9B5C', flexShrink: 0 }} />
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#A8A095' }}>{entry.label}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

        </CanvasScaler>
      </div>
    </div>
  );
}

// Static frozen frame (reduced-motion fallback) at t=2.6s state
function HeroFlowStatic() {
  return (
    <div
      role="img"
      aria-label="AudFlo workflow diagram: an urgent Slack message triggers a branch that sends a DM to the on-call engineer."
      style={{ position: 'relative', width: '100%', maxWidth: 700 }}
    >
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #D4CCBF', boxShadow: '0 24px 64px rgba(0,0,0,0.14)', background: '#FDFAF4' }}>
        <div style={{ background: '#F5F1E8', borderBottom: '1px solid #E8DFD0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6357' }}>audflo.com / live-runs</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4A9B5C' }}>● LIVE</div>
        </div>
        <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6357' }}>Workflow diagram: Slack → Branch → DM @oncall (0.4s)</p>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}


