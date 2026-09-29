# Clario Design System

**Status:** Founding production specification  
**Version:** 2.0  
**Product source of truth:** [Product Requirements Document](./prd.md)  
**Technical source of truth:** [System Architecture](./architecture.md)

> This document defines how Clario should look, behave, and communicate. It does not change product scope, contract behavior, routes, provider choices, or data ownership.

## Repository audit

This specification began as a founding design contract. The repository now contains a Next.js application, product routes and components, and a partial implementation of the design foundation. `MEMORY.md` and `TASKS.md` record verified implementation state; this file remains the target contract and must not be read as a claim that every design requirement is already implemented.

Clario is a verifiable expense workflow for crypto teams: private evidence, immutable expense versions, scoped human approval, Monad reimbursement, and independent verification. Markets, wagers, trading positions, and generic protocol analytics are outside the approved MVP. Related patterns below are explicitly conditional and must not be implemented until the PRD and architecture authorize them.

---

## 1. Design North Star

Clario’s visual identity is **Evidence Ledger**: a calm, exact interface where private business context and public proof are easy to distinguish and follow.

The product should feel:

- **Clean:** hierarchy comes from alignment, spacing, typography, and rules before containers.
- **Premium:** details are deliberate; nothing depends on glow, novelty, or excess.
- **Technical:** versions, hashes, roles, chain state, and provenance are legible without dominating the human task.
- **Trustworthy:** the UI states what is known, pending, and impossible to prove.
- **Fast:** important work is visible immediately, and motion never delays action.
- **Intelligence-driven:** AI reduces effort, shows sources and uncertainty, and remains subordinate to human authority.
- **Web3-native:** wallet intent, chain, contract, finality, and explorer evidence are product concepts—not decoration.
- **Professional:** operators, builders, auditors, protocol teams, and judges can understand state without visual theater.

The core move is **progressive proof**. Start with the user’s task and reveal technical evidence when it answers a question. A reviewer sees the exact version before signing. Treasury sees approved versus prepared values before payment. A verifier sees each deterministic check and its source.

| Dial | Value | Meaning |
|---|---:|---|
| Variance | 5/10 | Asymmetry creates hierarchy; task structure stays predictable |
| Motion | 4/10 | Smooth continuity and state feedback; no spectacle |
| Density | 6/10 | Compact operational lists; spacious decisions and proof |

## 2. Visual Personality

Clario is composed, lucid, and quietly technical. It should create confidence without pretending certainty, and urgency without anxiety.

- **Control:** the current version, authority, and next safe action are visible.
- **Clarity:** private facts, AI suggestions, onchain records, and verified conclusions never blur together.
- **Confidence:** precise language and stable layouts reduce hesitation during signing and payment.
- **Healthy caution:** warnings explain impact and recovery rather than using alarmist decoration.
- **Proof:** every important state can reveal its source, timestamp, actor, and exact record.

Clario does not use token tickers as decoration, neon-on-black trading surfaces, glowing balance cards, speculative price motion, or wallet-first information architecture. The main object is an expense record and its authority chain—not a token or market.

Intelligence is communicated through evidence, attribution, confidence bands, and comparison—not sparkles or chat bubbles. Risk is a named condition, consequence, affected version, and recovery action—not a red glow. Uncertainty is a range or plain-language qualifier. Proof uses the **Proof Spine** and **Commitment Stamp**.

The interface must never resemble a casino, meme app, sci-fi control room, generic AI landing page, or templated admin dashboard.

## 3. Color System

Use cold graphite foundations, white working surfaces, one signature cobalt accent, and a muted iris analytical accent. Green, amber, and red exist only for semantic status.

### 3.1 Core tokens

