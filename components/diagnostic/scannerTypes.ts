export type Severity = 'CRITICAL' | 'HIGH IMPACT' | 'LOW IMPACT';

export type Category =
  | 'DISCOVERY'
  | 'TRUST'
  | 'CLARITY'
  | 'FLOW'
  | 'DIFFERENTIATION'
  | 'TECH HYGIENE';

export interface AuditIssue {
  id: string;
  category: Category;
  title: string;
  severity: Severity;
  // What AudFlo detects
  what: string;
  location: string;
  // Why it matters — describes what users DO wrong because of this
  why: string;
  // New: pattern explanation ("why this is happening")
  causePattern: string;
  // Estimated loss — always a user-behavior description
  estimatedLoss: string;
  fix: string;
  prompt: string;
}

export interface CategoryScore {
  category: Category;
  score: number; // 0–100
  issueCount: number;
  worstSeverity: Severity | null;
}

// ---------------------------------------------------------------------------
// Entity Classification
// ---------------------------------------------------------------------------

export type EntityClassification =
  | 'ESTABLISHED_ENTITY'
  | 'EARLY_PRODUCT'
  | 'UNVERIFIED';

export interface EntityClass {
  classification: EntityClassification;
  // Short human label for the debug badge
  label: string;
  // One-line reason (internal)
  reason: string;
}

// ---------------------------------------------------------------------------
// Signal layer system
// ---------------------------------------------------------------------------

export type PageSignalState = 'GOOD' | 'WEAK' | 'CRITICAL';
export type EntitySignalState = 'STRONG' | 'WEAK' | 'UNKNOWN';
export type DistributionSignalState = 'PRESENT' | 'LIMITED' | 'UNKNOWN';

export type AiUnderstandingLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EntityClarityLevel = 'WEAK' | 'CLEAR';
export type PageClarityLevel = 'WEAK' | 'CLEAR' | 'CHECKING';
export type ConversionClarityLevel = 'WEAK' | 'CLEAR' | 'CHECKING';
export type PageReadableLevel = 'FULL' | 'LIMITED' | 'BLOCKED';

// Signal rows for the UI — label + value + semantic state
export interface SignalRow {
  label: string;
  value: string;
  state: 'positive' | 'warn' | 'danger' | 'neutral';
}

export interface SignalLayers {
  // Which path was chosen
  entityClass: EntityClass;

  // Layer 1: Page Signals
  page: {
    state: PageSignalState;
    label: string;
  };
  // Layer 2: Entity Authority
  entity: {
    state: EntitySignalState;
    label: string;
  };
  // Layer 3: Distribution
  distribution: {
    state: DistributionSignalState;
    label: string;
  };

  // UI-facing signal check rows (path-specific)
  signalRows: SignalRow[];

  // Root cause / main message
  rootCause: string;
  // Subtext paragraph
  subtext: string;

  // Primary issues section label
  issuesSectionLabel: string;
  // Primary issues (max 3, human-readable, path-appropriate)
  primaryIssues: string[];

  // CTA label
  ctaLabel: string;
  // Secondary CTA (path C only)
  secondaryCtaLabel?: string;

  // What to fix (unlocked full breakdown)
  whatToFix: string[];
  // Do this today
  doToday: string[];
}

// ---------------------------------------------------------------------------
// Raw data from edge function
// ---------------------------------------------------------------------------

export interface ScanRaw {
  url: string;
  finalUrl: string;
  html: string;
  robotsTxt: string | null;
  sitemapXml: string | null;
  faviconExists: boolean;
  manifestJson: string | null;
  error?: string;
}

export interface AuditResult {
  url: string;
  scannedAt: string;
  score: number; // 0–100
  verdict: string;
  whyScore: string;
  primaryFailure: AuditIssue | null;
  // Ordered top 3 issues for "What to fix first"
  topFixes: AuditIssue[];
  issues: AuditIssue[];
  categoryScores: CategoryScore[];
  signalLayers: SignalLayers;
  signals: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string | null;
    h1: string | null;
    h2s: string[];
    hasRobotsTxt: boolean;
    robotsBlocksRoot: boolean;
    hasSitemap: boolean;
    faviconIco: boolean;
    faviconLink: boolean;
    appleTouchIcon: boolean;
    icon192: boolean;
    icon512: boolean;
    hasManifest: boolean;
    structuredDataTypes: string[];
    hasOgTitle: boolean;
    hasOgDescription: boolean;
    hasOgImage: boolean;
    internalLinkCount: number;
    anchorLinkCount: number;
    hasPrivacyLink: boolean;
    hasTermsLink: boolean;
    hasCanonical: boolean;
    hasScreenshots: boolean;
    hasVideo: boolean;
    hasTestimonials: boolean;
    hasFounderSignals: boolean;
    hasPostSignupExplanation: boolean;
    hasPricingMention: boolean;
    hasFeatureBullets: boolean;
    hasCTAAboveFold: boolean;
    ctaBeforeValue: boolean;
    genericAIPattern: boolean;
    headlineWordCount: number;
    bodyWordCount: number;
  };
}
