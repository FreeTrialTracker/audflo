'use client';

import { useMemo, forwardRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  waitlistSchema,
  WaitlistFormData,
  TEAM_SIZE_OPTIONS,
  USE_CASE_OPTIONS,
  REASON_OPTIONS,
} from '@/lib/waitlist-schema';
import { useWaitlist } from './use-waitlist';

const MONO = 'IBM Plex Mono, monospace';

const fieldBase: React.CSSProperties = {
  width: '100%',
  fontFamily: MONO,
  fontSize: 12,
  color: 'var(--text-primary)',
  background: 'var(--bg-deep)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  padding: '10px 14px',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const fieldFocus: React.CSSProperties = {
  ...fieldBase,
  borderColor: 'var(--accent)',
};

const fieldError: React.CSSProperties = {
  ...fieldBase,
  borderColor: 'var(--danger)',
};

const REQUIRED_FIELDS: (keyof WaitlistFormData)[] = [
  'email', 'teamSize', 'useCase', 'reason', 'intent', 'wouldPay',
];

interface WaitlistFormProps {
  onSuccess: (email: string) => void;
}

export function WaitlistForm({ onSuccess }: WaitlistFormProps) {
  const source = useWaitlist((s) => s.source);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: '',
      companyName: '',
      teamSize: '',
      useCase: '',
      reason: '',
      intent: 'reserve',
      wouldPay: 'maybe',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const watchedValues = watch(REQUIRED_FIELDS);
  const intentValue   = watch('intent');

  const progressPercent = useMemo(() => {
    const filled = REQUIRED_FIELDS.filter((_, i) => {
      const v = watchedValues[i];
      return v !== '' && v !== undefined;
    }).length;
    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }, [watchedValues]);

  const onSubmit = async (data: WaitlistFormData) => {
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source }),
      });
      if (res.ok) {
        onSuccess(data.email);
      } else {
        const body = await res.json().catch(() => ({}));
        console.error('[waitlist] submit failed', res.status, body);
      }
    } catch (e) {
      console.error('[waitlist] network error', e);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Progress bar */}
      <div style={{ position: 'relative', height: 1, marginBottom: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ position: 'absolute', inset: '0 auto 0 0', background: 'var(--accent)', borderRadius: 2 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Email */}
        <Field label="EMAIL ADDRESS" required error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <FocusInput
                {...field}
                type="email"
                autoFocus
                autoComplete="email"
                placeholder="you@company.com"
                hasError={!!errors.email}
              />
            )}
          />
        </Field>

        {/* Company */}
        <Field label="COMPANY NAME" optional>
          <Controller
            control={control}
            name="companyName"
            render={({ field }) => (
              <FocusInput
                {...field}
                type="text"
                autoComplete="organization"
                placeholder="Your company"
              />
            )}
          />
        </Field>

        {/* Team Size */}
        <Field label="TEAM SIZE" required error={errors.teamSize?.message}>
          <Controller
            control={control}
            name="teamSize"
            render={({ field }) => (
              <SelectField
                {...field}
                options={TEAM_SIZE_OPTIONS}
                placeholder="Select team size"
                hasError={!!errors.teamSize}
              />
            )}
          />
        </Field>

        {/* Use Case */}
        <Field label="MAIN USE CASE" required error={errors.useCase?.message}>
          <Controller
            control={control}
            name="useCase"
            render={({ field }) => (
              <SelectField
                {...field}
                options={USE_CASE_OPTIONS}
                placeholder="Select use case"
                hasError={!!errors.useCase}
              />
            )}
          />
        </Field>

        {/* Reason */}
        <Field label="WHY ARE YOU LOOKING FOR AN AI VISIBILITY TOOL?" required error={errors.reason?.message}>
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <SelectField
                {...field}
                options={REASON_OPTIONS}
                placeholder="Select reason"
                hasError={!!errors.reason}
              />
            )}
          />
        </Field>

        {/* Intent radio cards */}
        <div>
          <FieldLabel label="WHAT WOULD YOU LIKE TO DO?" required />
          <Controller
            control={control}
            name="intent"
            render={({ field }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'reserve', label: 'Reserve my early-access spot' },
                  { value: 'notify',  label: 'Just notify me when AudFlo is available' },
                ].map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        fontFamily: MONO,
                        fontSize: 12,
                        padding: '11px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                        background: selected ? 'rgba(0,230,118,0.05)' : 'var(--bg-deep)',
                        border: selected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: selected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.2)',
                            background: selected ? 'rgba(0,230,118,0.15)' : 'transparent',
                          }}
                        >
                          {selected && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />
                          )}
                        </span>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        {/* Would Pay */}
        <div>
          <FieldLabel label="IF AUDFLO PRO WERE AVAILABLE TODAY AT $15/MONTH, WOULD YOU PAY?" required />
          <Controller
            control={control}
            name="wouldPay"
            render={({ field }) => (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['yes', 'maybe', 'no'] as const).map((opt) => {
                  const selected = field.value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => field.onChange(opt)}
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        padding: '9px 0',
                        borderRadius: 6,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'border-color 0.15s, background 0.15s',
                        background: selected ? 'rgba(0,230,118,0.06)' : 'transparent',
                        border: selected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  );
                })}
              </div>
            )}
          />
          <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.3px' }}>
            Founding members get 50% off, locking in $7.50/month for life.
          </p>
        </div>

        {/* Submit */}
        <SubmitButton isSubmitting={isSubmitting} intent={intentValue} progress={progressPercent} />
      </div>
    </form>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ label, required, optional }: { label: string; required?: boolean; optional?: boolean }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', marginBottom: 8, display: 'flex', gap: 5, alignItems: 'baseline' }}>
      {label}
      {required && <span style={{ color: 'var(--accent)', fontSize: 10 }}>*</span>}
      {optional && <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: 0, textTransform: 'none' }}>(optional)</span>}
    </div>
  );
}

