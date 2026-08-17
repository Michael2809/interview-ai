/**
 * Demo workspace fixtures — Meridian Cloud.
 *
 * Source of truth for the permanent Recrewt AI demo/marketing workspace.
 * `seed-demo.mjs` reads this file and writes it into Supabase under a
 * single dedicated auth account (DEMO_ACCOUNT_EMAIL). Nothing here talks
 * to the database directly — this file is pure data so the story (who
 * these people are, what they said, how they scored) can be reviewed and
 * edited without touching seeding logic.
 *
 * Design:
 *   - All dates are expressed as "N days ago" (or fractional days for
 *     same-day timing) relative to seed time, not fixed ISO strings — so
 *     re-running the seed script always makes the workspace look freshly
 *     active, no matter when it's run.
 *   - Every score's `question_reviews[].evidence_quote` and every
 *     `strengths`/`concerns` evidence line is a literal substring of that
 *     candidate's own transcript answer — checked in seed-demo.mjs — so
 *     nothing in the UI can show a quote that doesn't exist in the
 *     transcript.
 */

export const COMPANY = {
  name: 'Meridian Cloud',
  website: 'https://meridiancloud.io',
}

export const RECRUITER = {
  firstName: 'Sam',
  fullName: 'Sam Okafor',
}

/* ─────────────────────────────────────────────────────────────
 * Confidence band copy — mirrors app/api/score-interview/route.js
 * confidenceBand() exactly, so seeded rows read identically to
 * ones the live pipeline would have produced.
 * ────────────────────────────────────────────────────────── */
export const CONFIDENCE_COPY = {
  high:  'Evidence is strong and consistent. Act on the recommendation.',
  fair:  'A couple of soft signals. Skim the transcript before deciding.',
  mixed: 'Evidence is uneven. A second review is worth your time.',
  low:   'The AI is not confident. Watch the interview yourself before deciding.',
}

function bandForConfidence(pct) {
  if (pct >= 85) return 'high'
  if (pct >= 65) return 'fair'
  if (pct >= 45) return 'mixed'
  return 'low'
}

/* ─────────────────────────────────────────────────────────────
 * Roles — each ships with its stage's four interview questions.
 * One "Screening" stage per role, matching the shape the app's
 * own onboarding flow creates.
 * ────────────────────────────────────────────────────────── */

export const ROLES = [
  {
    slug: 'backend-senior',
    title: 'Senior Backend Engineer',
    department: 'Engineering',
    level: 'senior',
    status: 'active',
    createdDaysAgo: 138,
    questions: [
      'Walk me through a time you had to debug a production incident under pressure. What was the issue, and how did you resolve it?',
      'How do you approach designing a service that needs to scale — what are the key decisions you make early on?',
      'Tell me about a time you disagreed with a technical decision made by a teammate or your lead. How did you handle it?',
      'What pulled you toward this role at Meridian Cloud, and what would you want to be true about your first 90 days here?',
    ],
  },
  {
    slug: 'frontend-mid',
    title: 'Frontend Engineer',
    department: 'Engineering',
    level: 'mid',
    status: 'active',
    createdDaysAgo: 94,
    questions: [
      "Tell me about a UI or feature you shipped that you're genuinely proud of. What made it hard?",
      'How do you think about performance and accessibility when building a new component — do you have a process?',
      'Describe a time you got critical feedback on your work in a code review. How did you respond?',
      'What kind of team environment helps you do your best work?',
    ],
  },
  {
    slug: 'product-designer',
    title: 'Product Designer',
    department: 'Design',
    level: 'mid',
    status: 'active',
    createdDaysAgo: 61,
    questions: [
      'Walk me through a project end-to-end — from the problem you were given to the design that shipped.',
      'Tell me about a time your design was pushed back on by engineering or product. What happened?',
      'How do you use research or data to validate a design decision, versus going on instinct?',
      "What's a product or piece of design work you admire, and why?",
    ],
  },
  {
    slug: 'csm',
    title: 'Customer Success Manager',
    department: 'Customer Success',
    level: 'mid',
    status: 'active',
    createdDaysAgo: 152,
    questions: [
      'Tell me about a customer relationship you saved from churning. What did you do?',
      "How do you handle a customer who's upset and escalating, in the moment?",
      'Walk me through how you would run a quarterly business review with a key account.',
      'What does success look like for you three months into this role?',
    ],
  },
  {
    slug: 'account-executive',
    title: 'Account Executive',
    department: 'Sales',
    level: 'mid',
    status: 'paused',
    createdDaysAgo: 121,
    questions: [
      'Walk me through your most complex deal — the one with the most stakeholders or the longest cycle.',
      'Tell me about a deal you lost. What did you learn from it?',
      'How do you qualify whether a prospect is actually worth your time early in a cycle?',
      "What's your process for handling a negotiation where the buyer is pushing hard on price?",
    ],
  },
  {
    slug: 'data-analyst',
    title: 'Data Analyst',
    department: 'Data',
    level: 'mid',
    status: 'archived',
    createdDaysAgo: 163,
    questions: [
      'Tell me about an analysis you did that actually changed a decision. What was the impact?',
      "How do you make sure a dashboard or report doesn't get misread by the people using it?",
      'Walk me through how you would investigate a metric that suddenly dropped 20% week over week.',
      'What tools do you reach for day to day, and where do you feel less confident?',
    ],
  },
  {
    slug: 'devops',
    title: 'DevOps Engineer',
    department: 'Engineering',
    level: 'senior',
    status: 'archived',
    createdDaysAgo: 181,
    questions: [
      "Tell me about the most painful outage you've been part of. What was the root cause, and what changed afterward?",
      'How do you think about the tradeoff between moving fast and keeping infrastructure changes safe?',
      'Walk me through how you would approach reducing our cloud spend by 20% without hurting reliability.',
      'What does good on-call culture look like to you?',
    ],
  },
  {
    slug: 'support-specialist',
    title: 'Support Specialist',
    department: 'Customer Success',
    level: 'entry',
    status: 'active',
    createdDaysAgo: 29,
    questions: [
      'Tell me about a time you turned a frustrated customer into a happy one.',
      "How do you prioritize your queue when you've got twenty open tickets and three are urgent?",
      "Describe a time you didn't know the answer to a customer's question. What did you do?",
      'Why support, and why here?',
    ],
  },
]