```css
:root {
  color-scheme: light;
  --background-primary: #f4f6f8;
  --background-secondary: #eef1f4;
  --background-elevated: #ffffff;
  --surface-card: #ffffff;
  --surface-card-hover: #f0f3f7;
  --surface-disabled: #e8ecf1;
  --surface-selected: #e8eeff;
  --surface-drag-target: #dce6ff;
  --border-subtle: #d7dde5;
  --border-strong: #a9b3c0;
  --text-primary: #101318;
  --text-secondary: #46515f;
  --text-muted: #667180;
  --text-disabled: #77818e;
  --accent-primary: #2457f5;
  --accent-primary-hover: #1947d8;
  --accent-primary-strong: #1036a9;
  --accent-secondary: #6758b8;
  --accent-secondary-hover: #55479f;
  --accent-soft: #e8eeff;
  --accent-secondary-soft: #f0edfb;
  --success-soft: #e1f4ec;
  --success: #087a55;
  --success-hover: #066547;
  --success-strong: #044b36;
  --warning-soft: #fff0d6;
  --warning: #8a5100;
  --warning-hover: #754400;
  --warning-strong: #593300;
  --danger-soft: #fbe8ea;
  --danger: #ad2632;
  --danger-hover: #92202a;
  --danger-strong: #701923;
  --info-soft: #e4f1fb;
  --info: #1b63a8;
  --info-hover: #154f87;
  --info-strong: #103d69;
  --ai-suggested-soft: #f0edf8;
  --ai-suggested: #625887;
  --link: #1746d1;
  --focus: #1746d1;
  --selection: #cbd8ff;
  --scrim: rgb(11 13 16 / 0.52);
}

[data-theme="dark"] {
  color-scheme: dark;
  --background-primary: #0b0d10;
  --background-secondary: #0f1216;
  --background-elevated: #181c22;
  --surface-card: #12151a;
  --surface-card-hover: #191e24;
  --surface-disabled: #20242a;
  --surface-selected: #17234a;
  --surface-drag-target: #1b2b59;
  --border-subtle: #2b313a;
  --border-strong: #566170;
  --text-primary: #f5f7fa;
  --text-secondary: #c7cdd6;
  --text-muted: #a8b0bc;
  --text-disabled: #7e8793;
  --accent-primary: #86a3ff;
  --accent-primary-hover: #a2b7ff;
  --accent-primary-strong: #c7d4ff;
  --accent-secondary: #b7a8f3;
  --accent-secondary-hover: #c9bdf8;
  --accent-soft: #17234a;
  --accent-secondary-soft: #2b273c;
  --success-soft: #12392e;
  --success: #56d6a3;
  --success-hover: #76dfb5;
  --success-strong: #a7ebd1;
  --warning-soft: #3b2b13;
  --warning: #f2b84b;
  --warning-hover: #f7c96f;
  --warning-strong: #ffe0a1;
  --danger-soft: #421d23;
  --danger: #ff8791;
  --danger-hover: #ffa2aa;
  --danger-strong: #ffc5ca;
  --info-soft: #153047;
  --info: #72b7f2;
  --info-hover: #91c8f5;
  --info-strong: #bfdef9;
  --ai-suggested-soft: #2b273c;
  --ai-suggested: #c0b5ea;
  --link: #9ab2ff;
  --focus: #a9bdff;
  --selection: #263a70;
  --scrim: rgb(0 0 0 / 0.68);
}
```

Semantic ramps are ordered `soft → base → hover → strong`. Stronger values darken in light mode and lighten in dark mode. Never derive states with container opacity.

### 3.2 Usage rules

- `background-primary` frames the shell; `surface-card` is the working plane; `background-elevated` is for floating layers.
- Cards default to flat surfaces with `border-subtle`. Use hover surface only on interactive objects.
- Only `accent-primary` fills primary actions. `accent-secondary` is analytical, not a second CTA color.
- Explorer links use `link`, an external-link icon, and a named destination.
- AI suggestions use `ai-suggested` on its soft surface with visible “AI suggested” text. Never reuse warning or proof styling.
- Danger means invalid, failed, or destructive; warning means review, delay, or recoverable mismatch.
- Disabled controls use explicit tokens and native state; never dim a whole component with opacity.
- Use `surface-selected` for selected rows, `selection` for text, and `surface-drag-target` for valid drops.

### 3.3 Measured contrast

Ratios use the WCAG relative-luminance formula and must be recalculated after token changes.

| Foreground on background | Light | Dark | Requirement | Result |
|---|---:|---:|---:|---|
| `text-primary` on `surface-card` | 18.4:1 | 17.1:1 | 4.5:1 | Pass AA/AAA |
| `text-muted` on `surface-card` | 4.95:1 | 8.36:1 | 4.5:1 | Pass AA |
| `accent-primary` on `surface-card` | 5.59:1 | 7.58:1 | 4.5:1 | Pass AA |
| `success` on `success-soft` | 4.68:1 | 6.99:1 | 4.5:1 | Pass AA |
| `warning` on `warning-soft` | 5.74:1 | 7.61:1 | 4.5:1 | Pass AA |
| `danger` on `danger-soft` | 5.75:1 | 6.37:1 | 4.5:1 | Pass AA |
| `info` on `info-soft` | 5.38:1 | 6.32:1 | 4.5:1 | Pass AA |
| `ai-suggested` on its soft surface | 5.57:1 | 7.57:1 | 4.5:1 | Pass AA |
| `text-disabled` on `surface-disabled` | 3.33:1 | 4.29:1 | 3:1 internal | Pass internal target |