function Field({ label, required, optional, error, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} optional={optional} />
      {children}
      {error && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--danger)', marginTop: 5, letterSpacing: '0.3px' }}>{error}</p>
      )}
    </div>
  );
}

const FocusInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  function FocusInput(props, ref) {
    const { hasError, style: _style, onFocus, onBlur, ...rest } = props;
    return (
      <input
        {...rest}
        ref={ref}
        style={hasError ? fieldError : fieldBase}
        onFocus={(e) => { Object.assign(e.currentTarget.style, fieldFocus); onFocus?.(e); }}
        onBlur={(e) => { Object.assign(e.currentTarget.style, hasError ? fieldError : fieldBase); onBlur?.(e); }}
      />
    );
  }
);

interface SelectFieldProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  options: { value: string; label: string }[];
  placeholder: string;
  hasError: boolean;
}

function SelectField({ value, onChange, onBlur, options, placeholder, hasError }: SelectFieldProps) {
  const style: React.CSSProperties = {
    ...fieldBase,
    appearance: 'none',
    cursor: 'pointer',
    color: value ? 'var(--text-primary)' : 'var(--text-muted)',
    ...(hasError ? { borderColor: 'var(--danger)' } : {}),
  };

  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={style}
        onFocus={(e) => { Object.assign(e.currentTarget.style, { ...style, borderColor: 'var(--accent)', color: 'var(--text-primary)' }); }}
      >
        <option value="" disabled style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={{ pointerEvents: 'none', position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }}>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

function SubmitButton({ isSubmitting, intent, progress }: { isSubmitting: boolean; intent: string; progress: number }) {
  const label = intent === 'notify' ? 'Notify me' : 'Reserve my spot';

  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="sys-btn"
      style={{
        width: '100%',
        justifyContent: 'center',
        borderColor: 'var(--accent)',
        color: 'var(--accent)',
        fontSize: 11,
        letterSpacing: '2px',
        opacity: isSubmitting ? 0.6 : 1,
        padding: '12px 0',
      }}
    >
      {isSubmitting ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="rgba(0,230,118,0.3)" strokeWidth="2" />
            <path d="M8 2a6 6 0 016 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          JOINING WAITLIST...
        </span>
      ) : (
        `[ ${label.toUpperCase()} → ]`
      )}
    </button>
  );
}
