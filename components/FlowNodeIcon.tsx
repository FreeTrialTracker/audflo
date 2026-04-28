export default function FlowNodeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fnGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2845D4" />
          <stop offset="50%" stopColor="#E8497A" />
          <stop offset="100%" stopColor="#F26B3A" />
        </linearGradient>
      </defs>
      <rect x="1" y="6" width="18" height="10" rx="5" stroke="url(#fnGrad)" strokeWidth="2" fill="none" />
      <rect x="29" y="16" width="18" height="10" rx="5" stroke="url(#fnGrad)" strokeWidth="2" fill="none" />
      <path d="M19 11 Q28 11 29 21" stroke="url(#fnGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
