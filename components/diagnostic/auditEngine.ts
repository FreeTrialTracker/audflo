import type { AuditIssue, AuditResult, CategoryScore, ScanRaw, Severity, Category, SignalLayers, SignalRow, PageSignalState, EntitySignalState, DistributionSignalState, EntityClassification, EntityClass } from './scannerTypes';

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

function getTag(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

function getMeta(html: string, name: string): string | null {
  const p1 = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i');
  return (html.match(p1) ?? html.match(p2))?.[1]?.trim() ?? null;
}

function getMetaProperty(html: string, prop: string): string | null {
  const p1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i');
  return (html.match(p1) ?? html.match(p2))?.[1]?.trim() ?? null;
}

function getLinkRel(html: string, rel: string): string | null {
  return html.match(new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*>`, 'i'))?.[0] ?? null;
}

function getAllH2s(html: string): string[] {
  return Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi))
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
}

function getAllAnchors(html: string): string[] {
  return Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)).map(m => m[1]);
}

function getJsonLdTypes(html: string): string[] {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const types: string[] = [];
  for (const s of scripts) {
    try {
      const data = JSON.parse(s[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type']) {
          const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          types.push(...t);
        }
      }
    } catch { /* malformed JSON-LD */ }
  }
  return Array.from(new Set(types));
}

function getBodyText(html: string): string {
  const body = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasIconSize(html: string, size: string): boolean {
  return new RegExp(`sizes=["'][^"']*${size}[^"']*["']`, 'i').test(html);
}

// ---------------------------------------------------------------------------
// Issue factory
// ---------------------------------------------------------------------------

let issueSeq = 0;
function makeIssue(partial: Omit<AuditIssue, 'id'>): AuditIssue {
  return { id: `issue-${++issueSeq}`, ...partial };
}

// ---------------------------------------------------------------------------
// CATEGORY 1: DISCOVERY
// ---------------------------------------------------------------------------

function checkDiscovery(
  html: string,
  title: string | null,
  description: string | null,
  robotsMeta: string | null,
  robotsTxt: string | null,
  sitemapXml: string | null,
  anchors: string[],
  jsonLdTypes: string[],
  faviconExists: boolean,
  manifestJson: string | null,
  h1: string | null,
  bodyText: string,
  baseUrl: string,
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Noindex
  if (robotsMeta?.toLowerCase().includes('noindex')) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'You are completely invisible to search engines',
      severity: 'CRITICAL',
      what: `A meta robots tag is set to "${robotsMeta}". Every search engine and AI crawler is told to exclude this page.`,
      location: 'Found in the <head> section.',
      why: 'Users who search for what you do will never find you. The only people who reach your site are the ones who already have your URL.',
      causePattern: 'This is almost always a development-environment setting ("noindex staging") that was accidentally deployed to production. It happens when deployment configs are copied without review.',
      estimatedLoss: 'Every user who could have found you through search never discovers you. You are invisible to anyone who does not already know you exist.',
      fix: 'Remove the noindex directive immediately. Check your Next.js or Vercel config — staging environment settings are the most common culprit.',
      prompt: `My page has a meta robots tag: "${robotsMeta}"\n\nWhich Next.js or Vercel config files could be setting noindex on production accidentally? Give me the exact files to check and what to change.`,
    }));
  }

  // Robots.txt blocking
  let robotsBlocksRoot = false;
  if (robotsTxt) {
    const lines = robotsTxt.toLowerCase().split('\n');
    let inAll = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('user-agent:')) inAll = t.includes('*');
      if (inAll && (t === 'disallow: /' || t.startsWith('disallow: / '))) {
        robotsBlocksRoot = true; break;
      }
    }
  }

  if (robotsBlocksRoot) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Your entire site is blocked from being indexed',
      severity: 'CRITICAL',
      what: `robots.txt contains "Disallow: /" for all crawlers. No search engine can index a single page.`,
      location: `${baseUrl}/robots.txt`,
      why: 'Users searching for your product category will never encounter your site. You are competing with zero organic presence.',
      causePattern: 'This is a classic copy-paste from a development or staging setup. The robots.txt was created with a full block to prevent staging from being indexed, then deployed to production without being changed.',
      estimatedLoss: 'Every user who could have found you through search is sent to a competitor instead. You are invisible to every search engine and AI discovery system.',
      fix: 'Change "Disallow: /" to "Allow: /" and redeploy immediately. Submit your sitemap to Google Search Console the same day.',
      prompt: `My robots.txt blocks all crawlers:\n\n${(robotsTxt ?? '').slice(0, 400)}\n\nRewrite it to allow all public pages while blocking /api/ and /admin/. Output as plain text ready to deploy.`,
    }));
  } else if (!robotsTxt) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Crawlers have no guidance on your site structure',
      severity: 'LOW IMPACT',
      what: `No robots.txt found at ${baseUrl}/robots.txt.`,
      location: `Expected at: ${baseUrl}/robots.txt`,
      why: 'Crawlers look here for your sitemap. Without it, sitemap discovery is slower and new pages take longer to get indexed.',
      causePattern: 'robots.txt is typically absent on newly launched sites or projects bootstrapped from templates that do not include one by default.',
      estimatedLoss: 'New pages you publish take longer to be discovered. Users searching for them may not find them for days or weeks.',
      fix: 'Create robots.txt with "User-agent: * Allow: /" and a Sitemap: reference.',
      prompt: `Generate a robots.txt for ${baseUrl}. Allow all crawlers, reference sitemap.xml, block /api/ and /admin/. Plain text, ready to deploy.`,
    }));
  }

  // Missing title
  if (!title) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Your page has no identity in search results',
      severity: 'CRITICAL',
      what: 'No <title> tag found. The page shows as "Untitled" in every search result.',
      location: 'Missing from <head>.',
      why: 'Users scanning search results skip "Untitled" entries. Without a title, your page cannot rank for any query.',
      causePattern: 'Missing titles typically happen when pages are built as client-only React apps where the title is set via JavaScript rather than rendered in the HTML. Search engines see the empty state.',
      estimatedLoss: 'Users comparing search results scroll past your page without reading it. You get impressions but zero clicks.',
      fix: 'Add a <title> under 70 characters: product name + what it does + who it is for.',
      prompt: `My page is missing a title tag. My product: [describe in one sentence].\n\nWrite 3 title options (under 70 characters each) that name the product, state the use case, and name the target user. No buzzwords.`,
    }));
  } else if (title.length > 70) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Your title is cut off — users miss the key information',
      severity: 'LOW IMPACT',
      what: `Title: "${title}" — ${title.length} characters. Google truncates at ~70. The end of your message is invisible.`,
      location: '<title> tag in <head>.',
      why: 'If your differentiation or target user appears after character 70, no one searching is reading it.',
      causePattern: 'Long titles usually happen when the product name and tagline are both included without editing for length.',
      estimatedLoss: 'Users see a cut-off headline and have less context for whether to click. Click-through rate drops.',
      fix: 'Shorten to under 65 characters. Front-load the most important information.',
      prompt: `My title is too long (${title.length} chars): "${title}"\nRewrite under 65 characters. Keep: product name, primary value. Cut: filler, repetition.`,
    }));
  }

  // Missing description
  if (!description) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Google writes your pitch — and it will choose the worst excerpt',
      severity: 'HIGH IMPACT',
      what: 'No meta description found. Search engines auto-generate a snippet from your page content.',
      location: 'Missing from <head>.',
      why: 'Auto-generated descriptions usually pull navigation text or the first sentence of boilerplate. Users see a confusing snippet and choose a competitor with a clearer description.',
      causePattern: 'Meta descriptions are skipped in frameworks where metadata is not explicitly configured — especially in early-stage products where SEO is deprioritized.',
      estimatedLoss: 'Users comparing results pick the listing with the clearest description. Yours reads like random page content and they skip it.',
      fix: 'Add a 120–155 character description: what the product does, who it is for, one specific benefit.',
      prompt: `My page is missing a meta description. Write 3 options (120–155 chars each):\n1. State what the product does\n2. Name who it is for\n3. Include one specific benefit\nDo not start with the company name.`,
    }));
  }

  // OG tags
  const hasOgTitle = !!getMetaProperty(html, 'og:title');
  const hasOgDescription = !!getMetaProperty(html, 'og:description');
  const hasOgImage = !!getMetaProperty(html, 'og:image');
  if (!hasOgTitle || !hasOgDescription || !hasOgImage) {
    const missing = [
      !hasOgTitle && 'og:title',
      !hasOgDescription && 'og:description',
      !hasOgImage && 'og:image',
    ].filter(Boolean).join(', ');
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Every link share of your product looks broken',
      severity: 'HIGH IMPACT',
      what: `Missing OG tags: ${missing}. These control the preview when your link is shared.`,
      location: 'Missing from <head>.',
      why: 'When someone shares your link, the platform generates its own preview — usually a blank image and garbled text. Viewers assume the link is broken or unprofessional.',
      causePattern: 'OG tags are missing on sites built without a metadata template or where the meta config was not propagated to all page types.',
      estimatedLoss: 'Users who receive a shared link see a broken preview and do not click. Every share of your product underperforms.',
      fix: `Add: ${missing}. For og:image, use a 1200×630px image with your product name visible.`,
      prompt: `My page is missing: ${missing}.\nWrite the exact HTML meta tags for my <head>. My title: [paste]. My product: [describe].\nFormat as ready-to-paste HTML.`,
    }));
  }

  // Structured data
  if (jsonLdTypes.length === 0) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'AI search engines cannot categorize or cite your product',
      severity: 'HIGH IMPACT',
      what: 'No JSON-LD structured data found.',
      location: 'Missing from <head> or <body>.',
      why: 'AI systems like Perplexity, ChatGPT, and Google SGE use structured data to understand what your product is and when to recommend it. Without it, they cannot accurately categorize or cite you.',
      causePattern: 'Structured data is almost never added in early product development. It is deprioritized until the product is more stable, by which point it is usually forgotten.',
      estimatedLoss: 'Users asking AI assistants about tools in your category never see your product recommended. You are not in the AI-driven discovery layer at all.',
      fix: 'Add JSON-LD for Organization and WebSite. Add SoftwareApplication if you are a software product.',
      prompt: `My page has no JSON-LD structured data.\nMy product: [describe]. Company: [name]. Site: [url].\nWrite complete <script type="application/ld+json"> tags for: Organization, WebSite, and SoftwareApplication.`,
    }));
  }

  // Missing H1
  if (!h1) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Search engines cannot determine the topic of your page',
      severity: 'HIGH IMPACT',
      what: 'No <h1> tag found.',
      location: 'Visible body content.',
      why: 'The H1 is the primary topical signal. Without it, crawlers assign your page a lower topic confidence score, which directly suppresses rankings.',
      causePattern: 'H1 is missing when visual styling replaces semantic structure — the text looks like a heading but uses a <div> or <p> tag styled with CSS instead of an actual <h1>.',
      estimatedLoss: 'Users searching for your category rank your competitors above you because their pages have clearer topical signals. You rank lower across the board.',
      fix: 'Add one <h1> that names what the product is and who it is for.',
      prompt: `My page is missing an H1. Title: "${title ?? '[none]'}". Product: [describe].\nWrite 3 H1 options (6–12 words each) that define the product and name the target user.`,
    }));
  }

  // Thin content / SPA
  if (bodyText.length < 200) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'Most crawlers see a blank page when they visit',
      severity: 'CRITICAL',
      what: `Only ${bodyText.length} characters of visible text in the HTML before JavaScript runs.`,
      location: 'Body content as seen without JavaScript.',
      why: 'AI discovery systems and most SEO crawlers do not execute JavaScript. They see an empty page and do not index your content.',
      causePattern: 'This happens when the entire page is built as a client-rendered React app — all content is injected by JavaScript after load. The HTML file itself contains only a loading shell.',
      estimatedLoss: 'Users searching for your product category find your competitors instead. Your page exists but its content is invisible to the systems that would surface it.',
      fix: 'Implement server-side rendering for above-the-fold content. In Next.js, move content into server components.',
      prompt: `My page has almost no HTML before JS runs. Framework: [name].\nWhat is the fastest change to make my headline, description, and CTA part of the initial HTML response?`,
    }));
  }

  // Sitemap
  if (!sitemapXml) {
    issues.push(makeIssue({
      category: 'DISCOVERY',
      title: 'New pages you publish may never be indexed',
      severity: 'LOW IMPACT',
      what: `No sitemap.xml found at ${baseUrl}/sitemap.xml.`,
      location: `Expected at: ${baseUrl}/sitemap.xml`,
      why: 'Without a sitemap, crawlers only find pages by following links. Pages not linked from your homepage may never be discovered.',
      causePattern: 'Sitemaps are rarely generated automatically in framework defaults. They require explicit setup and are usually added later in the launch cycle.',
      estimatedLoss: 'Users searching for content on specific pages you have published cannot find them in search results.',
      fix: 'Generate a sitemap.xml. In Next.js 13+, create app/sitemap.ts. Submit it to Google Search Console.',
      prompt: `My site at ${baseUrl} has no sitemap.xml. I'm using: [framework]. My main pages: [list].\nWrite the code to generate a dynamic sitemap with lastModified dates.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CATEGORY 2: TRUST
// ---------------------------------------------------------------------------

function checkTrust(html: string, bodyText: string, anchors: string[], baseUrl: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const bodyLower = bodyText.toLowerCase();

  // No product proof
  const hasScreenshots = ['screenshot', 'preview', 'demo', 'example', 'output', 'result', 'see how', 'watch', 'gif', 'before', 'after']
    .some(t => bodyLower.includes(t)) || /\.(png|jpg|jpeg|gif|webp|mp4|mov)/i.test(html);

  if (!hasScreenshots) {
    issues.push(makeIssue({
      category: 'TRUST',
      title: 'Users are asked to commit before seeing anything real',
      severity: 'CRITICAL',
      what: 'The page shows no screenshots, demo output, or product results. Visitors cannot see what the product actually produces.',
      location: 'Above the fold and in the product section.',
      why: 'Every AI tool launched in the last two years asks for signups. Users have learned to evaluate before committing. A page that describes without showing gets dismissed as unproven.',
      causePattern: 'This is a pattern of AI-built landing pages: the builder focused on writing about features rather than showing them. The result is a page that sounds confident but shows nothing.',
      estimatedLoss: 'Users land, read the description, cannot verify if it is real, and leave to find a tool with a demo or screenshot. You lose them at the evaluation step.',
      fix: 'Add one real screenshot or input → output example before the primary CTA. It does not need to be polished — it needs to be real.',
      prompt: `My page shows no product output. My product: [describe].\nWrite the copy for a "See it in action" section:\n1. Shows a specific input → output example\n2. Max 4 sentences\n3. Sits above the CTA\nAlso: what one screenshot or visual would make this most convincing?`,
    }));
  }

  // No testimonials
  const hasTestimonials = ['testimonial', 'review', 'said', '"', '\u201c', 'customer', 'client', 'used by', 'helped us', 'love', 'game changer']
    .some(t => bodyLower.includes(t));

  if (!hasTestimonials) {
    issues.push(makeIssue({
      category: 'TRUST',
      title: 'There is no evidence anyone has used this and not regretted it',
      severity: 'HIGH IMPACT',
      what: 'No testimonials, customer quotes, or named social proof detected.',
      location: 'No evidence of real users near the primary CTA.',
      why: 'The question users ask before signing up is not "is this interesting?" — it is "has someone like me already done this?" Without an answer, hesitation wins.',
      causePattern: 'Early-stage products skip testimonials because they feel they do not have enough users yet. This is the wrong order — even one real user quote converts better than none.',
      estimatedLoss: 'Users who reached your CTA pause, look for social proof, find none, and decide to come back later. Most never come back.',
      fix: 'Place one named testimonial within 100px of your CTA. Full name, company, specific outcome. A user count ("214 teams in early access") also works if you have nothing yet.',
      prompt: `My page has no testimonials. What I have: [user count / testimonials / outcomes / nothing]\nCTA copy: "[paste]"\nFor each: write the exact display copy (max 30 words) and where to place it.\nIf nothing: write the exact message to send to 3 early users to collect a quote this week.`,
    }));
  }

  // No post-signup explanation
  const hasPostSignup = ['what happens', 'next step', 'step 1', "you'll", 'you will', "we'll send", 'onboarding', 'first,']
    .some(t => bodyLower.includes(t));

  if (!hasPostSignup) {
    issues.push(makeIssue({
      category: 'TRUST',
      title: 'Users hesitate because they cannot see what happens after signup',
      severity: 'HIGH IMPACT',
      what: 'The page asks for signup without explaining what the user receives or experiences next.',
      location: 'Near the signup CTA.',
      why: 'The moment before signup is maximum uncertainty. Users imagine spam, a paywall, or an empty dashboard. Without a concrete "here is what happens next," that imagination wins.',
      causePattern: 'Most landing pages focus entirely on the value proposition and assume the post-signup experience will close the deal. Users do not share that assumption.',
      estimatedLoss: 'Users who were ready to sign up hesitate at the final step, close the tab, and tell themselves they will come back. Most do not.',
      fix: 'Add 2–3 steps directly below the CTA: what they see first, what they can do in 2 minutes, what result they reach. Specificity removes hesitation.',
      prompt: `My page doesn't explain what happens after signup.\nMy product: [describe]. First 2 minutes after signup: [describe].\nWrite a "Here is what happens next" section (3 steps, 1 sentence each) to place below the CTA.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CATEGORY 3: CLARITY
// ---------------------------------------------------------------------------

function checkClarity(
  html: string,
  title: string | null,
  h1: string | null,
  h2s: string[],
  bodyText: string,
  description: string | null,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const bodyLower = bodyText.toLowerCase();

  // Vague headline
  const vagueTerms = ['welcome', 'hello', 'home', 'untitled', 'the future', 'next generation', 'next-gen', 'smarter', 'easier', 'powerful', 'transforming', 'reimagine', 'reimagined'];
  const h1IsVague = h1 && (vagueTerms.some(t => h1.toLowerCase().includes(t)) || h1.split(' ').length < 3);

  if (!h1 || h1IsVague) {
    issues.push(makeIssue({
      category: 'CLARITY',
      title: 'Visitors leave in the first 5 seconds because they cannot place your product',
      severity: 'CRITICAL',
      what: h1 ? `H1: "${h1}" — abstract language with no specific user, workflow, or outcome stated.` : 'No H1 found.',
      location: 'The primary heading — the first thing users read.',
      why: 'You have 4 seconds before a new visitor decides to stay or leave. A headline like "Smarter workflows" requires cognitive effort to interpret. Users in evaluation mode do not invest that effort — they leave.',
      causePattern: 'This is the default output of AI-assisted copywriting: abstract benefit language that sounds compelling but says nothing specific. "The future of X" and "smarter Y" are the most common patterns.',
      estimatedLoss: 'Users who land from ads, social, or search read the headline, cannot immediately place the product in their mental model, and bounce back to wherever they came from.',
      fix: h1
        ? `Replace "${h1}" with: [WHO] + [PAINFUL TASK] + [MEASURABLE OUTCOME]. Under 12 words. No abstract adjectives.`
        : 'Add an H1 with: [WHO] + [PAINFUL TASK] + [MEASURABLE OUTCOME]. Under 12 words.',
      prompt: `My current H1: "${h1 ?? '[missing]'}" — too vague.\nRewrite using: [WHO] + [PAINFUL TASK] + [MEASURABLE OUTCOME]. Max 12 words. No: "powerful", "smarter", "better", "next-gen", "seamless". Output 3 variants with a one-sentence rationale for each.`,
    }));
  }

  // No target user named
  const userTerms = ['for ', 'teams', 'founders', 'developers', 'designers', 'marketers', 'agencies', 'startups', 'freelancer', 'enterprise', 'sales', 'if you', 'you are'];
  if (!userTerms.some(t => bodyLower.includes(t))) {
    issues.push(makeIssue({
      category: 'CLARITY',
      title: 'Visitors cannot tell if this product is meant for them',
      severity: 'CRITICAL',
      what: 'The page does not name a specific user type, role, or persona. It appears to be for everyone.',
      location: 'Hero section and above-the-fold content.',
      why: 'A product for everyone converts like a product for no one. Users self-select — they need to see themselves named before they invest attention.',
      causePattern: 'Founders avoid naming a specific user to keep the addressable market broad. The result is messaging that resonates with no one strongly enough to act.',
      estimatedLoss: 'Qualified visitors who are exactly your target user read the page, do not see themselves, assume it is for someone else, and leave without signing up.',
      fix: 'Add one sentence naming your primary user explicitly: "Built for [specific persona] who [specific situation]."',
      prompt: `My page doesn't define who it's for. My actual target user: [describe].\nWrite 3 hero sub-headline options (under 15 words each) that name this user type and reference their specific situation. Make them feel immediately recognized.`,
    }));
  }

  // No outcome stated
  const outcomeTerms = ['save', 'reduce', 'increase', 'faster', 'minutes', 'hours', 'revenue', 'cost', 'automate', 'eliminate', 'so you can', 'in seconds', 'in minutes', '%'];
  if (!outcomeTerms.some(t => bodyLower.includes(t))) {
    issues.push(makeIssue({
      category: 'CLARITY',
      title: 'The page describes features but gives users no reason to act now',
      severity: 'HIGH IMPACT',
      what: 'No measurable outcome stated. No time savings, cost reductions, or specific improvements communicated.',
      location: 'Hero section and value proposition area.',
      why: 'Features tell users what the product can do. Outcomes tell them what their life looks like after using it. Without an outcome, there is no urgency and no clear reason to try it today.',
      causePattern: 'Feature-first copy is the default when builders write about what they built rather than what users achieve. It reads as a product spec, not a promise.',
      estimatedLoss: 'Users who were interested but not yet convinced need a specific result to tip them into action. Without one, they bookmark the page and never return.',
      fix: 'Add one outcome statement above the fold with a specific metric: time, percentage, tasks eliminated. "Save time" does not count.',
      prompt: `My page states no measurable outcomes. My product: [describe]. Real results users get: [describe].\nWrite 3 outcome statements (under 12 words each). Each must include a specific metric or measurable result.`,
    }));
  }

  // No pricing clarity
  const pricingTerms = ['pricing', 'free', 'per month', '/mo', 'trial', 'credit card', 'no cost'];
  if (!pricingTerms.some(t => bodyLower.includes(t)) && bodyText.length > 200) {
    issues.push(makeIssue({
      category: 'CLARITY',
      title: 'Users hesitate at signup because they expect to be charged',
      severity: 'HIGH IMPACT',
      what: 'No pricing information, "free to start," or commitment level stated anywhere on the page.',
      location: 'CTA area and page body.',
      why: 'When commitment level is unclear, users assume there is a cost they have not found yet. This specific anxiety causes hesitation at the signup step.',
      causePattern: 'Pricing clarity is skipped on early-stage products where the model is still being decided, or on waitlist pages where the instinct is to defer the pricing conversation.',
      estimatedLoss: 'Users who were ready to sign up pause at the email field, wonder if they will be charged, and close the tab.',
      fix: 'Add "Free to start" or "No credit card required" next to the CTA. If there is paid pricing, link to a pricing page.',
      prompt: `My page has no pricing information. My model: [free / freemium / paid / waitlist].\nWrite a 5-word pricing clarity note for next to the CTA that removes commitment anxiety.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CATEGORY 4: FLOW
// ---------------------------------------------------------------------------

function checkFlow(html: string, bodyText: string, anchors: string[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const bodyLower = bodyText.toLowerCase();

  const ctaTerms = ['sign up', 'get started', 'get access', 'join', 'create account', 'try free', 'start free'];
  const valueTerms = ['how it works', 'see how', 'example', 'demo', 'screenshot', 'output', 'result', 'watch', 'in action'];
  const hasCta = ctaTerms.some(t => bodyLower.includes(t));
  const hasValueSection = valueTerms.some(t => bodyLower.includes(t));

  if (hasCta && !hasValueSection) {
    issues.push(makeIssue({
      category: 'FLOW',
      title: 'Asking for commitment before delivering value causes drop-off',
      severity: 'CRITICAL',
      what: 'The page asks users to sign up before demonstrating what they get. No "how it works," demo, or example output precedes the CTA.',
      location: 'Page structure — CTA appears without a preceding value demonstration.',
      why: 'Users have a trust sequence: understand → believe → act. Skipping to "act" before "understand" breaks the sequence. Users leave to find a product that shows them something first.',
      causePattern: 'This is the most common pattern on AI-built landing pages: hero → CTA → features. The builder optimized for getting signups fast rather than building trust first. It works for a few days and then conversion drops as the early hype fades.',
      estimatedLoss: 'Users who were genuinely interested leave to find a product with a demo or example. You convert the committed minority and lose the persuadable majority.',
      fix: 'Move the CTA below a "How it works" or "See what you get" section. One concrete example of product output before you ask for anything.',
      prompt: `My page asks for signup before showing value. My product: [describe].\nDesign a "See what you get" section (3 steps or 1 example output) that should appear above the CTA. Keep it under 80 words.`,
    }));
  }

  // No next-step explanation
  const nextStepTerms = ['here is what', 'step 1', "you'll", 'you will', 'we will', 'after you', 'then you', 'first,'];
  if (!nextStepTerms.some(t => bodyLower.includes(t)) && hasCta) {
    issues.push(makeIssue({
      category: 'FLOW',
      title: 'The moment after clicking is undefined — users hesitate',
      severity: 'HIGH IMPACT',
      what: 'The page has a CTA but no explanation of what the user sees or experiences after clicking.',
      location: 'Directly adjacent to the primary CTA.',
      why: 'Clicking a CTA is a commitment. Users make that commitment more readily when they can see exactly what follows. Undefined next steps create anxiety at the last moment.',
      causePattern: 'CTAs are built to convert, but the post-click experience is treated as the product\'s job to handle. The gap between CTA and first value moment is left unaddressed on the landing page.',
      estimatedLoss: 'Users who were about to sign up pause at the button, imagine an empty dashboard or a sales call, and decide to wait. Most do not come back.',
      fix: 'Add 2–3 steps below the CTA: what they see immediately, what they can do in 2 minutes, what result they reach.',
      prompt: `My CTA has no "what happens next" explanation. My onboarding first 3 steps: [describe].\nWrite "Here is what happens next" (3 steps, 1 sentence each) for below the CTA. Each step should feel achievable in 5 minutes.`,
    }));
  }

  // Multiple CTAs
  const ctaCount = (bodyLower.match(/sign up|get started|get access|try free|join waitlist|create account|start free/g) ?? []).length;
  if (ctaCount >= 3) {
    issues.push(makeIssue({
      category: 'FLOW',
      title: 'Too many actions create paralysis — users take none of them',
      severity: 'HIGH IMPACT',
      what: `Detected ${ctaCount} CTA phrases on the page. Multiple equal-weight actions compete for attention.`,
      location: 'Throughout the page body.',
      why: 'When users face multiple options with similar visual weight, the cognitive cost of deciding which to take often results in choosing none.',
      causePattern: 'Multiple CTAs accumulate over time as new sections are added. Each section gets its own CTA because "more touchpoints = more conversions" — which is false when the CTAs dilute each other.',
      estimatedLoss: 'Users scroll through multiple CTA options, feel uncertain about which one to use, and close the page without acting on any of them.',
      fix: 'One primary CTA per section. Every other action should be visually smaller and less prominent.',
      prompt: `My page has ${ctaCount} CTAs. Primary goal: [describe]. Secondary goals: [list].\nRedesign the CTA hierarchy: 1 primary action (copy + destination) and how to handle secondary actions without competing with it.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CATEGORY 5: DIFFERENTIATION
// ---------------------------------------------------------------------------

function checkDifferentiation(
  html: string,
  title: string | null,
  h1: string | null,
  bodyText: string,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const bodyLower = bodyText.toLowerCase();

  // Check signals for low-impact escape
  const userTerms = ['for ', 'teams', 'founders', 'developers', 'designers', 'marketers', 'startups', 'freelancer'];
  const outcomeTerms = ['save', 'reduce', 'increase', 'faster', 'minutes', 'hours', 'automate', 'eliminate', '%'];
  const useCaseTerms = ['instead of', 'no more', 'without', 'when you', 'every time', 'workflow', 'replaces'];
  const genericTerms = ['ai-powered', 'powered by ai', 'intelligent', 'smart ', 'cutting-edge', 'state-of-the-art', 'revolutionary', 'innovative', 'game-changing', 'transform your', 'supercharge', 'unlock the power', 'next-generation', 'future of'];
  const differentiatorTerms = ['unlike', 'instead of', 'compared to', 'vs ', 'the only', 'different because', 'no other'];

  const hasTargetUser = userTerms.some(t => bodyLower.includes(t));
  const hasOutcome = outcomeTerms.some(t => bodyLower.includes(t));
  const hasUseCase = useCaseTerms.some(t => bodyLower.includes(t));
  const genericCount = genericTerms.filter(t => bodyLower.includes(t)).length;
  const hasDifferentiator = differentiatorTerms.some(t => bodyLower.includes(t));
  const isNonGeneric = genericCount < 2;

  // Only mark LOW IMPACT if ALL four signals are present
  const isWellDifferentiated = hasTargetUser && hasOutcome && hasUseCase && isNonGeneric;

  if (!isWellDifferentiated) {
    // Determine severity: CRITICAL if generic + no differentiator, else HIGH IMPACT
    const severity: Severity = (genericCount >= 2 && !hasDifferentiator) ? 'CRITICAL' : 'HIGH IMPACT';
    const genericFound = genericTerms.filter(t => bodyLower.includes(t));

    issues.push(makeIssue({
      category: 'DIFFERENTIATION',
      title: 'You look interchangeable with every other AI tool',
      severity,
      what: genericFound.length > 0
        ? `Page copy uses ${genericFound.length} generic AI-SaaS phrases: "${genericFound.slice(0, 3).join('", "')}". No clear differentiation from alternatives.`
        : 'The page does not define a specific use case, target user, or outcome that distinguishes this from alternatives.',
      location: 'Hero section and product description.',
      why: 'Users evaluating AI tools compare multiple options in the same session. If your page looks like every other AI tool — vague benefits, feature bullets, early CTA — they cannot tell why to choose you. The default is to go with whatever they already know.',
      causePattern: 'This is the standard output of an AI-generated landing page: generic benefit language, feature list, signup CTA. It was the fastest way to launch. It is now the most common pattern and therefore the least differentiated.',
      estimatedLoss: 'Users who evaluated your product alongside two competitors chose the one that showed a specific workflow or result. You lost on differentiation, not on product quality.',
      fix: hasDifferentiator
        ? 'Remove generic AI adjectives. Replace with the specific workflow, the specific user, and the specific result. One concrete example outperforms ten vague benefits.'
        : 'Add one sentence naming the alternative users currently use and explaining why this is better: "Unlike [X], this does [specific thing] without [specific friction]."',
      prompt: genericFound.length > 0
        ? `My page uses: "${genericFound.slice(0, 4).join('", "')}". My product actually does: [specific thing].\nRewrite the hero without any of those terms. Focus on: specific task handled, specific user, specific result. Max 3 sentences.`
        : `My page has no differentiation statement. Main alternative users currently use: [tool]. My specific advantage: [describe].\nWrite 3 "Unlike [X], [product] [specific advantage]" one-liners (under 15 words each). Make each comparison honest and specific.`,
    }));
  }

  // FAQ / objection handling
  const faqTerms = ['faq', 'question', 'how does', 'is it', 'can i', 'will it', 'what if', 'do i need'];
  if (!faqTerms.some(t => bodyLower.includes(t)) && bodyText.length > 300) {
    issues.push(makeIssue({
      category: 'DIFFERENTIATION',
      title: 'Unanswered objections are silently blocking conversions',
      severity: 'HIGH IMPACT',
      what: 'No FAQ or objection-handling section detected.',
      location: 'Lower body of the page.',
      why: 'Users who are not yet convinced have specific objections: "Is this secure?", "Do I need technical skills?", "What if it does not work?". Without answers, these objections win by default.',
      causePattern: 'FAQ sections are deprioritized because they feel like support content rather than marketing content. The connection between objection-handling and conversion rate is underestimated.',
      estimatedLoss: 'Users who were close to converting had one specific question. They could not find the answer, assumed the worst, and left.',
      fix: 'Add 3–5 FAQ items: how it works, skill requirements, data security, cancellation. Place them below the main CTA.',
      prompt: `My page has no FAQ. My product: [describe]. Common objections: [list].\nWrite 5 FAQ items with answers (under 50 words each). Format as Q&A pairs ready to add to the page.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CATEGORY 6: TECH HYGIENE
// ---------------------------------------------------------------------------

function checkTechHygiene(
  html: string,
  anchors: string[],
  canonical: string | null,
  title: string | null,
  baseUrl: string,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const anchorsLower = anchors.map(a => a.toLowerCase());

  if (!anchorsLower.some(a => a.includes('privacy') || a.includes('datenschutz'))) {
    issues.push(makeIssue({
      category: 'TECH HYGIENE',
      title: 'No privacy page increases legal exposure and drops trust at signup',
      severity: 'HIGH IMPACT',
      what: 'No link to a privacy policy page detected.',
      location: 'Footer and signup form area.',
      why: 'EU visitors are legally required to have access to a privacy policy before submitting data. Users who look for a privacy policy and cannot find one assume the worst about how their email will be used.',
      causePattern: 'Privacy pages are skipped during early-stage builds because they feel like legal overhead. They are added "later" and often never are.',
      estimatedLoss: 'Privacy-conscious users — who are disproportionately your most technical and qualified audience — see no privacy link, assume data misuse, and do not sign up.',
      fix: 'Create /privacy with a basic policy. Link it in the footer and near the signup form.',
      prompt: `I need a privacy policy for ${baseUrl}. I collect: [email / usage data / payment info].\nWrite a basic policy covering: what I collect, why, retention, user rights, contact. Plain language.`,
    }));
  }

  if (!anchorsLower.some(a => a.includes('terms') || a.includes('tos') || a.includes('conditions'))) {
    issues.push(makeIssue({
      category: 'TECH HYGIENE',
      title: 'No terms page signals the product is not business-ready',
      severity: 'LOW IMPACT',
      what: 'No link to /terms or terms of service detected.',
      location: 'Footer area.',
      why: 'Professional and enterprise users check for terms before adopting any tool for work. Absence signals either early stage or legal carelessness.',
      causePattern: 'Terms pages are deferred during early product development for the same reason as privacy pages — they feel like later-stage concerns.',
      estimatedLoss: 'Professional users who were considering this for team use see no terms page, decide the product is too early-stage, and move on.',
      fix: 'Create /terms with basic terms. Link in footer.',
      prompt: `I need basic terms of service for ${baseUrl}. My product: [describe].\nCover: acceptable use, account termination, liability limitations, IP ownership. Plain language.`,
    }));
  }

  if (!canonical) {
    issues.push(makeIssue({
      category: 'TECH HYGIENE',
      title: 'URL variants are splitting your search ranking authority',
      severity: 'LOW IMPACT',
      what: 'No canonical link tag found.',
      location: '<head> section.',
      why: 'Without a canonical, if your page is accessible at multiple URLs (www vs non-www, trailing slash variants), search engines split your ranking signals across them.',
      causePattern: 'Canonical tags are rarely added in the initial build. They become a problem when the site is accessible at multiple URL variants — which is true for most deployments.',
      estimatedLoss: 'Your ranking signals are diluted across URL variants. You rank lower than you should because your authority is split.',
      fix: `Add <link rel="canonical" href="${baseUrl}/" /> to your <head>.`,
      prompt: `My page is missing a canonical tag. My canonical URL: ${baseUrl}\nWrite the HTML <link> tag and the Next.js 13+ metadata config to set this.`,
    }));
  }

  const suspiciousAnchors = anchors.filter(a =>
    a === '#' || a === 'javascript:void(0)' || a === 'javascript:;' || a === '' || a === '#!'
  );
  if (suspiciousAnchors.length >= 2) {
    issues.push(makeIssue({
      category: 'TECH HYGIENE',
      title: 'Placeholder links make the product look unfinished',
      severity: 'LOW IMPACT',
      what: `Found ${suspiciousAnchors.length} placeholder links: ${suspiciousAnchors.slice(0, 3).join(', ')}.`,
      location: 'Navigation and body.',
      why: 'Users who click a link that goes nowhere register the product as unfinished. First impressions are formed in seconds.',
      causePattern: 'Placeholder links are added during development ("we will fill this in later") and then shipped as-is. They are invisible to the builder but immediately visible to users.',
      estimatedLoss: 'Users who click a broken link form an immediate negative impression that colors their evaluation of everything else on the page.',
      fix: 'Replace all "#" and "javascript:void(0)" links with real destinations, or remove them.',
      prompt: `My page has ${suspiciousAnchors.length} placeholder links.\nFor each: should it go to a real page, be removed, or trigger a specific action? Give me the replacement for each.`,
    }));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const CATEGORIES_LIST: Category[] = ['DISCOVERY', 'TRUST', 'CLARITY', 'FLOW', 'DIFFERENTIATION', 'TECH HYGIENE'];

function severityWeight(s: Severity): number {
  if (s === 'CRITICAL') return 25;
  if (s === 'HIGH IMPACT') return 12;
  return 5;
}

function buildCategoryScores(issues: AuditIssue[]): CategoryScore[] {
  return CATEGORIES_LIST.map(cat => {
    const catIssues = issues.filter(i => i.category === cat);
    const deductions = catIssues.reduce((sum, i) => sum + severityWeight(i.severity), 0);
    const rawScore = Math.max(0, 100 - deductions);
    const worstSeverity: Severity | null = catIssues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL'
      : catIssues.some(i => i.severity === 'HIGH IMPACT') ? 'HIGH IMPACT'
      : catIssues.length > 0 ? 'LOW IMPACT'
      : null;
    return { category: cat, score: rawScore, issueCount: catIssues.length, worstSeverity };
  });
}

function calculateScore(categoryScores: CategoryScore[]): number {
  const avg = categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length;
  return Math.round(avg);
}

function buildWhyScore(categoryScores: CategoryScore[], issues: AuditIssue[]): string {
  const weakest = categoryScores
    .filter(c => c.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map(c => c.category.toLowerCase());

  const criticals = issues.filter(i => i.severity === 'CRITICAL').length;

  if (criticals >= 3) {
    return `${criticals} critical failures in ${weakest.join(' and ')} mean users are dropping off before they understand what you do.`;
  }
  if (criticals >= 2) {
    return `Two critical failures in ${weakest.join(' and ')} are overriding every other decision you make.`;
  }
  if (criticals === 1) {
    const c = issues.find(i => i.severity === 'CRITICAL');
    return `The single critical issue — "${c?.title ?? 'see below'}" — is costing you more than all other issues combined.`;
  }
  if (weakest.length >= 2) {
    return `Your weakest areas are ${weakest[0]} and ${weakest[1]}. These are where users decide not to stay.`;
  }
  if (weakest.length === 1) {
    return `Your weakest area is ${weakest[0]}. Fixing it will move the score significantly.`;
  }
  return 'Your fundamentals are solid. The remaining issues are active conversion leaks.';
}

function getVerdict(score: number, issues: AuditIssue[]): string {
  const criticals = issues.filter(i => i.severity === 'CRITICAL').length;
  if (criticals >= 3) return 'Users are landing and leaving before they understand what you do.';
  if (criticals === 2) return 'Two critical failures are blocking conversion. Fix these first.';
  if (criticals === 1) return 'One critical failure is your primary drop-off point.';
  if (score >= 80) return 'Your fundamentals are strong. The remaining issues are active conversion leaks.';
  if (score >= 60) return 'Your site is live but has clear gaps that are costing you users.';
  if (score >= 40) return 'Several structural problems are preventing this from converting qualified visitors.';
  return 'The issues below explain exactly why this is not getting users.';
}

// ---------------------------------------------------------------------------
// Priority pruning — max 7 highest-impact issues
// ---------------------------------------------------------------------------

function pruneToHighestImpact(issues: AuditIssue[], max = 7): AuditIssue[] {
  const severityOrder: Record<Severity, number> = { CRITICAL: 0, 'HIGH IMPACT': 1, 'LOW IMPACT': 2 };
  const sorted = issues.slice().sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const criticals = sorted.filter(i => i.severity === 'CRITICAL');
  if (criticals.length >= max) return criticals.slice(0, max);

  const highs = sorted.filter(i => i.severity === 'HIGH IMPACT');
  const lows = sorted.filter(i => i.severity === 'LOW IMPACT');

  const result: AuditIssue[] = [...criticals];
  for (const h of highs) {
    if (result.length >= max) break;
    result.push(h);
  }
  for (const l of lows) {
    if (result.length >= max) break;
    result.push(l);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Entity Classification
// ---------------------------------------------------------------------------

const ESTABLISHED_BRANDS = new Set([
  'google.com', 'www.google.com',
  'semrush.com', 'www.semrush.com',
  'ahrefs.com', 'www.ahrefs.com',
  'notion.so', 'www.notion.so',
  'stripe.com', 'www.stripe.com',
  'github.com', 'www.github.com',
  'openai.com', 'www.openai.com',
  'hubspot.com', 'www.hubspot.com',
  'figma.com', 'www.figma.com',
  'canva.com', 'www.canva.com',
  'shopify.com', 'www.shopify.com',
  'salesforce.com', 'www.salesforce.com',
  'atlassian.com', 'www.atlassian.com',
  'slack.com', 'www.slack.com',
  'microsoft.com', 'www.microsoft.com',
  'apple.com', 'www.apple.com',
  'amazon.com', 'www.amazon.com',
  'netflix.com', 'www.netflix.com',
  'spotify.com', 'www.spotify.com',
  'airbnb.com', 'www.airbnb.com',
  'uber.com', 'www.uber.com',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'youtube.com', 'www.youtube.com',
  'reddit.com', 'www.reddit.com',
  'dropbox.com', 'www.dropbox.com',
  'zoom.us', 'www.zoom.us',
  'intercom.com', 'www.intercom.com',
  'mailchimp.com', 'www.mailchimp.com',
  'zapier.com', 'www.zapier.com',
  'webflow.com', 'www.webflow.com',
  'vercel.com', 'www.vercel.com',
  'netlify.com', 'www.netlify.com',
  'supabase.com', 'www.supabase.com',
  'linear.app', 'www.linear.app',
]);

const INSTITUTIONAL_CONTENT_TERMS = [
  'university', 'institute', 'official', 'government', 'global enterprise',
  'research center', 'foundation', 'department of', 'ministry of',
  'college of', 'school of', 'faculty of',
];

function classifyEntity(
  url: string,
  html: string,
  bodyText: string,
  signals: AuditResult['signals'],
): EntityClass {
  let hostname = '';
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* ok */ }

  // Unverified: fetch failed / completely empty page
  const isEffectivelyEmpty = signals.bodyWordCount < 20 && !signals.title;
  if (isEffectivelyEmpty) {
    return {
      classification: 'UNVERIFIED',
      label: 'SCAN LIMITED',
      reason: 'Page returned insufficient readable content',
    };
  }

  // Established: explicit allowlist
  if (ESTABLISHED_BRANDS.has(hostname)) {
    return {
      classification: 'ESTABLISHED_ENTITY',
      label: 'ESTABLISHED ENTITY',
      reason: `${hostname} is a recognized major brand`,
    };
  }

  // Established: .edu or .gov TLD
  if (/\.(edu|gov)$/.test(hostname)) {
    return {
      classification: 'ESTABLISHED_ENTITY',
      label: 'ESTABLISHED ENTITY',
      reason: `${hostname} is an institutional domain (.edu/.gov)`,
    };
  }

  // Established: institutional content keywords in title or body
  const titleLower = (signals.title ?? '').toLowerCase();
  const bodyLower = bodyText.toLowerCase();
  if (INSTITUTIONAL_CONTENT_TERMS.some(t => titleLower.includes(t) || bodyLower.slice(0, 2000).includes(t))) {
    return {
      classification: 'ESTABLISHED_ENTITY',
      label: 'ESTABLISHED ENTITY',
      reason: 'Page content indicates an established institutional entity',
    };
  }

  // Unverified: robots blocking root
  if (signals.robotsBlocksRoot) {
    return {
      classification: 'UNVERIFIED',
      label: 'SCAN LIMITED',
      reason: 'robots.txt blocks crawlers — page signals could not be fully evaluated',
    };
  }

  // Unverified: very thin page (likely SPA shell or blocked)
  if (signals.bodyWordCount < 40) {
    return {
      classification: 'UNVERIFIED',
      label: 'SCAN LIMITED',
      reason: 'Page exposed very little readable content to the scanner',
    };
  }

  // Default: early/unknown product
  return {
    classification: 'EARLY_PRODUCT',
    label: 'EARLY PRODUCT',
    reason: 'Domain not in established list; page appears to be an early-stage product',
  };
}

// ---------------------------------------------------------------------------
// Signal Layer System
// ---------------------------------------------------------------------------

function derivePageState(
  issues: AuditIssue[],
  signals: AuditResult['signals'],
): PageSignalState {
  const noProductExplanation = signals.bodyWordCount < 80 ||
    issues.some(i => i.category === 'CLARITY' && i.severity === 'CRITICAL');
  const missingDescription = !signals.description;
  const weakTitle = !signals.title || signals.title.length < 20 ||
    /^(home|welcome|untitled)$/i.test((signals.title ?? '').trim());
  const weakH1 = !signals.h1;

  if (noProductExplanation) return 'CRITICAL';
  if (missingDescription || weakTitle || weakH1) return 'WEAK';
  return 'GOOD';
}

function deriveSignalLayers(
  entityClass: EntityClass,
  issues: AuditIssue[],
  signals: AuditResult['signals'],
): SignalLayers {
  const structuredDataPresent = signals.structuredDataTypes.length > 0;
  const hasContentSignals = signals.hasTestimonials || signals.hasFounderSignals || signals.hasVideo;
  const looksNew = signals.bodyWordCount < 200 || (!signals.hasSitemap && !signals.hasRobotsTxt);

  const pageState: PageSignalState = derivePageState(issues, signals);

  const pageLabels: Record<PageSignalState, string> = {
    GOOD: 'Page clearly communicates what this is.',
    WEAK: 'Page does not clearly communicate what this is.',
    CRITICAL: 'It is unclear from the page what this product actually is.',
  };

  const distState: DistributionSignalState =
    (hasContentSignals && signals.bodyWordCount > 300) ? 'PRESENT' :
    (looksNew || signals.bodyWordCount < 150) ? 'UNKNOWN' :
    'LIMITED';

  const distLabels: Record<DistributionSignalState, string> = {
    PRESENT: 'Signs of external presence detected.',
    LIMITED: 'Limited external presence detectable from page signals.',
    UNKNOWN: 'External presence not clearly detectable from public page signals.',
  };

  // ── PATH A: ESTABLISHED ENTITY ───────────────────────────────────────
  if (entityClass.classification === 'ESTABLISHED_ENTITY') {
    const pageClarityValue = pageState === 'GOOD' ? 'CLEAR' : 'CHECKING';
    const conversionClarityIssues = issues.filter(i =>
      i.category === 'FLOW' || i.category === 'CLARITY' || i.category === 'TRUST'
    );
    const conversionValue = conversionClarityIssues.length === 0 ? 'CLEAR' : 'CHECKING';

    const signalRows: SignalRow[] = [
      { label: 'Entity authority',     value: 'STRONG',         state: 'positive' },
      { label: 'External visibility',  value: 'PRESENT',        state: 'positive' },
      { label: 'Page clarity',         value: pageClarityValue, state: pageClarityValue === 'CLEAR' ? 'positive' : 'neutral' },
      { label: 'Conversion clarity',   value: conversionValue,  state: conversionValue === 'CLEAR' ? 'positive' : 'neutral' },
    ];

    // Page-level issues only — no discovery/distribution alarmism
    const pageIssues: string[] = [];
    const clarityIssue = issues.find(i => i.category === 'CLARITY');
    const flowIssue    = issues.find(i => i.category === 'FLOW');
    const trustIssue   = issues.find(i => i.category === 'TRUST');

    if (clarityIssue) pageIssues.push('This page may not clearly explain the next step for a new visitor');
    if (flowIssue)    pageIssues.push('The CTA may not communicate what users receive after clicking');
    if (trustIssue)   pageIssues.push('The page may be optimized for brand trust, not first-time conversion');

    if (pageIssues.length === 0) {
      pageIssues.push('Page fundamentals appear strong — no major page-level gaps detected');
    }

    return {
      entityClass,
      page:         { state: pageState, label: pageLabels[pageState] },
      entity:       { state: 'STRONG', label: 'Widely recognized established entity.' },
      distribution: { state: 'PRESENT', label: distLabels['PRESENT'] },
      signalRows,
      rootCause:  'This site is already widely recognized.',
      subtext:    'AudFlo will not treat this like a new product with no distribution. This scan focuses on page clarity, conversion friction, and communication gaps.',
      issuesSectionLabel: 'PAGE-LEVEL OPPORTUNITIES',
      primaryIssues: pageIssues.slice(0, 3),
      ctaLabel:    'VIEW PAGE-LEVEL FIXES →',
      whatToFix: [
        'Review CTA clarity for first-time visitors',
        'Ensure page hierarchy guides new users to the primary action',
        'Check that value proposition is clear above the fold',
      ],
      doToday: [
        'Test the page as a first-time visitor with fresh eyes',
        'Ask one person unfamiliar with the product to describe it after 10 seconds',
        'Review the primary CTA copy for specificity',
      ],
    };
  }

  // ── PATH C: UNVERIFIED / INSUFFICIENT DATA ────────────────────────────
  if (entityClass.classification === 'UNVERIFIED') {
    const signalRows: SignalRow[] = [
      { label: 'Page readable',          value: 'LIMITED',      state: 'warn' },
      { label: 'Entity classification',  value: 'UNKNOWN',      state: 'neutral' },
      { label: 'External visibility',    value: 'NOT ASSESSED', state: 'neutral' },
    ];

    return {
      entityClass,
      page:         { state: pageState, label: pageLabels[pageState] },
      entity:       { state: 'UNKNOWN', label: 'Could not reliably classify this entity.' },
      distribution: { state: 'UNKNOWN', label: distLabels['UNKNOWN'] },
      signalRows,
      rootCause:  'We could not reliably read enough of this page.',
      subtext:    'This can happen if the site blocks crawlers, loads content only after JavaScript runs, or returns limited HTML.',
      issuesSectionLabel: 'POSSIBLE ISSUES',
      primaryIssues: [
        'The page may not expose enough crawlable content for discovery systems',
        'Search engines and AI systems may see less than users see',
        'Public signals could not be evaluated reliably',
      ],
      ctaLabel:           'TRY ANOTHER URL →',
      secondaryCtaLabel:  'SEE CRAWLABILITY FIXES →',
      whatToFix: [
        'Ensure key content is rendered in the initial HTML (not JavaScript-only)',
        'Check robots.txt is not blocking crawlers from the root',
        'Verify the page returns a 200 status to non-browser requests',
      ],
      doToday: [
        'Test your URL in a browser with JavaScript disabled',
        'Check your robots.txt at yourdomain.com/robots.txt',
        'Use Google Search Console to inspect URL crawlability',
      ],
    };
  }

  // ── PATH B: EARLY / UNKNOWN PRODUCT ──────────────────────────────────

  // Layer 2: Entity Authority
  const clarityIssues = issues.filter(i => i.category === 'CLARITY');
  const hasEntityDefinition = clarityIssues.length === 0 ||
    !clarityIssues.some(i => i.severity === 'CRITICAL');
  const categoryInferrable = structuredDataPresent || (signals.bodyWordCount > 150 && hasEntityDefinition);

  let entityState: EntitySignalState;
  if (!hasEntityDefinition || !categoryInferrable) {
    entityState = pageState === 'CRITICAL' ? 'UNKNOWN' : 'WEAK';
  } else {
    entityState = 'WEAK';
  }

  const entityLabels: Record<EntitySignalState, string> = {
    STRONG: 'Entity appears established.',
    WEAK: 'It is unclear what category this product belongs to.',
    UNKNOWN: 'This product is not clearly defined as a recognizable entity.',
  };

  // Derive AI understanding level
  let aiUnderstandingValue: string;
  if (pageState === 'CRITICAL' || entityState === 'UNKNOWN') {
    aiUnderstandingValue = 'LOW';
  } else if (structuredDataPresent && pageState === 'GOOD') {
    aiUnderstandingValue = 'HIGH';
  } else {
    aiUnderstandingValue = 'MEDIUM';
  }

  const aiUnderstandingState: SignalRow['state'] =
    aiUnderstandingValue === 'LOW' ? 'danger' :
    aiUnderstandingValue === 'MEDIUM' ? 'warn' : 'positive';

  const entityClarityValue = hasEntityDefinition ? 'CLEAR' : 'WEAK';
  const pageClarityValue   = pageState === 'GOOD' ? 'CLEAR' : 'WEAK';

  const extVisValue = distState;
  const extVisState: SignalRow['state'] =
    distState === 'PRESENT' ? 'positive' :
    distState === 'LIMITED' ? 'warn' : 'danger';

  const signalRows: SignalRow[] = [
    { label: 'AI understanding',   value: aiUnderstandingValue, state: aiUnderstandingState },
    { label: 'Entity clarity',     value: entityClarityValue,   state: entityClarityValue === 'CLEAR' ? 'positive' : 'danger' },
    { label: 'External visibility',value: extVisValue,          state: extVisState },
    { label: 'Page clarity',       value: pageClarityValue,     state: pageClarityValue === 'CLEAR' ? 'positive' : 'warn' },
  ];

  // Root cause
  let rootCause: string;
  if (pageState === 'CRITICAL' && (entityState === 'WEAK' || entityState === 'UNKNOWN')) {
    rootCause = 'AI cannot clearly understand or find your product.';
  } else if (pageState === 'GOOD' && distState === 'LIMITED') {
    rootCause = 'You are not publishing in places where discovery happens.';
  } else if (pageState === 'WEAK' && distState !== 'PRESENT') {
    rootCause = 'Your product is not clearly explained in a way AI systems can understand or repeat.';
  } else {
    rootCause = 'Your product is not yet visible where discovery happens.';
  }

  // Primary issues — ordered by spec priority
  const primaryIssues: string[] = [];

  // 1. Product clarity
  if (pageState === 'CRITICAL') {
    primaryIssues.push('Your product is not defined clearly enough for AI systems to understand');
  } else if (pageState === 'WEAK' && !signals.h1) {
    primaryIssues.push('Your homepage does not explain who this is for fast enough');
  }

  // 2. Who it is for
  const clarityWho = issues.find(i =>
    i.category === 'CLARITY' && i.title.includes('cannot tell if')
  );
  if (clarityWho && primaryIssues.length < 3) {
    primaryIssues.push('It is not clear who this product is built for');
  }

  // 3. What user gets next
  if (!signals.hasPostSignupExplanation && primaryIssues.length < 3) {
    primaryIssues.push('There is no explanation of what happens after someone signs up');
  }

  // 4. External discovery
  if (distState !== 'PRESENT' && primaryIssues.length < 3) {
    primaryIssues.push('Your product is not showing up outside your own website yet');
  }

  // Fill from actual issues if still have room
  for (const issue of issues.slice(0, 5)) {
    if (primaryIssues.length >= 3) break;
    const human = translateIssueToHuman(issue);
    if (!primaryIssues.includes(human)) primaryIssues.push(human);
  }

  return {
    entityClass,
    page:         { state: pageState, label: pageLabels[pageState] },
    entity:       { state: entityState, label: entityLabels[entityState] },
    distribution: { state: distState, label: distLabels[distState] },
    signalRows,
    rootCause,
    subtext:    'This does not mean your product is bad. It means people and AI systems do not have enough clear context to understand, trust, or recommend it yet.',
    issuesSectionLabel: 'PRIMARY BREAKPOINTS',
    primaryIssues: primaryIssues.slice(0, 3),
    ctaLabel:    'SEE WHAT TO FIX FIRST →',
    whatToFix: [
      'Define your product clearly in one sentence for any discovery system',
      'Create content that AI can cite and repeat when asked about your category',
      'Build external visibility through publishing and community distribution',
    ],
    doToday: [
      'Post 1 Reddit answer in a community your target user is in',
      'Write 1 thread on X about your problem space',
      'Reply to 10 posts where your target user is asking for help',
    ],
  };
}

function translateIssueToHuman(issue: AuditIssue): string {
  const map: Partial<Record<string, string>> = {
    'You are completely invisible to search engines':
      'Your product has no presence in the systems that surface new products',
    'Your entire site is blocked from being indexed':
      'Nothing you publish can be indexed or discovered',
    'Your page has no identity in search results':
      'Your product has no identity in any discovery system',
    'Most crawlers see a blank page when they visit':
      'Discovery systems may see a blank page when they visit',
    'AI search engines cannot categorize or cite your product':
      'AI systems may not have enough context to categorize or recommend you',
    'Visitors leave in the first 5 seconds because they cannot place your product':
      'Visitors cannot place your product within 5 seconds',
    'Visitors cannot tell if this product is meant for them':
      'It is not immediately clear who this is for',
    'You look interchangeable with every other AI tool':
      'Your product looks like every other option in your space',
    'Users are asked to commit before seeing anything real':
      'You ask for commitment before showing what the product actually does',
  };
  return map[issue.title] ?? issue.what;
}

// ---------------------------------------------------------------------------
// Main analysis entry point
// ---------------------------------------------------------------------------

export function analyzeRawScan(raw: ScanRaw): AuditResult {
  issueSeq = 0;
  const { html, robotsTxt, sitemapXml, faviconExists, manifestJson, url } = raw;

  const title = getTag(html, 'title');
  const description = getMeta(html, 'description');
  const robotsMeta = getMeta(html, 'robots');
  const canonical = (() => {
    const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    return m ? m[1] : null;
  })();
  const h1 = getTag(html, 'h1');
  const h2s = getAllH2s(html);
  const anchors = getAllAnchors(html);
  const jsonLdTypes = getJsonLdTypes(html);
  const bodyText = getBodyText(html);
  const faviconLink = !!getLinkRel(html, 'icon');
  const appleTouchIcon = !!getLinkRel(html, 'apple-touch-icon');
  const icon192 = hasIconSize(html, '192x192') || (manifestJson?.includes('192x192') ?? false);
  const icon512 = hasIconSize(html, '512x512') || (manifestJson?.includes('512x512') ?? false);
  const hasManifest = !!getLinkRel(html, 'manifest') || !!manifestJson;
  const hasOgTitle = !!getMetaProperty(html, 'og:title');
  const hasOgDescription = !!getMetaProperty(html, 'og:description');
  const hasOgImage = !!getMetaProperty(html, 'og:image');

  let robotsBlocksRoot = false;
  if (robotsTxt) {
    const lines = robotsTxt.toLowerCase().split('\n');
    let inAll = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('user-agent:')) inAll = t.includes('*');
      if (inAll && (t === 'disallow: /' || t.startsWith('disallow: / '))) {
        robotsBlocksRoot = true; break;
      }
    }
  }

  const bodyLower = bodyText.toLowerCase();
  const anchorsLower = anchors.map(a => a.toLowerCase());
  const internalLinkCount = anchors.filter(a => a.startsWith('/') || a.includes(new URL(url).hostname)).length;

  const hasScreenshots = ['screenshot', 'preview', 'demo', 'example', 'output', 'result'].some(t => bodyLower.includes(t))
    || /\.(png|jpg|jpeg|gif|webp|mp4)/i.test(html);
  const hasVideo = /<video|iframe[^>]+youtube|iframe[^>]+vimeo/i.test(html);
  const hasTestimonials = ['testimonial', 'review', '\u201c', '"', 'customer', 'client'].some(t => bodyLower.includes(t));
  const hasFounderSignals = ['founder', 'built by', 'created by', 'our team', 'about us'].some(t => bodyLower.includes(t));
  const hasPostSignupExplanation = ['what happens', 'next step', 'step 1', "you'll", 'you will'].some(t => bodyLower.includes(t));
  const hasPricingMention = ['pricing', 'free', 'per month', '/mo', 'trial'].some(t => bodyLower.includes(t));
  const hasFeatureBullets = /<ul[^>]*>[\s\S]*?<\/ul>/i.test(html);
  const hasCTAAboveFold = /<(form|button|input)[^>]*(email|submit|signup|sign-up)/i.test(html.slice(0, 3000));
  const ctaBeforeValue = hasCTAAboveFold && !['how it works', 'example', 'demo', 'see how'].some(t => bodyLower.indexOf(t) < 3000);
  const genericAIPattern = ['ai-powered', 'powered by ai', 'intelligent', 'smart ', 'cutting-edge', 'state-of-the-art']
    .filter(t => bodyLower.includes(t)).length >= 2;
  const bodyWordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const headlineWords = (h1 ?? title ?? '').split(/\s+/).filter(Boolean);

  const signals = {
    title, description, canonical, robots: robotsMeta, h1, h2s,
    hasRobotsTxt: !!robotsTxt, robotsBlocksRoot, hasSitemap: !!sitemapXml,
    faviconIco: faviconExists, faviconLink, appleTouchIcon, icon192, icon512, hasManifest,
    structuredDataTypes: jsonLdTypes, hasOgTitle, hasOgDescription, hasOgImage,
    internalLinkCount, anchorLinkCount: anchors.length,
    hasPrivacyLink: anchorsLower.some(a => a.includes('privacy')),
    hasTermsLink: anchorsLower.some(a => a.includes('terms') || a.includes('tos')),
    hasCanonical: !!canonical, hasScreenshots, hasVideo, hasTestimonials,
    hasFounderSignals, hasPostSignupExplanation, hasPricingMention, hasFeatureBullets,
    hasCTAAboveFold, ctaBeforeValue, genericAIPattern,
    headlineWordCount: headlineWords.length, bodyWordCount,
  };

  // Run all 6 categories
  const rawIssues: AuditIssue[] = [
    ...checkDiscovery(html, title, description, robotsMeta, robotsTxt, sitemapXml, anchors, jsonLdTypes, faviconExists, manifestJson, h1, bodyText, url),
    ...checkTrust(html, bodyText, anchors, url),
    ...checkClarity(html, title, h1, h2s, bodyText, description),
    ...checkFlow(html, bodyText, anchors),
    ...checkDifferentiation(html, title, h1, bodyText),
    ...checkTechHygiene(html, anchors, canonical, title, url),
  ];

  // Prune to max 7
  const allIssues = pruneToHighestImpact(rawIssues, 7);

  const categoryScores = buildCategoryScores(allIssues);
  const score = calculateScore(categoryScores);
  const verdict = getVerdict(score, allIssues);
  const whyScore = buildWhyScore(categoryScores, allIssues);
  const primaryFailure = allIssues[0] ?? null;
  // Top 3 for "What to fix first"
  const topFixes = allIssues.slice(0, 3);

  const entityClass = classifyEntity(url, html, bodyText, signals);
  const signalLayers = deriveSignalLayers(entityClass, allIssues, signals);

  return {
    url,
    scannedAt: new Date().toISOString(),
    score,
    verdict,
    whyScore,
    primaryFailure,
    topFixes,
    issues: allIssues,
    categoryScores,
    signals,
    signalLayers,
  };
}