Disabled controls are WCAG-exempt, but Clario keeps them above 3:1 and exposes disabled state programmatically.

### 3.4 Color-vision safety

Full-severity protanopia and deuteranopia matrix simulation shows green, amber, and red converge toward olive, yellow-brown, and gray-brown. Hue is not a reliable differentiator.

- Success uses a check icon and “Approved,” “Confirmed,” or “Passed.”
- Warning uses a triangle icon and a named condition.
- Danger uses an octagon/x icon and a named failure.
- Charts combine hue with line style, marker shape, direct labels, and pattern.
- Status badges retain text at 200% zoom and never collapse into colored dots.
- QA inspects the triad under protanopia and deuteranopia simulation in both themes.

## 4. Gradient System

Gradients support hierarchy only. A screen may use at most **one expressive gradient** plus the subtle surface gradient. Never place a gradient behind dense data, body copy, forms, tables, or signing controls.

```css
--gradient-signal: linear-gradient(128deg, #17336f 0%, #2457f5 58%, #86a3ff 100%);
--gradient-proof: linear-gradient(90deg, #2457f5 0%, #1b63a8 52%, #087a55 100%);
--gradient-risk: linear-gradient(90deg, #8a5100 0%, #ad2632 100%);
--gradient-surface: linear-gradient(180deg, rgb(255 255 255 / 0.72) 0%, rgb(244 246 248 / 0.18) 100%);
--gradient-analysis: linear-gradient(115deg, #2457f5 0%, #6758b8 100%);
```

- Signal: marketing hero proof artifact only.
- Proof: a 2–3px verifier edge or progression line.
- Risk: a labeled compact risk-scale track, never a card background.
- Surface: subtle elevation in popovers or marketing artifacts; omit in forced colors.
- Analysis: AI-versus-source visualization, not AI branding.

Never use gradients for text, buttons, badges, page backgrounds, card grids, focus, disabled controls, skeletons, or glow. Function must remain clear when gradients become solid tokens.

## 5. Typography System

```css
--font-display: "Manrope", "Geist Sans", Arial, sans-serif;
--font-body: "Geist Sans", Arial, Helvetica, sans-serif;
--font-mono: "Geist Mono", "SFMono-Regular", Consolas, monospace;
```

Load with `next/font` or self-hosted `@font-face` using `font-display: swap`. Manrope is limited to marketing display and primary page headings. Geist Sans carries working UI. Geist Mono is evidence, not decoration.

| Style | Size / line height | Weight | Use |
|---|---|---:|---|
| H1 | `clamp(2.5rem, 6vw, 5.25rem) / 0.98` | 600 | Marketing; max two lines |
| H2 | `clamp(1.75rem, 3vw, 2.5rem) / 1.08` | 600 | Major marketing section |
| H3 | `1.5rem / 1.2` | 600 | Page or major panel |
| Section title | `1.125rem / 1.35` | 600 | Product section |
| Card title | `0.9375rem / 1.4` | 600 | Working module |
| Body | `0.9375rem / 1.55` | 400 | Default prose |
| Body small | `0.8125rem / 1.5` | 400 | Metadata/helper |
| Label | `0.8125rem / 1.35` | 550 | Form/control label |
| Caption | `0.75rem / 1.4` | 450 | Supplementary metadata |
| Numeric large | `2rem / 1.05` | 600 | Amount/primary metric |
| Numeric small | `0.8125rem / 1.35` | 550 | Tables, prices, odds, percentages |
| Code/hash | `0.8125rem / 1.5` | 500 | Address, commitment, transaction |

Numbers use `tabular-nums slashed-zero`. Currency symbols are visually quieter than amounts. Percentages include a sign when direction matters. Future market odds must name the format and equivalent probability. Timestamps pair a localized value with exact UTC in details. Use sentence case. Never place critical data below 12px.

## 6. Layout Architecture

Desktop uses a stable 232px navigation rail, a fluid primary workspace capped at 1040px, and an optional 320px context rail. The full shell caps at 1440px. The context rail appears only for proof, version comparison, authority, or transaction progress.

Navigation follows the approved product: Overview, Expenses, Review, Treasury, Verification, Workspace. Wallet and network status sit at the bottom with textual network identification. Route state, filters, tabs, search, and pagination belong in the URL.

