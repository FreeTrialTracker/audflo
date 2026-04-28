'use client';

export default function AudFloLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <svg width={size + 4} height={size + 4} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2845D4" />
            <stop offset="50%" stopColor="#E8497A" />
            <stop offset="100%" stopColor="#F26B3A" />
          </linearGradient>
        </defs>
        <circle cx="6" cy="14" r="5" stroke="url(#logoGrad)" strokeWidth="2" fill="none" />
        <circle cx="22" cy="14" r="5" stroke="url(#logoGrad)" strokeWidth="2" fill="none" />
        <path d="M11 12 Q14 6 17 12" stroke="url(#logoGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M11 16 Q14 22 17 16" stroke="url(#logoGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-serif font-normal" style={{ fontSize: size }}>AudFlo</span>
    </span>
  );
}
