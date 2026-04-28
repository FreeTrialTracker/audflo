'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useWaitlist } from './use-waitlist';
import { WaitlistForm } from './waitlist-form';
import { WaitlistSuccess } from './waitlist-success';

export function WaitlistModal() {
  const { isWaitlistOpen, closeWaitlist } = useWaitlist();
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  // Reset success state when modal re-opens
  useEffect(() => {
    if (!isWaitlistOpen) {
      const t = setTimeout(() => setSuccessEmail(null), 300);
      return () => clearTimeout(t);
    }
  }, [isWaitlistOpen]);

  const handleSuccess = (email: string) => {
    setSuccessEmail(email);
  };

  return (
    <Dialog.Root open={isWaitlistOpen} onOpenChange={(open) => !open && closeWaitlist()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ background: 'rgba(10, 9, 14, 0.85)', backdropFilter: 'blur(4px)', zIndex: 10000 }}
          />
        </Dialog.Overlay>

        {/* Modal */}
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 flex items-center justify-center outline-none overflow-y-auto"
            style={{ zIndex: 10001, padding: '24px 16px' }}
          >
            <div
              className="relative w-full flex-shrink-0"
              style={{
                maxWidth: 480,
                background: 'var(--bg-panel)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Header bar */}
              <div style={{
                padding: '0 20px',
                height: 48,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 9,
                  letterSpacing: '2.5px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: 'var(--accent)', fontSize: 10 }}
                  >
                    ●
                  </motion.span>
                  EARLY ACCESS
                </span>
                <Dialog.Close
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.2)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </Dialog.Close>
              </div>

              {/* Body */}
              <div style={{ padding: '24px 24px 28px' }}>
                <AnimatePresence mode="wait">
                  {successEmail ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <WaitlistSuccess email={successEmail} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Header */}
                      <div style={{ marginBottom: 24 }}>
                        <Dialog.Title
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: '-0.03em',
                            lineHeight: 1.15,
                            color: 'var(--text-primary)',
                            marginBottom: 8,
                          }}
                        >
                          Get early access to AudFlo
                        </Dialog.Title>
                        <Dialog.Description
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: 11,
                            lineHeight: 1.6,
                            color: 'var(--text-secondary)',
                            letterSpacing: '0.2px',
                          }}
                        >
                          Join the founding waitlist. Founding members get 50% off Pro for life.
                        </Dialog.Description>
                      </div>

                      <WaitlistForm onSuccess={handleSuccess} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
