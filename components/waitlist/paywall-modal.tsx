'use client';

import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useWaitlist } from './use-waitlist';

const TIERS = [
  {
    badge: 'FREE',
    name: 'Post-Launch Check',
    features: ['Find out why nobody came'],
    highlight: false,
  },
  {
    badge: '$9 / month',
    name: 'Visibility Tracking',
    features: ['See if anything is working yet'],
    highlight: false,
  },
  {
    badge: '$29 / month',
    name: 'Get Users',
    features: [
      'Get exact posts to publish',
      'Know where to publish them',
      'Start getting users',
    ],
    highlight: true,
  },
];

export function PaywallModal() {
  const { isPaywallOpen, closePaywall, openWaitlist } = useWaitlist();

  const handleJoinWaitlist = () => {
    closePaywall();
    openWaitlist('paywall-cta');
  };

  return (
    <Dialog.Root open={isPaywallOpen} onOpenChange={(open) => !open && closePaywall()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(5, 6, 6, 0.88)',
            backdropFilter: 'blur(6px)',
          }}
        />

        {/* Content */}
        <Dialog.Content
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            overflowY: 'auto',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#111313',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '0 20px',
              height: 48,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 9,
                letterSpacing: '2.5px',
                textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ color: 'var(--accent)', fontSize: 10 }}
                >●</motion.span>
                EARLY ACCESS
              </span>
              <Dialog.Close
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.25)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="Close"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Body */}
            <div style={{ padding: '28px 24px 32px' }}>

              {/* Headline */}
              <Dialog.Title
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(19px, 3vw, 24px)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2,
                  color: '#ffffff',
                  marginBottom: 10,
                  margin: '0 0 10px',
                }}
              >
                You don't need more analysis.{' '}
                <span style={{ color: 'var(--accent)' }}>You need users.</span>
              </Dialog.Title>

              <Dialog.Description
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  lineHeight: 1.75,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 28,
                  display: 'block',
                }}
              >
                We already showed you why nobody came.<br />
                Now we show you exactly what to do to get your first users.
              </Dialog.Description>

              {/* Pricing tiers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                {TIERS.map((tier) => (
                  <div
                    key={tier.badge}
                    style={{
                      border: tier.highlight
                        ? '1px solid rgba(0,255,136,0.4)'
                        : '1px solid rgba(255,255,255,0.1)',
                      background: tier.highlight
                        ? 'rgba(0,255,136,0.06)'
                        : 'rgba(255,255,255,0.03)',
                      padding: '14px 16px',
                      position: 'relative',
                    }}
                  >
                    {tier.highlight && (
                      <span style={{
                        position: 'absolute',
                        top: -1,
                        right: 12,
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 8,
                        letterSpacing: '1.5px',
                        textTransform: 'uppercase' as const,
                        background: 'var(--accent)',
                        color: '#000',
                        fontWeight: 700,
                        padding: '2px 7px',
                      }}>
                        RECOMMENDED
                      </span>
                    )}

                    {/* Tier header row */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 13,
                        fontWeight: 700,
                        color: tier.highlight ? 'var(--accent)' : 'rgba(255,255,255,0.65)',
                        letterSpacing: '0.3px',
                      }}>
                        {tier.badge}
                      </span>
                      <span style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.2px',
                      }}>
                        {tier.name}
                      </span>
                    </div>

                    {/* Features */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tier.features.map((f) => (
                        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                          <span style={{
                            color: tier.highlight ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
                            fontSize: 11,
                            lineHeight: 1.6,
                            flexShrink: 0,
                          }}>✔</span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: 12,
                            color: tier.highlight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                            lineHeight: 1.6,
                          }}>
                            {f}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Primary CTA */}
              <button
                onClick={handleJoinWaitlist}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  width: '100%',
                  padding: '14px 24px',
                  background: 'var(--accent)',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase' as const,
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 10,
                  display: 'block',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
              >
                [ JOIN WAITLIST → ]
              </button>

              {/* Secondary CTA */}
              <button
                onClick={closePaywall}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  width: '100%',
                  padding: '11px 24px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  marginBottom: 18,
                  display: 'block',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)')}
              >
                Continue with Free
              </button>

              {/* Microcopy */}
              <p style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10,
                color: 'rgba(255,255,255,0.22)',
                textAlign: 'center',
                letterSpacing: '0.3px',
                margin: 0,
              }}>
                Early users will get full access when we launch.
              </p>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
