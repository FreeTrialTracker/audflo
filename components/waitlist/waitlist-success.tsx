'use client';

import { motion } from 'framer-motion';
import { useWaitlist } from './use-waitlist';

const MONO = 'IBM Plex Mono, monospace';

interface WaitlistSuccessProps {
  email: string;
}

export function WaitlistSuccess({ email }: WaitlistSuccessProps) {
  const closeWaitlist = useWaitlist((s) => s.closeWaitlist);

  const twitterText = encodeURIComponent(
    'Just joined the @AudFloHQ waitlist. If you want AI to actually recommend your product, check this out. audflo.com'
  );
  const linkedinText = encodeURIComponent(
    'Just reserved my spot on the AudFlo waitlist — a tool that helps founders get their products recommended by AI. audflo.com'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
    >
      {/* Check icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          background: 'rgba(0,230,118,0.1)',
          border: '1px solid rgba(0,230,118,0.3)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12L10 17L19 7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 8 }}>
        You&apos;re in.
      </h2>
      <p style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 300 }}>
        Confirmation sent to{' '}
        <span style={{ color: 'var(--text-primary)' }}>{email}</span>.
        While you wait, do us one favor.
      </p>

      {/* Favor card */}
      <div
        style={{
          width: '100%',
          borderRadius: 6,
          padding: '16px 18px',
          marginBottom: 24,
          textAlign: 'left',
          background: 'var(--bg-deep)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
          ONE FAVOR
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          Tell us your biggest AI visibility problem
        </p>
        <p style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Reply to our welcome email with the #1 reason you think AI isn&apos;t recommending your product. We read every response and it shapes what we build first.
        </p>
      </div>

      {/* Share */}
      <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>
        SPREAD THE WORD
      </p>
      <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 20 }}>
        {[
          {
            href: `https://twitter.com/intent/tweet?text=${twitterText}`,
            label: 'Share on X',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            ),
          },
          {
            href: `https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Faudflo.com&summary=${linkedinText}`,
            label: 'Share on LinkedIn',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            ),
          },
        ].map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '1px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-deep)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6,
              padding: '10px 0',
              textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {btn.icon}
            {btn.label}
          </a>
        ))}
      </div>

      <button
        onClick={closeWaitlist}
        className="sys-btn"
        style={{ width: '100%', justifyContent: 'center', fontSize: 10, letterSpacing: '2px' }}
      >
        [ CLOSE ]
      </button>
    </motion.div>
  );
}