- **Dashboard:** one attention ledger dominates, with a narrow proof-activity rail and at most three ranked metrics.
- **Detail:** 7/5 grid—record/evidence left, state/action/proof right.
- **Cards:** independent interactive objects only. Prefer rules, spacing, and sections.
- **Tables:** semantic markup, sticky headers, tabular numerals, separate selection/navigation, measured virtualization.
- **Sticky regions:** stop below the app header and remain usable at 200% zoom.
- **Empty/loading/error:** one honest action; skeletons match geometry; errors preserve input, disclose chain impact, and name recovery.

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
```

Product sections use 24–48px gaps; marketing sections 80–112px. Inputs/menus use 8px radius, buttons 10px, panels/dialogs 12px, and badges pill radius. Working lists are flat. Shadows are limited to overlays and dragged objects.

## 7. Component System

Every applicable component defines default, hover, active, focus-visible, disabled, loading, empty, error, and reduced-motion behavior.

### Navigation

- **Navbar:** 64–72px, one line, opaque surface, bottom rule. Current route uses weight and a 2px rule. Use semantic `<nav>` and `aria-current`. Never float it in a glass pill.
- **Sidebar:** quiet labels and icons, selected surface plus accent rule. Collapse to a labeled drawer below 1024px. Never hide labels permanently.

### Expense and proof

- **Expense row:** merchant/purpose, amount, exact version, submitter, state, and meaningful event. Flat with optional 3px proof rail. Status is icon + text, never a dot.
- **Detail panel:** canonical record and evidence with private/public labels and commitment stamp. Historical approval never appears current.
- **Transaction timeline / Proof Spine:** ordered events with actor, version, time, source, and lifecycle state. Expand details in place; settled history does not replay animation.
- **Settlement receipt:** amount, token, recipient, chain, version, transaction, time, and status. Prepared, submitted, confirmed, failed, and unverifiable are distinct.
- **Proof badge:** icon + named check + optional time. “Verified” alone is prohibited.
- **Risk block:** condition, consequence, affected object, source, and safe action on a semantic soft surface.

### AI and confidence

- **AI analysis card:** iris analytical rule, neutral surface, “AI suggested” label, sources, timestamp, uncertainty, and confirm/correct actions. Never use sparkles or proof green.
- **Confidence module:** Low/Moderate/High band with calibrated numeric detail when available. Include insufficient-data and stale states. Confidence is not truth.
- **Prediction confidence module:** conditional future alias of the confidence module; never imply forecast certainty or add it without approved prediction scope.

### Feedback and controls

- **Empty state:** short orientation and one action; no fake illustration or data.
- **Skeleton:** final geometry, subtle shimmer, hidden from accessibility tree inside a labeled loading region.
- **Modal/drawer/sheet:** opaque surface and scrim; labeled dialog, correct focus containment/return, background inert. Never stack dialogs.
- **Tooltip:** supplementary only; 300ms hover delay, immediate on focus. Critical content cannot depend on it.
- **Tabs:** peer views only, shared active rule, URL state. Not a stepper.
- **Filters/search:** persistent labels, visible active count, clear control, URL synchronization.
- **Badges/toasts:** badges are short state labels; toasts are transient, pause on hover/focus, and never replace inline errors.
- **Table:** caption, scoped headers, announced sort, ≥44px interactive row target, right-aligned numerics.
- **Chart:** real source, time range, axes, labels, summary, and table alternative. Follow Section 9.
- **Form:** label above input, helper beneath label, error beneath field. Correct input type/autocomplete. No placeholder-labels.

### Conditional trading components

These are not approved MVP features:

- **Market card:** title, venue/source, measure, freshness, liquidity, and resolution terms. Sober ledger styling; no casino treatment.
- **Market detail panel:** history, methodology, source, risk, and exact transaction intent.
- **Wager input:** asset, amount, maximum loss, fees, allowance, venue, and signed intent. Never a one-click bet.
- **Portfolio position card:** cost basis, current value, realized/unrealized P&L, source time, and settlement/claim state.

Do not implement these until the product and contract specifications authorize real data and behavior.

## 8. Buttons and Interaction States

| Variant | Visual rule | Use |
|---|---|---|
| Primary | Accent fill; measured text contrast | One dominant safe action per region |
| Secondary | Surface, strong border, primary text | Alternative action |
| Ghost | Transparent; hover surface | Low-priority action/navigation |
| Destructive | Danger text/border; solid only in final confirmation | Reject, revoke, delete |
| Wallet/guide | Secondary until exact intent is prepared; then primary with wallet icon and chain | Connect, review intent, sign |

- Heights: 40px default, 32px compact, 48px mobile primary.
- Hover uses named ramp tokens; active moves down 1px and scales to 0.985.
- Focus uses a 2px ring with 2px offset.
- Disabled uses explicit tokens and native `disabled`; never opacity.
- Loading preserves width, blocks repeats, and uses the active verb.
- Success states name the result; error restores the action and places cause nearby.
- Labels remain one line and name the object/version: “Approve version 2,” not “Confirm.”
- Mobile uses a safe-area sticky action that does not cover content or toasts.

## 9. Data Visualization Rules

Use visualization only when it explains a relationship better than prose or a table.

```css
--chart-1: #2457f5; /* primary actual */
--chart-2: #6758b8; /* model/comparison */
--chart-3: #1b63a8; /* reference/source */
--chart-4: #566170; /* neutral benchmark */
--chart-positive: #087a55;
--chart-warning: #8a5100;
--chart-negative: #ad2632;
--chart-grid: #d7dde5;
```

Dark mode uses theme-adjusted equivalents. Semantic colors never identify arbitrary series.

- Direct-label lines; otherwise use a nearby legend. Limit default views to four categorical series.
- Combine hue with dash, marker, fill pattern, and labels.
- Bars start at zero. Constrained line domains must be obvious.
- Never smooth lines in a way that implies observations between real points.
- Show unit, timezone, source, sample interval, and last update.
- Missing data creates a gap; never silently interpolate.
- Tooltips are keyboard reachable and show exact value, time, and source.
- Charts resize without clipping and include a text summary/table.

Future authorized analytics must disclose: confidence calibration; odds format and implied probability; observed market versus model data; actual versus estimated historical price; realized/unrealized P&L including fees; win-rate sample and period; risk/liquidity thresholds and methodology.

No fake movement, generated numbers, fabricated performance, or decorative chart is permitted.

## 10. AI Analysis UX

AI is an assistant, not an oracle, approver, or treasury actor.

An insight card orders information as:

1. Task label: “Receipt extraction” or “Possible amount mismatch.”
2. Plain result.
3. Low/Moderate/High confidence; numeric only when calibrated.
4. Exact source fields or document regions.
5. Provider/model family where allowed, input scope, and timestamp.
6. Concise factors supporting the result—not hidden chain-of-thought.
7. Missing data, contradictions, staleness, and uncertainty.
8. Confirm, correct, dismiss, or inspect source.

AI uses dedicated tokens and never proof/success styling before human confirmation. Confirmed values become normal record values and retain provenance. Low-confidence fields do not enter committed records automatically. Provider failure leaves manual entry available. Analysis is not approval, tax, legal, or financial advice. Generic chat bubbles are prohibited without a real conversational need.

## 11. Proof-First UX

The **Proof Spine** is a 1px line connecting version, evidence commitment, reviewer decision, and reimbursement. Current nodes are cobalt; historical nodes are outlined; superseded branches bend left; failed nodes use an x shape. Each event names actor, version, time, source, and confirmation state.

The **Commitment Stamp** renders grouped hash fragments such as `9F2A · 17C8 · … · E04B` with copy and disclosure. Expanded values show chain ID, contract, registry version, and explorer link.

| State | Meaning | Required UI |
|---|---|---|
| Pending | Local/provider work not submitted | Stage, owner, safe exit |
| Proposed | Prepared intent not signed/confirmed | Exact values and review |
| Submitted | Has transaction hash; lacks finality | Explorer and confirmations |
| Disputed | Named assertion challenged | Source, deadline, actions |
| Finalized | Required finality reached | Block/time and source |
| Claimable | Eligible under explicit conditions | Amount, deadline, action |
| Failed | Known check/operation failed | Cause, chain impact, recovery |
| Unverifiable | Evidence unavailable/insufficient | Missing input and limitation |

MVP uses pending, proposed, submitted, confirmed/finalized, failed, and unverifiable. Disputed and claimable are reserved.

Proof surfaces expose real contract verification, transaction receipt, chain/finality, token transfer, recipient, signer role at decision time, exact expense version/commitment, settlement and duplicate guard, provider freshness, and per-check export results. Market resolution, oracle status, dispute window, final result, and claim status are conditional future fields.

Always state: matching commitments prove integrity and recorded authority, not receipt truth, business legitimacy, or tax treatment.

## 12. Responsive Design

| Range | Behavior |
|---|---|
| `<360px` | Single column, 16px gutters, only atomic side-by-side controls |
| `360–639px` | Four columns, bottom CTA, ledger entries replace tables |
| `640–767px` | Four columns, filters in sheet, proof below content |
| `768–1023px` | Eight columns, nav/context drawers |
| `1024–1279px` | Twelve columns, fixed nav, optional context rail |
| `≥1280px` | Full shell capped at 1440px |

- No page-level horizontal overflow at 320px or above.
- Mobile navigation is labeled; wallet/network remains visible.
- Cards stack in task order. Tables become designed ledger entries rather than hiding key fields.
- Charts simplify ticks and keep labels/table alternatives.
- Addresses/hashes use middle truncation visually and copy full values.
- Titles wrap to three lines and reveal fully on detail.
- Filters move into a sheet while search and active-filter count remain visible.
- Sticky regions remain usable at 200% zoom.
- Test 320, 375, 768, 1024, 1280, 1440, mobile landscape, and 200% zoom.

## 13. Accessibility Rules

Target WCAG 2.2 AA for every P0 flow.

- Use landmarks, logical headings, native controls, and semantic tables.
- All interaction is keyboard accessible with a visible 2px focus ring and 2px offset.
- Focus follows task order; modal focus is contained and restored.
- Normal text reaches 4.5:1; large text and essential boundaries reach 3:1.
- Color never carries meaning alone; use icon, text, line, marker, and pattern.
- Run protanopia/deuteranopia checks on states and charts in both themes.
- Touch targets are ≥44×44px; mobile primary controls target 48px.
- Forms have persistent labels, associated errors, and correct autocomplete.
- Error summaries link to fields; errors preserve valid input.
- Transaction/upload changes use concise polite live announcements.
- Redundant icons are hidden from assistive technology; icon-only controls have names/tooltips.
- Charts have text summaries and accessible tables.
- Evidence images have useful alternatives or adjacent structured data.
- Support forced colors, zoom, text resizing, reduced motion, and keyboard-only tasks.
- Never require hover, drag, fine pointer control, color perception, or prior-screen memory.

## 14. Motion and Microinteractions

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 120ms;
--duration-medium: 220ms;
--duration-slow: 360ms;
```

