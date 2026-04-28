'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
  id: string;
  label: string;
  pct: number;
}

interface Drop {
  afterIndex: number;
  value: string;
  pct: number;
  severity: 'critical' | 'medium';
}

const NODES: Node[] = [
  { id: 'visitor', label: 'VISITOR', pct: 100 },
  { id: 'landing', label: 'LANDING', pct: 68 },
  { id: 'signup', label: 'SIGNUP', pct: 26 },
  { id: 'confirm', label: 'EMAIL CONFIRM', pct: 14 },
  { id: 'dashboard', label: 'DASHBOARD', pct: 9 },
  { id: 'activation', label: 'ACTIVATION', pct: 4 },
];

const DROPS: Drop[] = [
  { afterIndex: 0, value: '32% DROP', pct: 32, severity: 'medium' },
  { afterIndex: 1, value: '62% DROP', pct: 62, severity: 'critical' },
  { afterIndex: 2, value: '46% DROP', pct: 46, severity: 'critical' },
  { afterIndex: 3, value: '36% DROP', pct: 36, severity: 'medium' },
  { afterIndex: 4, value: '55% DROP', pct: 55, severity: 'critical' },
];

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return <>{current}%</>;
}

export default function LeakMap({ revealed, preview }: { revealed: boolean; preview: boolean }) {
  const [visibleNodes, setVisibleNodes] = useState<number>(0);
  const [visibleDrops, setVisibleDrops] = useState<Set<number>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // In preview mode, show everything immediately (dimmed)
  const active = revealed || preview;

  useEffect(() => {
    if (preview && !revealed) {
      setVisibleNodes(NODES.length);
      setVisibleDrops(new Set(DROPS.map((_, i) => i)));
      return;
    }
    if (!revealed) {
      setVisibleNodes(0);
      setVisibleDrops(new Set());
      return;
    }

    // Reset first so animation replays cleanly after preview
    setVisibleNodes(0);
    setVisibleDrops(new Set());

    const timers: ReturnType<typeof setTimeout>[] = [];

    NODES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleNodes(i + 1), i * 280));
    });

    DROPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleDrops(prev => {
            const next = new Set(prev);
            next.add(i);
            return next;
          });
        }, 600 + i * 320),
      );
    });

    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [revealed, preview]);

  // Derived inside component so data stays reactive
  const biggestDrop = DROPS.reduce((max, d) => (d.pct > max.pct ? d : max), DROPS[0]);
  const biggestDropNodeLabel = NODES[biggestDrop.afterIndex + 1]?.label ?? 'LANDING';

  return (
    <motion.div
      className="space-y-5"
      animate={{ opacity: preview && !revealed ? 0.55 : 1, filter: preview && !revealed ? 'blur(0.5px)' : 'none' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className="font-mono text-[11px] tracking-[2px] uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Conversion Leak Map
        </span>
        {revealed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[10px] tracking-widest"
            style={{ color: 'var(--accent)' }}
          >
            ● LIVE
          </motion.span>
        )}

        <AnimatePresence>
          {visibleDrops.has(biggestDrop.afterIndex) && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-1"
            >
              <div
                className="flex items-center gap-2 px-3 py-1 border font-mono text-[10px] tracking-[1.5px] uppercase"
                style={{
                  borderColor: 'rgba(255,92,92,0.35)',
                  background: 'rgba(255,92,92,0.07)',
                  boxShadow: '0 0 10px rgba(255,92,92,0.1)',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Biggest Leak:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                  {biggestDropNodeLabel} ({biggestDrop.value})
                </span>
              </div>
              <div
                className="font-mono text-[9px] tracking-[1.5px] uppercase px-1"
                style={{ color: 'var(--danger)', opacity: 0.75 }}
              >
                THIS IS YOUR PRIMARY CONVERSION FAILURE POINT
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <div
          className="flex items-start gap-0 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {NODES.map((node, i) => (
            <div key={node.id} className="flex items-start shrink-0">
              <AnimatePresence>
                {(i < visibleNodes) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={`px-3 py-2 border font-mono text-[10px] tracking-[1.5px] uppercase transition-all ${
                        active ? 'node-active' : ''
                      }`}
                      style={{
                        borderColor:
                          visibleDrops.has(i - 1) && DROPS[i - 1]?.severity === 'critical'
                            ? 'rgba(255,92,92,0.3)'
                            : 'var(--border)',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-elevated)',
                        minWidth: 80,
                        textAlign: 'center',
                      }}
                    >
                      {node.label}
                    </div>
                    <div
                      className="font-mono text-[13px] font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {active ? (
                        <AnimatedNumber target={node.pct} duration={preview && !revealed ? 0 : 900 + i * 150} />
                      ) : (
                        '—'
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {i < NODES.length - 1 && (
                <div className="flex flex-col items-center mx-1 mt-3">
                  <span style={{ color: 'var(--border)', fontSize: 12 }}>→</span>
                  <AnimatePresence>
                    {visibleDrops.has(i) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-1 mt-1 font-mono text-[10px] font-bold danger-blink"
                        style={{
                          color:
                            DROPS[i]?.severity === 'critical'
                              ? 'var(--danger)'
                              : 'var(--warning)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>⚠</span>
                        <span>{DROPS[i]?.value}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