/* ─────────────────────────────────────────────────────────────
 * Candidates.
 *
 * archetype drives score band + recommendation + status:
 *   strong-hire  8.6–9.4   shortlisted
 *   hire         6.6–8.3   shortlisted (sometimes rejected — "runner-up,
 *                                        role filled by someone else")
 *   hold         4.6–6.3   on-hold or rejected
 *   reject       1.8–4.2   rejected
 *   ongoing      no transcript — invited only, has not completed
 *
 * pending: true → score exists but status is left null (AI has scored
 * it, recruiter hasn't decided) so it surfaces in the dashboard's
 * "Waiting on you" / Priority Queue. Only set on recent candidates.
 * ────────────────────────────────────────────────────────── */

export const CANDIDATES = [
  // ── Senior Backend Engineer ──────────────────────────────
  {
    name: 'Priya Raghavan', email: 'priya.raghavan82@gmail.com',
    role: 'backend-senior', archetype: 'strong-hire',
    invitedDaysAgo: 46, completedDaysAgo: 45.7,
    facts: { title: 'Staff Backend Engineer', company: 'Kestrel Analytics', years: 9, prior: 'Solstice Bank', metric: 'cut p99 checkout latency from 2.1s to 340ms' },
    answers: [
      "Our checkout service started timing out during a flash sale — p99 latency spiked past four seconds and orders were failing silently. I pulled the on-call channel, confirmed it was a connection pool exhaustion issue against Postgres, and temporarily raised pool limits while I traced the real cause: a new pricing microservice was making a synchronous call per line item instead of batching. I shipped a batched version within the hour and we went from timing out to fully stable before the sale ended.",
      "I start from the read and write patterns, not the architecture diagram. For a new service I ask what the p99 needs to be, what happens if a downstream dependency is slow, and whether the data is naturally partitionable. At Kestrel that meant designing our billing service around idempotency keys and a queue from day one, because I knew retries were inevitable at scale — we cut p99 checkout latency from 2.1s to 340ms once that shipped.",
      "A teammate wanted to introduce a distributed cache in front of our primary database to fix a hot-path latency issue. I pushed back — the actual bottleneck was an unindexed query, not a caching problem, and adding a cache would have hidden the real issue and added an invalidation headache. I asked for a day to prove it with an index change and a load test. It worked, we skipped the cache, and he thanked me for it later.",
      "I've used Recrewt-style interview tools as a candidate before and always wondered what the backend actually looked like — that curiosity is part of what drew me here. Mostly though, I want to work on infrastructure that directly touches revenue again, the way billing did at Kestrel. In the first 90 days I'd want to have shipped one real fix to something in production, not just read the codebase.",
    ],
    score: {
      score: 9.1, confidence: 90,
      summary: 'Exceptionally strong senior backend candidate — production incident response, scaling judgment, and technical pushback all backed by concrete, verifiable outcomes.',
      strengths: [
        { title: 'Calm under production pressure', evidence: 'I pulled the on-call channel, confirmed it was a connection pool exhaustion issue against Postgres, and temporarily raised pool limits while I traced the real cause' },
        { title: 'Quantified, credible impact', evidence: 'we cut p99 checkout latency from 2.1s to 340ms once that shipped' },
        { title: 'Pushes back on bad technical calls with evidence', evidence: 'I asked for a day to prove it with an index change and a load test. It worked, we skipped the cache' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: '8 substantive answers' },
        { polarity: '+', label: 'Detailed responses (median 58 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Marcus Webb', email: 'marcus.webb.dev@outlook.com',
    role: 'backend-senior', archetype: 'hire',
    invitedDaysAgo: 21, completedDaysAgo: 20.6,
    facts: { title: 'Backend Engineer', company: 'Ferrocode', years: 5 },
    answers: [
      "We had a memory leak in a worker process that only showed up after about six hours of runtime, so it always happened overnight. I added heap snapshots to the deploy pipeline and compared two snapshots an hour apart, which pointed at an event listener we weren't cleaning up on retry. Took me most of a night shift to track down, but the fix was a one-line unsubscribe.",
      "I usually start with what the read-to-write ratio looks like and whether we can get away with eventual consistency anywhere, since that opens up a lot of scaling options. Honestly I lean on caching more than I probably should as a first instinct — it's fast to reach for, even if it's not always the most elegant answer.",
      "A lead wanted to move a batch job to run synchronously in the request path to 'simplify' the code. I disagreed since it would tie API latency to batch processing time, but I didn't push back hard enough in the meeting and it shipped that way. It caused timeouts within a month and we reverted it. I've since gotten more comfortable raising a concern even when I'm the only one in the room saying it.",
      "I like that Meridian Cloud is still small enough that a backend engineer touches the whole stack. In 90 days I'd want to own at least one service end to end.",
    ],
    score: {
      score: 7.4, confidence: 76,
      summary: 'Solid mid-to-senior backend engineer with real debugging chops. Scaling instincts lean on caching a bit reflexively, and self-reports a past hesitancy to push back that he says he has since corrected.',
      strengths: [
        { title: 'Methodical incident debugging', evidence: 'I added heap snapshots to the deploy pipeline and compared two snapshots an hour apart' },
        { title: 'Self-aware about past mistakes', evidence: "I've since gotten more comfortable raising a concern even when I'm the only one in the room saying it" },
      ],
      concerns: [
        { title: 'Reaches for caching by default', evidence: "I lean on caching more than I probably should as a first instinct — it's fast to reach for" },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '+', label: 'Clear delivery' },
        { polarity: '-', label: 'Some contradictions noted' },
      ],
    },
  },
  {
    name: 'Elena Sokolova', email: 'elena.sokolova.eng@proton.me',
    role: 'backend-senior', archetype: 'hold',
    invitedDaysAgo: 35, completedDaysAgo: 34.5,
    facts: { title: 'Backend Developer', company: 'Coilcraft', years: 4 },
    answers: [
      "We had an outage once where the API went down for about twenty minutes. It was a deploy issue. We rolled back and it came back up.",
      "I think about what database to use and whether we need microservices or not. I'd probably ask my lead for guidance on the bigger calls since I haven't owned that decision solo before.",
      "There was a time a senior engineer wanted to skip writing tests for a hotfix to save time. I didn't say anything since he had more experience than me, but I did add tests myself afterward once it was merged.",
      "I want to grow into more senior scope and this role looked like a good next step from a title perspective.",
    ],
    score: {
      score: 5.2, confidence: 58,
      summary: 'Answers are thin on specifics — the outage story lacks a root cause, and she describes staying quiet on a technical disagreement rather than raising it. Some initiative shown in adding tests after the fact, but overall reads early-career for a senior req.',
      strengths: [
        { title: 'Takes initiative quietly', evidence: 'I did add tests myself afterward once it was merged' },
      ],
      concerns: [
        { title: 'No root cause identified for the outage', evidence: 'It was a deploy issue. We rolled back and it came back up.' },
        { title: "Doesn't push back on technical disagreements", evidence: "I didn't say anything since he had more experience than me" },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 19 words)' },
        { polarity: '-', label: 'Skipped or hedged 25% of questions' },
      ],
    },
  },
  {
    name: 'Daniel Osei', email: 'daniel.k.osei@gmail.com',
    role: 'backend-senior', archetype: 'hire', pending: true,
    invitedDaysAgo: 3, completedDaysAgo: 0.9,
    facts: { title: 'Backend Engineer', company: 'Ondo Systems', years: 6 },
    answers: [
      "A queue consumer started falling behind during a traffic spike and messages backed up for almost two hours before anyone noticed, because our alert threshold was set too high. I fixed the immediate backlog by scaling consumers horizontally, then went back and lowered the alert threshold and added a queue-depth dashboard so it wouldn't go unnoticed again.",
      "For anything that needs to scale I try to figure out the hot path first and design so that path stays simple, even if it means more complexity elsewhere. At Ondo we split our write path into a thin synchronous layer and pushed everything non-critical into async jobs — that alone bought us a lot of headroom without a rewrite.",
      "I disagreed with a decision to deprecate an internal library everyone depended on, in favor of a rewrite from scratch. I wrote up the migration cost with rough estimates per team and shared it in our engineering channel. We ended up doing an incremental migration instead of a rewrite, which I think was the right call.",
      "Meridian Cloud's growth stage is exactly where I want to be — enough scale that problems are real, not hypothetical. First 90 days, I'd want to have shipped something and to understand where the actual bottlenecks in the system are, not just the documented ones.",
    ],
    score: {
      score: 8.0, confidence: 81,
      summary: 'Strong scaling and incident instincts with a good habit of writing up tradeoffs before pushing back, rather than relitigating in meetings. Ready for a same-day decision.',
      strengths: [
        { title: 'Fixes root cause, not just symptom', evidence: 'lowered the alert threshold and added a queue-depth dashboard so it wouldn\'t go unnoticed again' },
        { title: 'Data-driven disagreement', evidence: 'I wrote up the migration cost with rough estimates per team and shared it in our engineering channel' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 61 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Wei Zhang', email: 'wei.zhang.eng@icloud.com',
    role: 'backend-senior', archetype: 'ongoing',
    invitedDaysAgo: 6,
  },

  // ── Frontend Engineer ────────────────────────────────────
  {
    name: 'Isabela Duarte', email: 'isabela.duarte.dev@gmail.com',
    role: 'frontend-mid', archetype: 'strong-hire',
    invitedDaysAgo: 61, completedDaysAgo: 60.6,
    facts: { title: 'Frontend Engineer', company: 'Driftwood Media', years: 5 },
    answers: [
      "I rebuilt our video upload flow, which used to be a single giant form that lost your progress if your connection dropped. The hard part wasn't the UI, it was designing chunked, resumable uploads on the client and keeping the progress state honest even when a chunk failed and retried. Upload completion rate went from around 71% to 96% after it shipped.",
      "Accessibility isn't a checklist I run at the end — I build with keyboard navigation and screen reader labels from the first draft, because retrofitting it is always more expensive. For performance, I default to code-splitting anything below the fold and measuring with real device profiles, not just desktop Chrome.",
      "A senior engineer left a review saying my component was over-abstracted for what it needed to do — three layers of wrapper components for one use case. My first reaction was defensive, but I sat with it overnight, and he was right. I collapsed it to one component and it was genuinely easier to read.",
      "I do my best work with direct, specific feedback and a team that argues about the work, not each other. I don't need consensus on everything, just a clear owner for the final call.",
    ],
    score: {
      score: 9.0, confidence: 89,
      summary: 'Excellent frontend candidate — ships measurable UX improvements, treats accessibility as a first-class constraint rather than an afterthought, and takes critical feedback with real self-reflection.',
      strengths: [
        { title: 'Ships with measurable impact', evidence: 'Upload completion rate went from around 71% to 96% after it shipped' },
        { title: 'Accessibility built in, not bolted on', evidence: 'I build with keyboard navigation and screen reader labels from the first draft' },
        { title: 'Genuinely receptive to feedback', evidence: 'I sat with it overnight, and he was right. I collapsed it to one component' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 55 words)' },
        { polarity: '+', label: 'Answered every question' },
      ],
    },
  },
  {
    name: 'Tom Fitzgerald', email: 'tom.fitzgerald.uk@gmail.com',
    role: 'frontend-mid', archetype: 'hold',
    invitedDaysAgo: 42, completedDaysAgo: 41.4,
    facts: { title: 'Frontend Developer', company: 'Applecart Retail', years: 3 },
    answers: [
      "I built a filter sidebar for our product listing page. It had a lot of edge cases with combined filters. It was hard but we got it done before the deadline.",
      "I usually check Lighthouse scores before shipping. I haven't worked with screen readers much myself so I mostly rely on our design system components already being accessible.",
      "I got feedback that my PR was too large to review properly. I said sorry and split it into smaller ones for the rest of that project.",
      "I like a team that's friendly and doesn't have too many meetings.",
    ],
    score: {
      score: 5.6, confidence: 61,
      summary: 'Answers are generic and short on specifics — no metrics on the filter sidebar project, and accessibility knowledge leans entirely on the design system rather than personal understanding. Responsive to feedback but nothing distinctive yet.',
      strengths: [
        { title: 'Corrects course after feedback', evidence: 'I said sorry and split it into smaller ones for the rest of that project' },
      ],
      concerns: [
        { title: 'No outcome or metric given for shipped work', evidence: 'It was hard but we got it done before the deadline' },
        { title: 'Limited personal accessibility knowledge', evidence: "I haven't worked with screen readers much myself" },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 17 words)' },
        { polarity: '-', label: 'Skipped or hedged 25% of questions' },
      ],
    },
  },
  {
    name: 'Ravi Chandran', email: 'ravi.chandran19@yahoo.com',
    role: 'frontend-mid', archetype: 'reject',
    invitedDaysAgo: 56, completedDaysAgo: 55.5,
    facts: { title: 'Junior Frontend Developer', company: 'Quillette', years: 1 },
    answers: [
      "I made a landing page once for a small campaign. It used React.",
      "I don't really have a process, I just try to make it look good and fast.",
      "I haven't gotten much code review feedback yet, my team is small.",
      "I need a job basically, and this looked like a decent one.",
    ],
    score: {
      score: 2.6, confidence: 63,
      summary: 'No concrete project detail, no accessibility or performance process, and motivation given is generic. Not ready for this level of role.',
      strengths: [],
      concerns: [
        { title: 'No process or specifics offered', evidence: "I don't really have a process, I just try to make it look good and fast" },
        { title: 'Unclear, low-signal motivation', evidence: 'I need a job basically, and this looked like a decent one' },
      ],
      confidence_reasons: [
        { polarity: '-', label: '4 substantive answers only' },
        { polarity: '-', label: 'Short answers (median 11 words)' },
      ],
    },
  },
  {
    name: 'Grace Kim', email: 'grace.kim.frontend@gmail.com',
    role: 'frontend-mid', archetype: 'ongoing',
    invitedDaysAgo: 0.8,
  },

  // ── Product Designer ─────────────────────────────────────
  {
    name: 'Naomi Bell', email: 'naomi.bell.design@gmail.com',
    role: 'product-designer', archetype: 'strong-hire', pending: true,
    invitedDaysAgo: 4, completedDaysAgo: 1.9,
    facts: { title: 'Senior Product Designer', company: 'Trellis HR', years: 7 },
    answers: [
      "I was handed 'onboarding is confusing' with no more detail than that. I shadowed six new customer calls, found that people dropped off specifically at the integrations step, and redesigned that one screen around a guided three-step flow instead of a form. Onboarding completion went from 58% to 84% in the following month, and support tickets tagged 'setup help' dropped by half.",
      "Engineering pushed back on a drag-and-drop interaction I designed, saying it would take three sprints to build. Instead of digging in, I asked what a one-sprint version could look like, and we found a click-to-reorder pattern that got 80% of the value for a fraction of the cost. I'd rather ship something real than defend a pixel-perfect idea that never ships.",
      "I use research to find the problem, but I trust instinct more once we're choosing between two reasonable solutions — at that point user testing on click-through rates and a few unmoderated sessions usually tells me more than another round of interviews would.",
      "Dieter Rams' work, honestly — the restraint. Most design work adds; his subtracted until only the necessary thing was left. I think about that a lot when I'm tempted to add one more explanatory tooltip instead of just fixing the confusing thing.",
    ],
    score: {
      score: 9.2, confidence: 88,
      summary: 'Outstanding senior designer — grounds every claim in a real before/after metric, and handles engineering pushback by finding the cheaper version instead of defending scope.',
      strengths: [
        { title: 'Research-grounded, metric-backed outcomes', evidence: 'Onboarding completion went from 58% to 84% in the following month' },
        { title: 'Collaborative under engineering pushback', evidence: 'I asked what a one-sprint version could look like, and we found a click-to-reorder pattern that got 80% of the value' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 62 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Julian Ortiz', email: 'julian.ortiz.design@gmail.com',
    role: 'product-designer', archetype: 'hire',
    invitedDaysAgo: 26, completedDaysAgo: 25.5,
    facts: { title: 'Product Designer', company: 'Ambient Studio', years: 4 },
    answers: [
      "I redesigned our settings page, which had grown organically into eleven unrelated sections. I grouped them by task instead of by feature area and added search. Time-to-find-setting in our usability tests dropped by about half, from roughly 40 seconds to 20.",
      "Product wanted to cut a confirmation step I'd added before a destructive action, to reduce friction. I agreed to test it — we shipped both versions to different cohorts, and the version without confirmation had a 3x higher accidental-deletion support ticket rate, so we kept it. Good outcome, though I probably should have pushed harder up front instead of needing the A/B test to prove it.",
      "I lean on data more for validating between two close options, and instinct for the first divergent pass — I don't think either alone gets you there.",
      "Notion's early product, back when it was simpler — I admire how much it did with so few primitives.",
    ],
    score: {
      score: 7.6, confidence: 78,
      summary: 'Good instincts and comfortable proving decisions with data, though somewhat conflict-averse — chose to A/B test rather than advocate directly for a UX safeguard he clearly believed in.',
      strengths: [
        { title: 'Uses data to settle disagreements', evidence: 'the version without confirmation had a 3x higher accidental-deletion support ticket rate, so we kept it' },
      ],
      concerns: [
        { title: 'Somewhat conflict-averse on convictions', evidence: 'I probably should have pushed harder up front instead of needing the A/B test to prove it' },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '+', label: 'Clear delivery' },
      ],
    },
  },
  {
    name: 'Camille Laurent', email: 'camille.laurent.ux@outlook.com',
    role: 'product-designer', archetype: 'hold',
    invitedDaysAgo: 33, completedDaysAgo: 32.5,
    facts: { title: 'UX Designer', company: 'Fathom Insurance', years: 2 },
    answers: [
      "I worked on a claims form redesign. It had too many fields so I removed some. It looked cleaner after.",
      "Engineering said one of my screens wasn't feasible in the timeline. I simplified it a bit to match what they could build.",
      "Mostly instinct honestly, I don't have much research experience yet.",
      "Figma's design is nice, the way everything just works together.",
    ],
    score: {
      score: 5.0, confidence: 54,
      summary: 'Directionally fine instincts but no outcomes or metrics behind any claim, and admits limited research experience directly. Junior for this req.',
      strengths: [],
      concerns: [
        { title: 'No outcome data on shipped work', evidence: 'It looked cleaner after' },
        { title: 'Little research experience', evidence: "I don't have much research experience yet" },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 15 words)' },
        { polarity: '-', label: 'Some contradictions noted' },
      ],
    },
  },
  {
    name: 'Ahmed Farouk', email: 'ahmed.farouk.design@gmail.com',
    role: 'product-designer', archetype: 'ongoing',
    invitedDaysAgo: 2.3,
  },

  // ── Customer Success Manager ─────────────────────────────
  {
    name: 'Sofia Marchetti', email: 'sofia.marchetti.cs@gmail.com',
    role: 'csm', archetype: 'hire',
    invitedDaysAgo: 71, completedDaysAgo: 70.6,
    facts: { title: 'Senior CSM', company: 'Hearth Financial', years: 6 },
    answers: [
      "An enterprise account went quiet for three weeks after their champion left the company — no responses, usage dropping. I found the new department head through LinkedIn, requested a 15-minute call with no agenda beyond understanding their priorities, and discovered they didn't know half our feature set existed. We ran a re-onboarding session and they renewed at the same tier six weeks later.",
      "I slow down, not speed up. I acknowledge specifically what went wrong before offering any solution — customers escalating usually just want to know someone actually read what they wrote, not get a templated apology.",
      "I come in with their usage data already analyzed, two or three specific wins tied to their stated goals, and one honest gap where we underdelivered. QBRs that are just a status report lose the room in the first five minutes.",
      "Three months in, I'd want to own a portfolio, know every account's renewal risk without checking a spreadsheet, and have already turned around one at-risk account.",
    ],
    score: {
      score: 7.9, confidence: 80,
      summary: 'Strong CSM with a genuine save story that shows real initiative — going around a dead champion relationship rather than waiting for the account to respond.',
      strengths: [
        { title: 'Proactive relationship rebuilding', evidence: 'I found the new department head through LinkedIn, requested a 15-minute call with no agenda' },
        { title: 'Structured, honest QBR approach', evidence: 'two or three specific wins tied to their stated goals, and one honest gap where we underdelivered' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 51 words)' },
        { polarity: '+', label: 'Answered every question' },
      ],
    },
  },
  {
    name: 'Andre Thompson', email: 'andre.thompson.cs@gmail.com',
    role: 'csm', archetype: 'strong-hire',
    invitedDaysAgo: 90, completedDaysAgo: 89.5,
    facts: { title: 'CSM Team Lead', company: 'Pinecrest Logistics', years: 8 },
    answers: [
      "A mid-market account was two weeks from a cancellation email — I could see it in their support ticket tone. I got on a call, didn't defend the product, just asked what would need to be true for this to be worth keeping. Turned out their real issue was a single broken integration nobody had escalated properly. I personally tracked it through engineering, gave them daily updates even when there was no update, and they stayed. That account is now one of our largest.",
      "First, I mirror their tone down — I don't match heat with heat. Then I ask one clarifying question before anything else, because escalating customers often lead with the symptom, not the actual problem.",
      "I open with their goals, not our metrics — what were they trying to achieve last quarter, did we help them get there, and if not, why not, in plain language. I bring the renewal conversation up front, not as a surprise at the end.",
      "Owning renewal forecasting for my whole book with real confidence, and having already run at least one QBR that changed how an account thought about us.",
    ],
    score: {
      score: 8.9, confidence: 87,
      summary: 'Excellent — de-escalation instinct, genuine ownership through to resolution, and a QBR philosophy that leads with the customer\'s goals rather than a vendor status update.',
      strengths: [
        { title: 'Owns the problem to resolution', evidence: 'I personally tracked it through engineering, gave them daily updates even when there was no update' },
        { title: 'Leads with customer goals, not vendor metrics', evidence: 'I open with their goals, not our metrics' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 60 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Lindiwe Mokoena', email: 'lindiwe.mokoena.cs@gmail.com',
    role: 'csm', archetype: 'reject',
    invitedDaysAgo: 78, completedDaysAgo: 77.6,
    facts: { title: 'Support Associate', company: 'Cascade Freight', years: 1 },
    answers: [
      "I haven't had a customer actually churn on me yet, my role is mostly support tickets.",
      "I usually just forward escalations to my manager.",
      "I've never run a QBR before, that's not something we do in my current role.",
      "This seemed like a step up from support into a CSM title.",
    ],
    score: {
      score: 2.9, confidence: 71,
      summary: 'No direct CSM experience — churn prevention, escalation ownership, and QBR questions all answered with "haven\'t done this." Not ready for the role as scoped.',
      strengths: [],
      concerns: [
        { title: 'No churn-save experience to draw on', evidence: "I haven't had a customer actually churn on me yet" },
        { title: 'Escalates rather than owns', evidence: 'I usually just forward escalations to my manager' },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '-', label: 'Short answers (median 14 words)' },
      ],
    },
  },
  {
    name: 'Ben Carter', email: 'ben.carter.cs@gmail.com',
    role: 'csm', archetype: 'ongoing',
    invitedDaysAgo: 7,
  },

  // ── Account Executive (paused) ───────────────────────────
  {
    name: 'Jordan Reyes', email: 'jordan.reyes.sales@gmail.com',
    role: 'account-executive', archetype: 'hire',
    invitedDaysAgo: 118, completedDaysAgo: 117.4,
    facts: { title: 'Account Executive', company: 'Verity Labs', years: 5 },
    answers: [
      "A seven-figure deal with a healthcare company had four stakeholders across security, finance, procurement, and the actual end users, and it dragged for five months mostly on security review. I built a single shared doc tracking every open question and owner so nothing died in someone's inbox, and I looped in our security team directly instead of relaying questions secondhand. It closed, and the security lead later became a reference for two other deals.",
      "Lost a deal to a competitor who undercut on price by about 30%. In hindsight I hadn't built a strong enough champion internally — when the CFO pushed for the cheaper option, nobody on their side fought for us. I now spend more time in deals making sure someone internally would lose something real if they chose the other option.",
      "I ask what happens if they do nothing — if the honest answer is 'not much changes,' it's not a real deal yet regardless of how friendly the conversation is.",
      "I don't discount first, I re-anchor on value and ask what specifically is driving the price conversation — sometimes it's budget timing, not actually the price.",
    ],
    score: {
      score: 7.7, confidence: 79,
      summary: 'Strong process on complex, multi-stakeholder deals, and shows real reflection on a loss rather than blaming price alone.',
      strengths: [
        { title: 'Owns stakeholder complexity directly', evidence: 'I looped in our security team directly instead of relaying questions secondhand' },
        { title: 'Learns from losses beyond price', evidence: "I hadn't built a strong enough champion internally" },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 53 words)' },
        { polarity: '+', label: 'Answered every question' },
      ],
    },
  },
  {
    name: 'Katarzyna Nowak', email: 'katarzyna.nowak.sales@gmail.com',
    role: 'account-executive', archetype: 'hold',
    invitedDaysAgo: 124, completedDaysAgo: 123.5,
    facts: { title: 'SDR', company: 'Marrow Data', years: 2 },
    answers: [
      "I helped close a deal but it wasn't really my deal, I was supporting the AE on it.",
      "I haven't lost a deal solo yet since I've mostly been in an SDR role, sourcing meetings.",
      "I look at company size and whether they replied to my first email honestly.",
      "I match their energy usually, and try to find a discount that works.",
    ],
    score: {
      score: 4.8, confidence: 60,
      summary: 'Mostly SDR-level experience without solo deal ownership. Qualification and negotiation answers are surface-level. Possible for a more junior AE ramp, not this req as scoped.',
      strengths: [],
      concerns: [
        { title: 'No solo deal ownership yet', evidence: "it wasn't really my deal, I was supporting the AE on it" },
        { title: 'Leads with discounting by default', evidence: 'I match their energy usually, and try to find a discount that works' },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 16 words)' },
      ],
    },
  },
  {
    name: 'Miles Donovan', email: 'miles.donovan.sales@gmail.com',
    role: 'account-executive', archetype: 'reject',
    invitedDaysAgo: 129, completedDaysAgo: 128.6,
    facts: { title: 'Retail Sales Associate', company: 'Applecart Retail', years: 1 },
    answers: [
      "I've sold electronics in a retail store, not B2B software, but I'm a fast learner.",
      "Never lost a deal in the B2B sense, I mean I've had customers not buy in the store.",
      "I don't really have a qualification process, I just talk to whoever walks in.",
      "I just push for the sale honestly, whatever gets them to say yes.",
    ],
    score: {
      score: 2.1, confidence: 68,
      summary: 'No B2B sales experience at all, and the closing approach described ("whatever gets them to say yes") is a mismatch for the deal complexity this role requires.',
      strengths: [],
      concerns: [
        { title: 'No B2B experience', evidence: "I've sold electronics in a retail store, not B2B software" },
        { title: 'Concerning closing philosophy', evidence: 'I just push for the sale honestly, whatever gets them to say yes' },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '-', label: 'Short answers (median 13 words)' },
      ],
    },
  },

  // ── Data Analyst (archived — role filled) ────────────────
  {
    name: 'Aditi Bhatt', email: 'aditi.bhatt.data@gmail.com',
    role: 'data-analyst', archetype: 'strong-hire',
    invitedDaysAgo: 152, completedDaysAgo: 151.5,
    facts: { title: 'Senior Data Analyst', company: 'Northfield Robotics', years: 5 },
    answers: [
      "I found that our biggest churn cohort wasn't low-usage accounts, as everyone assumed, but accounts that used exactly one feature heavily and nothing else — they'd hit its ceiling and leave. That reframed our whole retention roadmap from 'drive more usage' to 'drive usage breadth,' and the team built a cross-feature onboarding nudge because of it. Churn in that cohort dropped about 15% over the next two quarters.",
      "I always title the chart with the takeaway, not the metric name — 'Signups are down because of a pricing page change,' not 'Signups over time.' I also stress test with the most literal-minded person on the team before sending anything wide.",
      "I'd segment immediately by acquisition channel, platform, and geography to see if the drop is broad or concentrated, check for a deploy or pricing change around the same timestamp, and only escalate as 'real' after ruling out a tracking or instrumentation break, which is a surprisingly common false alarm.",
      "SQL and Python daily, dbt for anything that needs to be trusted long-term. I'm still building depth in proper experimentation design — I can run an A/B test but I'd want a stats-minded partner for anything with tricky power or novelty effects.",
    ],
    score: {
      score: 9.0, confidence: 86,
      summary: 'Excellent analyst — reframed a core retention assumption with a genuinely non-obvious insight and quantified impact, plus a disciplined, skeptical instinct when investigating anomalies.',
      strengths: [
        { title: 'Non-obvious, high-impact insight', evidence: "Churn in that cohort dropped about 15% over the next two quarters" },
        { title: 'Skeptical, rigorous anomaly process', evidence: 'only escalate as \'real\' after ruling out a tracking or instrumentation break' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 57 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Chris Bellamy', email: 'chris.bellamy.data@gmail.com',
    role: 'data-analyst', archetype: 'hire', statusOverride: 'rejected',
    invitedDaysAgo: 148, completedDaysAgo: 147.4,
    facts: { title: 'Data Analyst', company: 'Loopwave', years: 3 },
    answers: [
      "I noticed our sales team was prioritizing leads by company size alone, but when I ran the numbers, lead source was a far stronger predictor of close rate. We re-ranked the queue by predicted close probability instead, and win rate on top-priority leads went up about 9%.",
      "I add a plain-English summary line above every chart and try to get one person outside the data team to read it before I ship it wide — jargon creeps in without realizing it.",
      "Check for a tracking break first, then segment by channel and platform to isolate where it's coming from, then look at what changed around that time.",
      "SQL and Looker mostly. I'm weaker on Python for anything beyond basic scripting — I can get by but it's not a strength yet.",
    ],
    score: {
      score: 7.2, confidence: 74,
      summary: 'Solid, honest analyst — real quantified win, sound anomaly-investigation instincts, and upfront about a Python gap rather than overselling it.',
      strengths: [
        { title: 'Quantified business impact', evidence: 'win rate on top-priority leads went up about 9%' },
      ],
      concerns: [
        { title: 'Limited Python depth for the role', evidence: "I'm weaker on Python for anything beyond basic scripting" },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '+', label: 'Clear delivery' },
      ],
    },
  },
  {
    name: 'Yuki Tanaka', email: 'yuki.tanaka.data@gmail.com',
    role: 'data-analyst', archetype: 'hold', statusOverride: 'rejected',
    invitedDaysAgo: 155, completedDaysAgo: 154.6,
    facts: { title: 'Junior Analyst', company: 'Solstice Bank', years: 1 },
    answers: [
      "I made a report that showed monthly sales. People used it in meetings.",
      "I try to make the chart look clean and not too crowded.",
      "I'd probably ask my manager what to check first honestly.",
      "Excel mostly, and I'm learning SQL right now.",
    ],
    score: {
      score: 4.5, confidence: 55,
      summary: 'Early-career with limited tooling depth (still learning SQL) and no example of a report that changed a decision, just one that was used. Not ready for this scope.',
      strengths: [],
      concerns: [
        { title: 'Limited tooling for the role', evidence: "Excel mostly, and I'm learning SQL right now" },
        { title: 'No investigation process of her own yet', evidence: "I'd probably ask my manager what to check first honestly" },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 12 words)' },
      ],
    },
  },
  {
    name: 'Sam Whitfield', email: 'sam.whitfield.data@gmail.com',
    role: 'data-analyst', archetype: 'reject', statusOverride: 'rejected',
    invitedDaysAgo: 158, completedDaysAgo: 157.5,
    facts: { title: 'Warehouse Coordinator', company: 'Cascade Freight', years: 2 },
    answers: [
      "I track inventory counts in a spreadsheet at my current job.",
      "I just make sure the numbers add up before sending it.",
      "I'd probably just re-check the spreadsheet for typos first.",
      "I don't really use SQL, mostly Excel formulas.",
    ],
    score: {
      score: 2.4, confidence: 66,
      summary: 'No analytical tooling or experience beyond spreadsheet upkeep. Well below the bar for this role.',
      strengths: [],
      concerns: [
        { title: 'No SQL or analytical tooling experience', evidence: "I don't really use SQL, mostly Excel formulas" },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 10 words)' },
      ],
    },
  },

  // ── DevOps Engineer (archived — role filled) ─────────────
  {
    name: 'Oluwaseun Adeyemi', email: 'seun.adeyemi.devops@gmail.com',
    role: 'devops', archetype: 'strong-hire',
    invitedDaysAgo: 172, completedDaysAgo: 171.4,
    facts: { title: 'Staff SRE', company: 'Brightpath Health', years: 8 },
    answers: [
      "A misconfigured autoscaling policy scaled our primary database's connection-heavy service down during peak traffic instead of up, because of an inverted metric threshold from a config migration. We were down for 47 minutes. Afterward I didn't just fix the threshold — I added a staging canary that runs every config change against synthetic peak-traffic load before it can reach production, and we haven't had a repeat of that class of incident since.",
      "I default to feature-flagged, reversible changes over big-bang ones, and I ask what the rollback actually looks like before I ask what the change looks like. If a change can't be safely rolled back in under five minutes, I want extra eyes on it regardless of how confident I am.",
      "I'd start with the highest-leverage, lowest-risk cuts first — rightsizing over-provisioned instances and cleaning up orphaned resources, which usually gets you halfway there with zero reliability risk. Only after that would I look at reserved instance commitments or architectural changes, since those carry real tradeoffs.",
      "On-call that doesn't punish people for the system being imperfect — a blameless postmortem culture, and a bar that pages are for things that actually need a human right now, not noise.",
    ],
    score: {
      score: 9.3, confidence: 91,
      summary: 'Outstanding senior DevOps candidate — owns incidents past the immediate fix into systemic prevention, and has a clear, low-risk-first framework for cost reduction.',
      strengths: [
        { title: 'Fixes the class of problem, not just the incident', evidence: 'I added a staging canary that runs every config change against synthetic peak-traffic load before it can reach production' },
        { title: 'Risk-ordered cost-cutting framework', evidence: 'I\'d start with the highest-leverage, lowest-risk cuts first — rightsizing over-provisioned instances and cleaning up orphaned resources' },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 63 words)' },
        { polarity: '+', label: 'Consistent reasoning' },
      ],
    },
  },
  {
    name: 'Petra Novakova', email: 'petra.novakova.devops@gmail.com',
    role: 'devops', archetype: 'hire', statusOverride: 'rejected',
    invitedDaysAgo: 167, completedDaysAgo: 166.5,
    facts: { title: 'DevOps Engineer', company: 'Coilcraft', years: 4 },
    answers: [
      "A cert expired on an internal service with no alerting on expiry, taking down inter-service auth for about 25 minutes. I set up automated cert renewal with a 30-day-before alert, and audited every other cert in the fleet for the same gap the same week.",
      "I try to keep changes small and reversible, but I'll admit I've shipped a couple of larger infra changes without a clean rollback plan when I was confident and under time pressure — it's worked out so far but I know that's a habit to watch.",
      "Right-sizing instances and cleaning up unused resources first, since it's close to free reliability-wise, then looking at reserved capacity commitments.",
      "Blameless postmortems and clear escalation paths so on-call doesn't feel like you're alone at 3am.",
    ],
    score: {
      score: 7.3, confidence: 75,
      summary: 'Solid instincts and a genuine fix-the-root-cause habit, but self-reports occasionally skipping rollback planning under time pressure — worth probing further in a follow-up conversation.',
      strengths: [
        { title: 'Closes the gap fleet-wide, not just locally', evidence: 'audited every other cert in the fleet for the same gap the same week' },
      ],
      concerns: [
        { title: 'Has skipped rollback planning under pressure', evidence: "I've shipped a couple of larger infra changes without a clean rollback plan when I was confident and under time pressure" },
      ],
      confidence_reasons: [
        { polarity: '+', label: 'Answered every question' },
        { polarity: '-', label: 'Some contradictions noted' },
      ],
    },
  },
  {
    name: 'Diego Alvarez', email: 'diego.alvarez.ops@gmail.com',
    role: 'devops', archetype: 'hold', statusOverride: 'rejected',
    invitedDaysAgo: 175, completedDaysAgo: 174.6,
    facts: { title: 'IT Support Engineer', company: 'Trellis HR', years: 2 },
    answers: [
      "We had a server go down once. I restarted it and it came back.",
      "I try to be careful with changes and test them if I can.",
      "I'd probably look at the biggest servers first and see if we need them all.",
      "On-call should be fair, everyone taking a turn.",
    ],
    score: {
      score: 4.6, confidence: 52,
      summary: 'Answers are thin and reactive rather than systems-oriented — the outage story has no root cause and no prevention step. IT support background, not yet DevOps-ready for this scope.',
      strengths: [],
      concerns: [
        { title: 'No root cause or prevention on the outage', evidence: 'I restarted it and it came back' },
        { title: 'No systematic change process described', evidence: 'I try to be careful with changes and test them if I can' },
      ],
      confidence_reasons: [
        { polarity: '-', label: 'Short answers (median 13 words)' },
      ],
    },
  },

  // ── Support Specialist ────────────────────────────────────
  {
    name: 'Hana Suzuki', email: 'hana.suzuki.support@gmail.com',
    role: 'support-specialist', archetype: 'hire', pending: true,
    invitedDaysAgo: 2, completedDaysAgo: 0.3,
    facts: { title: 'Support Agent', company: 'Driftwood Media', years: 2 },
    answers: [
      "A customer was furious their export had been failing silently for two weeks and they'd lost a report they needed for a board meeting. I stayed on the call while I dug in myself instead of passing them to a queue, found the export was hitting a size limit with no error message, escalated it as a bug that same hour, and personally rebuilt their missing report from raw data so they had something for the meeting the next morning. They left us a five-star review afterward.",
      "I triage by impact first, not loudness — a quiet ticket about a billing overcharge outranks a loud one about a cosmetic UI complaint. I timebox anything I'm stuck on to ten minutes before looping in someone senior, so nothing quietly rots in my queue.",
      "A customer asked about a data export format we didn't officially support yet. I told them honestly I didn't know, said I'd find out, and came back within the hour with an answer from engineering rather than guessing and being wrong.",
      "I like the problem-solving part of support more than most people expect to — and Meridian Cloud's product is complex enough that every ticket is actually different, which appeals to me over more repetitive support work I've done before.",
    ],
    score: {
      score: 7.8, confidence: 77,
      summary: 'Strong support instincts for an entry-level candidate — owns problems personally rather than deflecting to a queue, and is honest rather than guessing when she doesn\'t know something.',
      strengths: [
        { title: 'Owns the problem instead of deflecting', evidence: 'I stayed on the call while I dug in myself instead of passing them to a queue' },
        { title: 'Honest under pressure, not evasive', evidence: "I told them honestly I didn't know, said I'd find out" },
      ],
      concerns: [],
      confidence_reasons: [
        { polarity: '+', label: 'Detailed responses (median 56 words)' },
        { polarity: '+', label: 'Answered every question' },
      ],
    },
  },
  {
    name: 'Leo Bianchi', email: 'leo.bianchi.support@gmail.com',
    role: 'support-specialist', archetype: 'ongoing',
    invitedDaysAgo: 0.85,
  },
  {
    name: 'Fatima Zahra', email: 'fatima.zahra.support@gmail.com',
    role: 'support-specialist', archetype: 'ongoing',
    invitedDaysAgo: 11,
  },
]

/* ─────────────────────────────────────────────────────────────
 * Recruiter notes — a handful of candidate-level and
 * question-level notes on decided candidates, for realism.
 * questionIndex references ROLES[].questions by index, or null
 * for a candidate-level note.
 * ────────────────────────────────────────────────────────── */
export const NOTES = [
  { candidate: 'Priya Raghavan', questionIndex: null, body: 'Panel loved her. Fast-tracking to offer — check comp band with finance before we lose her to a counter.', ageDaysAgo: 44 },
  { candidate: 'Priya Raghavan', questionIndex: 1, body: 'The billing idempotency example is exactly the kind of ownership we need on the payments team.', ageDaysAgo: 45 },
  { candidate: 'Marcus Webb', questionIndex: null, body: 'Good enough to move forward but want a second technical round before an offer — the caching instinct needs a closer look.', ageDaysAgo: 19 },
  { candidate: 'Isabela Duarte', questionIndex: null, body: 'Reference check confirmed the upload completion metric independently. Moving to offer.', ageDaysAgo: 58 },
  { candidate: 'Naomi Bell', questionIndex: 0, body: 'This onboarding story is portfolio-quality. Want her to walk the team through it live in the next round.', ageDaysAgo: 1 },
  { candidate: 'Andre Thompson', questionIndex: null, body: 'Strongest CSM candidate we\'ve seen in this search. Moving straight to team lead panel.', ageDaysAgo: 88 },
  { candidate: 'Aditi Bhatt', questionIndex: null, body: 'Hired — start date confirmed for the following month. Closing req.', ageDaysAgo: 148 },
  { candidate: 'Oluwaseun Adeyemi', questionIndex: null, body: 'Hired. Best incident-response answer we\'ve had in any DevOps search this year.', ageDaysAgo: 169 },
  { candidate: 'Chris Bellamy', questionIndex: null, body: 'Strong runner-up — kept on file for the next data analyst opening.', ageDaysAgo: 146 },
]

/* ─────────────────────────────────────────────────────────────
 * Billing story — "several months of an active, paying customer".
 * Plan key is resolved at seed time against whatever the live
 * `plans` table actually has (see seed-demo.mjs); this just
 * describes the timeline and preference order.
 * ────────────────────────────────────────────────────────── */
export const SUBSCRIPTION_STORY = {
  trialStartedDaysAgo: 184,
  upgradedDaysAgo: 170,
  // Preference order for which plan to land the demo workspace on —
  // first key present and active in the live `plans` table wins.
  preferredPlanKeys: ['enterprise', 'scale', 'growth'],
  // Monthly renewal events since the upgrade, most-recent-first is not
  // required — seed-demo.mjs just needs the count and spacing.
  renewalCycleDays: 30,
}

export { bandForConfidence }