Allowed: 1px button press; subtle hover surfaces; 6px page fade/rise while shell stays fixed; 12px drawer motion; 0.985 dialog scale; one-time Proof Spine progress; geometry-matched shimmer; one commitment confirmation sweep; chart-tooltip reveal; layout animation for visible sorted rows.

Not allowed: constant glow, bouncing CTAs, cursor chasing, large parallax, particles, confetti, autoplay 3D, number theater, slow app reveals, fake market motion, or simulated transaction progress.

Animate transform and opacity by default. Keep product motion under 520ms and no more than two regions moving. Motion never delays navigation, signing, provider updates, or recovery. Under `prefers-reduced-motion`, remove translation, parallax, spring, stagger, pulse, shimmer, and smooth scrolling while retaining immediate state, focus, and announcements.

## 15. Anti-Slop Rules

Every visual element needs a product reason. Release blockers:

1. No random gradients or more than one expressive gradient per screen.
2. No fake metrics, activity, users, logos, testimonials, balances, integrations, or chain data.
3. No meaningless badges or status dots without text.
4. No orb, mesh wallpaper, fake 3D blob, neon shadow, or blockchain lattice.
5. No tiny low-contrast gray text; critical data is never below 12px.
6. No generic AI-chat hero or unnecessary chat bubbles.
7. No casino prediction visuals, flashing odds, celebratory payout, or urgency manipulation.
8. No fake glassmorphism; working surfaces are opaque.
9. No inconsistent radius or improvised spacing.
10. No default grid of three equal rounded feature cards.
11. No nested cards when a divider or spacing is enough.
12. No gradient text, glossy CTA, or animated CTA glow.
13. No unverified protocol, security, privacy, AI, or performance claim.
14. No chart that lacks real sourced data.
15. No copy-pasted component-library block without Clario tokens, states, content, and accessibility.
16. No generic coins, rockets, candlesticks, hexagons, or chains as filler.
17. No approval/payment/claim action for stale or unsupported state.
18. No AI suggestion styled as confirmed truth.
19. No success-only component.
20. No turning Clario into a market, wallet dashboard, or trading product without approved scope.

