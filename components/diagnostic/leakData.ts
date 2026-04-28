export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface Leak {
  id: number;
  title: string;
  severity: Severity;
  what: string;
  location: string;
  why: string;
  estimatedLoss: string;
  fix: string;
  prompt: string;
  expectedImpact: string;
}

export const LEAKS: Leak[] = [
  {
    id: 1,
    title: 'GENERIC HEADLINE',
    severity: 'CRITICAL',
    what: `The hero headline describes the product category, not the user's problem. It reads like every other AI tool in the same tab — no named user type, no specific pain state, no outcome claim. The subheadline lists features ("drag-and-drop", "real-time", "integrations"), which makes the ambiguity worse. A visitor cannot tell in 4 seconds whether this is for them.`,
    location: 'This is happening in your hero section, above the fold — the first thing every visitor reads.',
    why: `Visitors arriving from paid ads or social have 4–6 seconds before they leave. Your headline is failing that test. "Maybe this is for me" is not neutral — it reads as low confidence, and low confidence kills the click. This is where you lose users before they scroll. The headline is the single highest-leverage text on the page.`,
    estimatedLoss: 'You are likely losing 5–7 out of every 10 qualified visitors at this step.',
    fix: `Replace the headline with one sentence that names: (1) who it's for, (2) the exact failure state they're in right now, (3) what they get after using this. Cut the subheadline to one concrete outcome. Remove all feature-list language from above the fold.`,
    prompt: `Rewrite my hero headline. Here is the current one: "[paste your current headline]"

Constraints:
- Under 10 words
- Names a specific user type (not "teams" or "anyone")
- References a specific failure or frustration, not a category
- States the outcome, not the mechanism
- No "AI-powered", "platform", "solution", "streamline", "seamlessly"

Output 3 variants. For each, explain in one sentence why it works.
Then output the best subheadline (max 18 words) that pairs with your top pick.`,
    expectedImpact: 'Landing-to-scroll conversion increases 18–30% when this is fixed.',
  },
  {
    id: 2,
    title: 'SIGNUP FRICTION',
    severity: 'CRITICAL',
    what: `The signup form is asking for full name, work email, company name, team size, and intended use case — before the user has seen anything. There is no preview of the dashboard, no "takes 30 seconds" signal, no indication of what they're signing up for beyond the product name. The use-case radio group is the worst offender: it tells users a sales call is coming.`,
    location: 'This is happening at your primary signup CTA — the exact moment a user decides to commit.',
    why: `Each field after "email" cuts conversion by 8–12%. At five fields, half the people who were ready to sign up have already quit. The use-case radio is where they stop. The moment a user suspects a sales funnel, they weigh the form differently. This is why your signup page conversion is low — not acquisition, not the headline. This form.`,
    estimatedLoss: 'You are likely losing 6–8 out of every 10 qualified visitors at this step.',
    fix: `Reduce the first screen to email only. Move name to post-signup profile setup. Delete company name and team size from the signup flow entirely. Replace the use-case radio with a single question shown on the empty dashboard after the user has already activated. Do not ask for information you cannot justify needing before the user sees value.`,
    prompt: `Audit my signup flow and reduce it to the minimum required fields.

Current fields in order: [list your fields here]
Current form placement: [above fold / modal / dedicated page]
What happens immediately after signup: [describe the first screen]

For each field, output one of:
- KEEP (required to create account)
- DEFER (move to onboarding step 2)
- DELETE (never ask this)

Then output: the revised first-screen form (fields only), and the first thing the user should see after submitting it.`,
    expectedImpact: 'Signup-page conversion increases 22–35% when this is fixed.',
  },
  {
    id: 3,
    title: 'WEAK TRUST SIGNALS',
    severity: 'HIGH',
    what: `There is no social proof within 300px of the primary CTA. The logo strip is below the fold, after two feature sections. It uses company names without context — no "X teams use this to do Y." There are no user counts, no named testimonials, no case study links. The footer has a privacy policy. That is not a trust signal.`,
    location: 'This happens near your primary CTA — the decision point where users either commit or close the tab.',
    why: `At the moment a user decides whether to enter their email, they are running one calculation: "has anyone else done this and not regretted it?" Without an answer next to the button, the default answer is "I don't know." Unknown risk causes hesitation. This is not a persuasion problem. This is where you lose the users who were already interested.`,
    estimatedLoss: 'You are likely losing 4–6 out of every 10 interested visitors at this step.',
    fix: `Move one named testimonial — full name, company, and a specific outcome ("reduced our onboarding drop by 40%") — to within 100px of the primary CTA. Replace the logo strip with "Trusted by teams at [3 specific company names]." If you have no testimonials, add a user count ("214 teams in early access") — specificity beats impressiveness. Do not leave the CTA without a trust anchor.`,
    prompt: `I need to add a trust signal directly adjacent to my CTA button.

What I have available: [list: testimonials with names / user count / press mentions / notable customers]
CTA button copy: "[paste it]"
CTA placement: [describe where on the page]

For each trust asset I listed:
- Write the exact copy to display (max 30 words)
- Specify placement: above CTA / below CTA / inline with CTA
- Rate credibility impact: HIGH / MEDIUM / LOW, with one-line reason

If I have nothing yet, output: the 2 fastest trust signals I can collect this week and the exact ask-message to send to early users.`,
    expectedImpact: 'CTA click-through increases 12–20% when this is fixed.',
  },
  {
    id: 4,
    title: 'SLOW PAGE SPEED',
    severity: 'MEDIUM',
    what: `LCP is measuring 3.8s–4.6s on a simulated 4G mobile connection. The primary cause is a 1.4MB hero image served without WebP/AVIF and without explicit width/height attributes — this is causing layout shift. Two render-blocking Google Fonts requests are in the head. A 280KB JavaScript bundle is loading before above-fold content is interactive.`,
    location: 'This is happening at the initial load — before a visitor has read a single word of your copy.',
    why: `Google's own data shows a 32% higher bounce rate for pages that take 3s versus 1s to load. Above 4s, you are losing roughly one in three visitors before they read anything. Google is also quietly demoting the page in organic results. This is compounding your acquisition loss upstream — fewer people arriving, and more of them leaving before the page finishes loading.`,
    estimatedLoss: 'You are likely losing 3–5 out of every 10 organic visitors before the page finishes loading.',
    fix: `Convert the hero image to WebP and add explicit width/height to eliminate CLS. Add \`font-display: swap\` to font declarations and move the Google Fonts link to use \`rel="preconnect"\` and \`rel="preload"\`. Split the JS bundle so above-fold content renders without waiting for the full app. Target: LCP under 2.5s on 4G.`,
    prompt: `Help me fix my page speed. My setup: [Next.js / Vite / CRA / other].

Current Lighthouse mobile scores:
- LCP: [X]s
- CLS: [X]
- FID/INP: [X]ms
- Performance score: [X]

Known issues I can see: [list anything you already know]

For each issue:
1. Root cause (one sentence)
2. Exact fix with code snippet if applicable
3. Estimated LCP improvement in seconds

Sort by impact descending. Output as a numbered action list I can execute today.`,
    expectedImpact: 'Bounce rate decreases 15–25% and organic ranking improves when this is fixed.',
  },
  {
    id: 5,
    title: 'MISSING RE-AUDIT LOOP',
    severity: 'MEDIUM',
    what: `There is no conversion tracking below the top-level pageview. The analytics setup records sessions and page views — nothing else. No events for CTA clicks, signup form submissions, activation milestones, or onboarding drop-off. Every change ships blind. There is no way to know whether a headline rewrite improved conversion. Regressions are invisible until they become revenue problems.`,
    location: 'This is a systemic gap — it affects every page, every flow, and every fix you make from this point forward.',
    why: `Every fix in this audit will degrade without measurement. The headline you rewrite today will drift when copy is updated. The trust signal you add will be moved during a redesign. Without a metric attached to each change, there is no signal when something breaks. This is why improvements don't compound — you fix things once, and then lose the gains silently.`,
    estimatedLoss: 'You are likely re-losing gains from every previous optimization within 90 days of shipping them.',
    fix: `Instrument four events today: CTA click, signup start, signup complete, first activation action. Set a weekly 20-minute funnel review. Define a regression threshold for each stage — a specific number that triggers investigation when crossed. Schedule a full re-audit at 60 days. Do not ship another conversion change without a metric attached to it.`,
    prompt: `Help me instrument my app for conversion tracking and set up a re-audit process.

My stack: [analytics tool: Posthog / Mixpanel / GA4 / other] + [app framework]
Current events tracked: [list what you have, or "none"]
My primary conversion goal: [e.g., "user completes first workflow"]

Output:
1. The 4 events I must track minimum, with exact event names and properties
2. Code snippet for each event in my stack
3. A funnel definition using those events
4. A regression threshold for each funnel stage (the number that triggers investigation)
5. A 5-item monthly review checklist I can copy into my calendar`,
    expectedImpact: 'Prevents silent regression across all other fixes — this is what makes the entire audit compound.',
  },
];

export const BIGGEST_DROP = {
  label: 'LANDING PAGE',
  pct: '62%',
};
