# OralCare+ implementation plan

## Product scope

OralCare+ is a production-ready single-clinic dental website and appointment platform for Ottawa, Ontario, Canada. The build covers the public editorial site, patient authentication and profile management, service catalogue, appointment booking, Stripe deposit checkout, patient dashboard, staff/admin operations, journal publishing surfaces, contact enquiries, clinic settings, privacy/terms/policy pages, and production deployment configuration.

The clinic configuration is CAD and `America/Toronto`, with Monday–Friday 8:00 AM–5:00 PM, Saturday 8:00 AM–2:00 PM, and Sunday closed. Address, phone, email, staff identities, credentials, prices, deposit rules, cancellation/refund terms, and other unconfirmed business data remain editable placeholders and are visibly marked as launch inputs rather than invented facts.

## Implementation approach

- **Frontend:** React + TypeScript + Vite, with React Router for public, patient, staff, policy, and error routes.
- **Server:** TypeScript server endpoints for secure auth/session handling, booking validation, availability, admin permissions, Stripe Checkout creation, webhook verification, Resend email dispatch, and API error shaping.
- **Persistence:** Supabase Auth and Supabase PostgreSQL are the authoritative user and application-data services requested for production. Data access lives behind typed repository modules so a later provider change does not leak into route components. The project’s managed server/database capabilities remain enabled for the production runtime and deployment contract.
- **Security:** Server-only secrets, input validation, authorization by role and ownership, no plaintext passwords or card data, raw-body Stripe signature verification, idempotency records, overlap prevention, temporary slot holds, and `SameSite=None; Secure` session cookies for embedded Preview compatibility.
- **Booking lifecycle:** publishable services only → local-time date selection → server-generated availability → slot hold → policy acceptance → server-calculated CAD deposit → Stripe Checkout → verified webhook reconciliation → confirmation email and dashboard status. Redirects are never treated as payment proof.
- **Content model:** editable data modules for services, journal articles, clinic settings, FAQs, policies, opening hours, holidays, and launch placeholders. Admin screens expose publication state and price modes including fixed, starting-from, range, quote-required, pending, and unpublished.
- **Delivery:** route manifest, responsive navigation, SEO metadata, favicon and brand mark, accessible form states, build scripts, Docker runtime, health endpoint, and deployment configuration. The initial public origin is not hard-coded into canonical metadata until a real production domain is configured.

## Project structure

```text
oralcare/
├── client/
│   ├── src/
│   │   ├── components/      # shared shell, logo, forms, cards, feedback, booking UI
│   │   ├── data/            # editable services, articles, FAQs, launch placeholders
│   │   ├── layouts/         # public, patient, admin, policy shells
│   │   ├── pages/           # route-level page modules
│   │   ├── lib/             # API client, validation, formatting, metadata helpers
│   │   ├── styles/          # tokens and global styles
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── public/              # route manifest, favicon, local brand assets
├── server/
│   ├── auth/                # Supabase/Manus session adapters and role checks
│   ├── db/                  # typed repositories and migrations/schema helpers
│   ├── booking/             # availability, holds, overlap checks, policy rules
│   ├── payments/            # Stripe Checkout, webhook verification, reconciliation
│   ├── email/               # Resend templates and dispatch adapters
│   ├── routes/              # public, patient, admin, health, and webhook handlers
│   └── index.ts
├── shared/                  # shared types, schemas, enums, and business constants
├── public/                  # deployment-facing static assets when needed
├── plan.md
├── TODO.md
├── Dockerfile
└── package.json
```

## Design direction

### Design movement

- **Clinical editorial modernism** — 0.84: a restrained, magazine-like healthcare interface with strong typography, disciplined rules, and high-quality documentary imagery.
- **Soft brutalist clinic** — 0.07: structured blocks, dense labels, and visible system logic with less warmth.
- **Quiet hospitality** — 0.09: warmer tones and softer interfaces focused on reassurance and comfort.

### Core principles

1. **Calm precision:** information is organized with clear alignment, thin rules, and purposeful whitespace.
2. **Human reassurance:** copy is specific and composed, not salesy; patient comfort is described without unsupported promises.
3. **Editorial confidence:** large headlines, short paragraphs, image-led storytelling, and a paced reading rhythm.
4. **Operational clarity:** booking, pricing status, and account states are explicit, never disguised as completed server actions.

### Color philosophy

Warm white and pale stone create an unhurried clinical surface. Charcoal carries authority for navigation, headings, and action sections. A muted mineral sage accent (`#9BAEA7`) is used sparingly for active states, focus rings, and small status cues. There are no gradients, bright colors, or decorative color fields that compete with clinical photography.

### Layout paradigm

Use an asymmetric editorial rail: a compact left-side section index or eyebrow aligns with a wide content field. Hero and feature sections alternate between a text rail and an image rail, with full-bleed charcoal transitions used as deliberate pacing rather than repeated card grids. On mobile, the rail collapses into a compact eyebrow and the content becomes a readable single flow.

### Signature elements

- An original OralCare+ mark: a minimal open arc enclosing a precise plus, suggesting a smile line, care, and calibration without using a stock tooth icon.
- Hairline dividers with numbered section labels, creating a quiet clinical record-keeping motif.
- A recurring “Next step” appointment ribbon that turns from dark charcoal to mineral sage on hover/focus and always leads to a real route.

### Interaction philosophy

Interactions should feel like turning a page or moving through a care plan. Buttons use short labels and a clear destination. Forms validate inline, retain entered values, and explain what happens next. Booking is a staged flow with visible local time, availability states, policies, and payment status. Motion is limited to 160–240ms opacity/translate transitions, subtle image scale on hover, and reduced-motion fallbacks.

### Typography system

Use Manrope for display and section headings with tight tracking and weight 600–700. Use Inter for body copy, labels, forms, navigation, and data tables at weight 400–600. Hero headings scale fluidly from approximately 3.4rem on wide screens to 2.4rem on mobile. Body text remains 1rem–1.125rem with 1.55–1.7 line height. Labels use uppercase Inter at 0.72rem–0.78rem with deliberate tracking.

### Brand essence and voice

**OralCare+ is precise, considered dental care for Ottawa patients who want a calmer, clearer way to look after their oral health.** Personality: composed, attentive, exact.

Headlines sound direct and quietly confident: “A clearer way to care for your smile.” CTAs are practical and human: “Choose a time” and “Explore care options.” Microcopy tells the truth: “Final treatment costs depend on your examination and plan.”

### Wordmark and logo

The wordmark uses `OralCare+` with a custom plus aligned to the cap-height of the wordmark. The mark is a single-line arc with a centered plus, designed to remain legible at favicon scale and as a one-color SVG. The same mark is used in the header, footer, favicon, social preview, and project logo metadata.

### Signature brand color

Mineral sage (`#9BAEA7`) is the ownable accent. It communicates care and composure while staying within a restrained clinical palette.

## External configuration and launch inputs

Supabase, Stripe, and Resend credentials are accessed only on the server and never committed. The app includes `.env.example` with named placeholders, provider health checks, and explicit setup states. Clinic owners must supply and approve address, contact channels, staff records, service catalogue, pricing, deposit amounts, cancellation/refund rules, holidays, and legal copy before live launch. Research references for indicative costs are stored as internal notes and are not automatically published as clinic fees.
