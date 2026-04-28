import { z } from 'zod';

export const waitlistSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  companyName: z.string().optional(),
  teamSize: z.string().min(1, 'Select your team size'),
  useCase: z.string().min(1, 'Select your main use case'),
  reason: z.string().min(1, 'Select why you need an AI visibility tool'),
  intent: z.enum(['reserve', 'notify']),
  wouldPay: z.enum(['yes', 'maybe', 'no']),
});

export type WaitlistFormData = z.infer<typeof waitlistSchema>;

export const TEAM_SIZE_OPTIONS = [
  { value: 'just-me', label: 'Just me' },
  { value: '2-10', label: '2-10 people' },
  { value: '11-50', label: '11-50 people' },
  { value: '51-200', label: '51-200 people' },
  { value: '201-1000', label: '201-1,000 people' },
  { value: '1000+', label: '1,000+ people' },
];

export const USE_CASE_OPTIONS = [
  { value: 'distribute-to-get-cited', label: 'Distribute content so AI models recommend my product' },
  { value: 'get-first-users', label: 'Get my first real users through AI-driven discovery' },
  { value: 'outrank-competitors', label: 'Show up where competitors are already getting cited' },
  { value: 'fix-visibility-gaps', label: 'Fix the visibility gaps found in my scan' },
  { value: 'build-distribution-plan', label: 'Build a weekly distribution execution plan' },
  { value: 'monitor-ai-signals', label: 'Monitor AI citation and distribution signals over time' },
  { value: 'something-else', label: 'Something else' },
];

export const REASON_OPTIONS = [
  { value: 'invisible-to-ai', label: "My product exists but AI never mentions it" },
  { value: 'no-distribution-plan', label: "I have no system for distributing content that gets cited" },
  { value: 'losing-to-competitors', label: "Competitors get recommended by AI and I don't" },
  { value: 'launched-got-silence', label: "I launched and got silence — AI-driven traffic never came" },
  { value: 'want-full-pack', label: "I want the full 15+ post distribution pack for my product" },
  { value: 'future-proofing', label: "Search is shifting to AI — I want to be positioned now" },
];