## 16. Implementation Rules for Coding Agents

1. Read `prd.md`, `architecture.md`, this file, and any `AGENTS.md` first.
2. Inspect manifests, routes, layouts, tokens, and related components before editing.
3. Reuse existing primitives where they meet requirements.
4. Preserve routes, data contracts, state machines, authorization, and working logic.
5. Never change contract logic, transaction semantics, or chain configuration from a design task.
6. Never hardcode fake production data; isolate and label fixtures.
7. Do not modify environment/provider settings unless required.
8. Check dependencies before import; justify capability, weight, maintenance, accessibility, and server/client boundary.
9. Use one primitive foundation and one icon family.
10. Implement semantic variables; do not scatter raw hex values.
11. Keep animated code in client leaves and static layout server-rendered.
12. Preserve all breakpoints, 200% zoom, long content, and reduced motion.
13. Build loading, empty, error, provider failure, disabled, and permission states with success.
14. Preserve semantic HTML, keyboard behavior, focus, labels, live regions, and contrast.
15. Run relevant lint, type, unit, accessibility, and visual checks.
16. Never infer a market, wager, oracle, claim, or trading feature from conditional patterns.

External components are references, not dependencies. Skiper/21st components require accessibility and bundle review. Image-to-code can decompose layout but never pixel-clone. Hallmark-style anti-slop review happens before handoff. Playwright validates complete compositions.

