'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AuditResult, ScanRaw } from './scannerTypes';
import { analyzeRawScan } from './auditEngine';

const SCAN_STEPS = [
  'FETCHING PAGE HTML',
  'CHECKING ROBOTS & SITEMAP',
  'ANALYZING METADATA',
  'SCANNING STRUCTURED DATA',
  'RUNNING AEO CHECKS',
  'COMPLETE',
] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface LeftPanelProps {
  onReveal: (result: AuditResult) => void;
  onWaitlistOpen: () => void;
  onAuditStart: () => void;
  onUrlChange?: (url: string) => void;
}

// Fix #6: typing animation for placeholder
const PLACEHOLDER_FULL = 'https://yourapp.com';

function useTypingPlaceholder(active: boolean) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) return;
    let i = 0;
    setDisplayed('');
    const id = setInterval(() => {
      i++;
      setDisplayed(PLACEHOLDER_FULL.slice(0, i));
      if (i >= PLACEHOLDER_FULL.length) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, [active]);
  return displayed || PLACEHOLDER_FULL;
}

export default function LeftPanel({ onReveal, onWaitlistOpen, onAuditStart, onUrlChange }: LeftPanelProps) {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const placeholder = useTypingPlaceholder(!scanning && !done);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const handleReset = () => {
    setUrl('');
    onUrlChange?.('');
    setDone(false);
    setScanning(false);
    setScanStep(0);
    setError(null);
    timersRef.current.forEach(clearTimeout);
    setTimeout(() => document.getElementById('url-input')?.focus(), 50);
  };

  const handleRunAudit = async () => {
    if (scanning || done) return;
    let targetUrl = url.trim();
    if (!targetUrl) return;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

    setError(null);
    onAuditStart();
    setScanning(true);
    setScanStep(0);

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    [0, 1, 2, 3, 4].forEach(i => {
      stepTimers.push(setTimeout(() => setScanStep(i), i * 600));
    });
    timersRef.current = stepTimers;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'Apikey': ANON_KEY,
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data: ScanRaw & { error?: string } = await res.json();
      stepTimers.forEach(clearTimeout);

      if (data.error || !data.html) {
        setScanning(false);
        setError(data.error ?? 'Could not fetch the page. Check the URL and try again.');
        return;
      }

      setScanStep(4);
      const result = analyzeRawScan(data);
      await new Promise(r => setTimeout(r, 400));
      setScanStep(5);
      await new Promise(r => setTimeout(r, 500));
      setScanning(false);
      setDone(true);
      onReveal(result);
    } catch {
      timersRef.current.forEach(clearTimeout);
      setScanning(false);
      setError('Network error. Check your connection and try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRunAudit();
  };

  return (
    <div className="flex flex-col h-full min-h-screen justify-between py-10 px-6 lg:px-10" style={{ background: 'var(--bg-deep)' }}>
      <div className="space-y-10">

        {/* System label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 sys-label"
        >
          <span style={{ color: 'var(--accent)', opacity: 0.5 }}>[ </span>
          INPUT STREAM
          <span style={{ color: 'var(--accent)', opacity: 0.5 }}> ]</span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2
            style={{
              fontSize: 'clamp(32px, 3.5vw, 52px)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 0.92,
              color: 'var(--text-primary)',
            }}
          >
            Enter your<br />
            <span style={{ color: 'var(--accent)' }}>target URL</span>
          </h2>
          <p className="font-mono text-[12px] leading-relaxed mt-4 max-w-[280px]" style={{ color: 'var(--text-secondary)' }}>
            The system will analyze every public signal AI uses to discover, categorize, and cite your site.
          </p>
        </motion.div>

        {/* Terminal URL input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-2"
        >
          <div className="font-mono text-[10px] tracking-[2px] uppercase" style={{ color: 'var(--text-secondary)' }}>
            TARGET URL
          </div>
          <div
            className="flex items-center gap-2 border transition-all duration-300"
            style={{
              borderColor: inputFocused ? 'var(--accent)' : 'var(--border)',
              background: 'rgba(0,0,0,0.4)',
              boxShadow: inputFocused ? '0 0 18px rgba(0,255,136,0.10), inset 0 0 12px rgba(0,255,136,0.03)' : 'none',
            }}
            onClick={() => document.getElementById('url-input')?.focus()}
          >
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); onUrlChange?.(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={scanning || done}
              className="flex-1 font-mono text-[13px] py-3 px-4 bg-transparent outline-none"
              style={{
                color: 'var(--text-primary)',
                caretColor: 'var(--accent)',
                WebkitTextFillColor: 'var(--text-primary)',
                WebkitBoxShadow: '0 0 0 1000px transparent inset',
                transition: 'background-color 9999s ease',
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
          </div>
          {/* Fix #6: "5 seconds" reassurance */}
          {!scanning && !done && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-mono text-[11px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              This takes 5 seconds. No signup required.
            </motion.p>
          )}
        </motion.div>

        {/* Run / scan state / done */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="space-y-4"
        >
          <AnimatePresence mode="wait">
            {scanning ? (
              <motion.div
                key={`scan-${scanStep}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Scan progress bars */}
                <div className="space-y-2">
                  {SCAN_STEPS.slice(0, 5).map((step, i) => (
                    <div key={step} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-mono text-[10px] tracking-[1px]"
                          style={{ color: i <= scanStep ? 'var(--accent)' : 'var(--text-dim)' }}
                        >
                          {i <= scanStep ? '>' : '·'} {step}
                        </span>
                        {i < scanStep && (
                          <span className="font-mono text-[10px]" style={{ color: 'var(--accent)', opacity: 0.6 }}>DONE</span>
                        )}
                        {i === scanStep && (
                          <span className="font-mono text-[10px] cursor-blink" style={{ color: 'var(--accent)' }}>_</span>
                        )}
                      </div>
                      {i <= scanStep && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: i < scanStep ? '100%' : '60%' }}
                          transition={{ duration: 0.5 }}
                          style={{ height: 1, background: i < scanStep ? 'rgba(0,255,136,0.3)' : 'rgba(0,255,136,0.6)' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="font-mono text-[12px] tracking-[1.5px] flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                  <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>●</motion.span>
                  SCAN COMPLETE
                </div>
                <button
                  onClick={handleReset}
                  className="font-mono text-[11px] tracking-[1px] underline underline-offset-2"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  &gt; scan another URL
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                onClick={handleRunAudit}
                disabled={!url.trim()}
                className="sys-btn w-full text-center"
                style={{
                  borderColor: url.trim() ? 'var(--accent)' : 'var(--border)',
                  color: url.trim() ? 'var(--accent)' : 'var(--text-dim)',
                  opacity: url.trim() ? 1 : 0.4,
                  cursor: url.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                [ RUN SCAN ] →
              </motion.button>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[11px] leading-relaxed px-3 py-3 border"
                style={{
                  borderColor: 'rgba(255,68,68,0.3)',
                  background: 'rgba(255,68,68,0.05)',
                  color: 'var(--danger)',
                }}
              >
                ERROR: {error}
                <button
                  className="block mt-2 font-mono text-[10px] underline"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setError(null); setScanning(false); }}
                >
                  &gt; retry
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {done && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={onWaitlistOpen}
              className="sys-btn w-full text-center"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(0,255,136,0.04)' }}
            >
              SEE WHAT'S BROKEN →
            </motion.button>
          )}
        </motion.div>

        {/* What gets scanned */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-3"
        >
          <div className="font-mono text-[10px] tracking-[2px] uppercase border-b pb-2" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            SIGNAL CHECKS
          </div>
          <div className="space-y-1.5">
            {[
              'Discovery signals',
              'Entity clarity',
              'Trust layer',
              'Clarity score',
              'Flow analysis',
              'Differentiation',
              'Tech hygiene',
            ].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                className="font-mono text-[11px] flex items-center gap-2"
                style={{ color: done ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                <span style={{ opacity: 0.5 }}>{done ? '●' : '○'}</span>
                {item}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Status footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="font-mono text-[10px] tracking-[2px] flex items-center justify-between border-t pt-4"
        style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      >
        <span>
          STATUS: {done ? 'COMPLETE' : scanning ? SCAN_STEPS[scanStep] : 'READY'}
        </span>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ color: done ? 'var(--accent)' : scanning ? 'var(--warning)' : 'var(--text-dim)' }}
        >
          {done ? '● ACTIVE' : scanning ? '◉ SCANNING' : '○ IDLE'}
        </motion.span>
      </motion.div>
    </div>
  );
}