## 17. Design QA Checklist

- [ ] Desktop checked at 1024, 1280, and 1440px.
- [ ] Mobile checked at 320 and 375px with no horizontal overflow.
- [ ] Tablet checked at 768px in both orientations.
- [ ] Light/dark themes checked independently.
- [ ] Long text, amounts, dates, addresses, and hashes wrap safely.
- [ ] Charts remain readable and expose summary/table.
- [ ] Keyboard-only task completion works.
- [ ] Hover, active, focus, disabled, loading, success, and error states exist.
- [ ] Empty states are honest; errors preserve work and name recovery.
- [ ] Wallet rejection, submitted, confirmed, replaced, failed, and indexed states exist.
- [ ] Reduced motion retains meaning.
- [ ] Contrast is measured, not guessed.
- [ ] Semantic colors/charts pass protanopia and deuteranopia review.
- [ ] Screen-reader labels and announcements are concise.
- [ ] Overlay focus enters, remains, and returns correctly.
- [ ] Forced colors and 200% zoom remain usable.
- [ ] Lighthouse accessibility/performance run on representative routes.
- [ ] Playwright captures 375, 768, 1024, and 1440px.
- [ ] Playwright keyboard paths cover create, submit, review, reimburse, export, verify.
- [ ] No fake data, claim, integration, protocol state, or decorative chart.
- [ ] Anti-Slop Rules pass mechanically and visually.

## 18. Page Blueprints

### Landing page

**Purpose:** explain Clario’s narrow promise. **Action:** start/create workspace. **Layout:** split hero with proof artifact; workflow, privacy boundary, verifier demo, final CTA in varied structures. **Responsive:** artifact follows copy; hero fits `100dvh`. **Trust:** no fabricated logos/metrics. **States:** only real dynamic-data loading/error.

### Overview

**Purpose:** work requiring attention. **Action:** new expense or open review. **Layout:** attention ledger, proof rail, up to three metrics. **Responsive:** rail follows ledger. **Trust:** real workspace values only. **States:** role-aware empty/loading/partial error.

### Expenses

**Purpose:** manage drafts and records. **Action:** new expense. **Layout:** search/filter and flat ledger. **Responsive:** ledger entries; filters in sheet. **Trust:** version/source visible. **States:** empty, no results, loading, provider failure.

### Expense detail and review

**Purpose:** inspect evidence and decide one version. **Action:** submit/approve/request changes/reject by role/state. **Layout:** 7/5 record and decision. **Components:** evidence, diff, AI extraction, decision, Proof Spine. **Responsive:** decision follows record with sticky valid action. **Trust:** commitment, scope, impactful changes. **States:** stale version blocks action; evidence/wallet/transaction failures are explicit.

### Treasury / reimbursement

**Purpose:** reimburse approved current expense. **Action:** review and submit payment. **Layout:** payable ledger plus settlement comparison. **Trust:** token, recipient, amount, chain, version, simulation, duplicate guard. **States:** mismatch blocks; submitted is not paid; failed is not reimbursed.

### AI analysis

**Purpose:** inspect extraction/anomaly suggestions. **Action:** confirm or correct. **Layout:** source evidence and structured suggestions, never chat-first. **Trust:** input scope, source, time, confidence, uncertainty, and human state. **States:** analyzing, low confidence, malformed, unavailable, corrected.

### Guide / onboarding

**Purpose:** workspace, identity/wallet, roles, first expense. **Action:** current setup step. **Layout:** focused column with persistent progress. **Responsive:** compact top step. **Trust:** signing and privacy boundaries before action. **States:** configured, wrong network, rejected wallet, pending invitation.

### Transaction history

**Purpose:** reconstruct app/public events. **Action:** inspect proof. **Layout:** filterable Proof Spine and optional detail rail. **Trust:** local, block, and indexer times differ visibly. **States:** lag, replacement, failure, provider unavailable.

### Proof / settlement receipt

**Purpose:** independently inspect package/payment. **Action:** verify locally/export. **Layout:** sparse upload then summary/check ledger. **Trust:** contract, chain, source, authority, version, evidence, settlement. **States:** passed, warning, failed, unverifiable, tampered.

### Error / not found

**Purpose:** explain absence/failure without leaking existence. **Action:** nearest authorized view. **Layout:** concise normal-shell message. **Trust:** distinguish states only when safe.

### Markets page — conditional, not approved

**Purpose:** future authorized market/treasury conversion. **Action:** inspect a real sourced market. **Layout:** sober search/filter ledger. **Trust:** venue, source, freshness, liquidity, resolution. **States:** stale, suspended, finalized. **Do not implement under the current PRD.**

### Market detail page — conditional, not approved

**Purpose:** inspect authorized market and intent. **Action:** review fully specified transaction. **Layout:** title/state, measured data, methodology, action. **Trust:** source, oracle/provider, dispute/finality, fees, maximum loss. **States:** pending, disputed, finalized, claimable, failed. **Do not implement under the current PRD.**

### Portfolio page — conditional, not approved

**Purpose:** future authorized positions/treasury assets. **Action:** inspect or settle. **Layout:** sourced total, positions, history. **Trust:** price source, time, cost basis, fees, realized/unrealized distinction. **States:** missing/stale price, closed, claimable. **Do not implement under the current PRD.**

## 19. Final Output Requirements

This specification is implementable, token-driven, responsive, accessible, proof-first, and specific to Clario. It is not a moodboard and authorizes no new product scope.

### Direction summary

Evidence Ledger combines graphite structure, cobalt proof signals, muted iris analysis, disciplined typography, and two signatures: Proof Spine and Commitment Stamp. It makes versions, authority, AI uncertainty, chain state, and settlement evidence explicit without resembling a trading terminal.

### Files likely to change later

The current Next.js implementation uses `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, and `apps/web/src/components/*`, including `components/ui/*` and the product workflow components. Continue adapting those existing files and add accessibility or visual fixtures as the relevant task requires; do not create duplicate design systems or routes.

### Safe implementation order

1. Tokens, fonts, themes, focus, reduced motion, base layout.
2. Buttons, fields, overlays, tabs, badges, status sentences.
3. App shell and responsive navigation.
4. Expense ledger, detail, evidence, version diff.
5. Review authority and transaction intent.
6. Reimbursement progress and settlement receipt.
7. Verifier, Proof Spine, Commitment Stamp.
8. AI surfaces after manual workflows work.
9. Motion and visual regression.
10. Marketing/demo surfaces from real product states.

### Risks and unknowns

- No frontend exists, so framework versions, primitives, dependencies, and route conventions are unknown.
- Brand assets/logo are absent; the system intentionally works without them.
- Dark mode is specified but not required by the PRD; decide whether it is MVP.
- Provider selection may add required states.
- Contract addresses, chain data, explorer behavior, and USDC address must come from deployment—not this file.
- Market, wager, position, oracle, dispute, and claim concepts are not approved; those blueprints remain dormant.

### Reference adaptation

Principles were synthesized—not copied—from [Skiper UI](https://skiper-ui.com/components), [Feral UI](https://feralui.dev/gradients), [Jiro](https://jiro.build), [Taste Skill](https://github.com/Leonxlnx/taste-skill), [21st MCP](https://github.com/21st-dev/magic-mcp), [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills), [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md), [Playwright CLI](https://github.com/microsoft/playwright-cli), [Open Design](https://github.com/nexu-io/open-design), and [Hallmark](https://github.com/nutlope/hallmark). They informed component scrutiny, gradient discipline, responsive reconstruction, accessibility, motion, QA, portable tokens, and anti-template review while preserving Clario’s identity.
