# OralCare+ delivery outcomes

## Current audit status — 2026-10-16
- **Implemented:** Supabase Auth-backed registration/login/logout/profile APIs, trusted staff-role redirects, secure Preview cookies, persistent profile trigger, patient-owned appointment/profile queries with RLS, server-calculated availability endpoint, appointment approval lifecycle, transactional booking-request RPC, database overlap constraint, PayPal deposit creation/capture boundaries, Resend delivery adapter with honest configuration errors, notification centre functions, real enquiry persistence, protected staff overview endpoint, patient dashboard progress/deposit states, and route-level access redirects.
- **Verified:** TypeScript check, production build, API health with PayPal/public-origin/email readiness, unauthenticated `401` boundaries, route manifest HTTP 200, direct booking-insert hardening, and live Supabase lifecycle functions/RLS policy presence.
- **Still launch-blocked:** Live patient/admin acceptance tests require real test accounts and a clinic-approved service catalogue. Resend delivery still depends on a verified sender/recipient configuration, and production publication remains separate from this checkpoint.

## 1. Public website, navigation, and brand system
- [ ] Build the responsive OralCare+ shell with the original logo, favicon, header, mobile menu, primary navigation, patient account access, Book Appointment CTA, consistent footer, accessible focus states, loading/empty/error/success states, and a custom 404.
- [ ] Implement `/`, `/services`, `/services/:slug`, `/about`, `/journal`, `/journal/:slug`, `/contact`, `/book-appointment`, `/privacy`, `/terms`, and `/cancellation-policy` with no dead links or buttons that appear functional but do nothing.
- [ ] Use the approved premium editorial direction: warm white, light gray, charcoal, restrained mineral sage, no gradients, no emojis, no excessive rounded cards, no glassmorphism, no loud colors, no generic dental illustrations, refined Manrope/Inter typography, generous whitespace, subtle borders, restrained shadows, responsive images, descriptive alt text, and purposeful motion with reduced-motion support.
- [ ] Use high-quality authorized dental photography or generated original assets with wide responsive compositions, suitable art direction, neutral overlays only where needed, and no disturbing clinical imagery or misleading before/after claims.

## 2. Home page
- [ ] Create a cohesive, scrollable home page with hero headline, supporting copy, primary and secondary CTAs, dental photography, clinic introduction, selected services, factual reasons to choose the clinic, care philosophy, patient journey, booking CTA, authorized testimonials only or a clearly marked development placeholder, journal preview, FAQs, opening hours, contact/location placeholders, and professional footer.
- [ ] Do not invent statistics, clinic history, contact details, staff identities, qualifications, awards, credentials, prices, deposit rules, cancellation/refund terms, insurance claims, CDCP eligibility, or testimonials.

## 3. Services and pricing
- [ ] Implement an editable published service catalogue and detail pages covering approved categories such as general, preventive, restorative, periodontal, endodontic, cosmetic, prosthodontic/tooth replacement, oral surgery, orthodontics, pediatric, and additional services without implying that every possible treatment is offered.
- [ ] Support service duration, publication status, fixed price, starting-from price, price range, quote required, unpublished/pending status, CAD integer minor units, configurable deposit, update timestamp, and optional internal source notes.
- [ ] Display `Contact the clinic for pricing` or `Price determined after examination` whenever reliable clinic-approved prices are unavailable. Mark public research ranges as indicative until approved, and state that final costs depend on examination and treatment plan.

## 4. Journal
- [ ] Implement `/journal` with featured article, article listing, category filtering, search, publication dates, responsible original dental education content, and usable article cards.
- [ ] Implement `/journal/:slug` with readable article layout, author/date/category metadata, related articles, SEO metadata, and responsible language that avoids diagnosis, guarantees, or fabricated professional endorsements.
- [ ] Implement admin journal states for draft, preview, publish/unpublish, category, featured image, metadata, and optional scheduling when supported.

## 5. Patient authentication and account
- [ ] Implement Supabase Auth email/password registration with full name, email, phone with Canada +1 convenience default, password, confirmation, terms acceptance, privacy acknowledgement, email verification, secure login/logout, recovery, reset, session persistence/expiration, protected routes, appropriate error messages, profile editing, and a safe account deletion/request workflow.
- [ ] Never store plaintext passwords or privileged keys in frontend code. Patients can access only their own records and no clinical notes, prescriptions, diagnoses, or treatment histories are exposed.
- [ ] Implement `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/appointments`, `/dashboard/appointments/:id`, and `/dashboard/profile` with personalized greeting, upcoming appointment, booking/deposit status, history, details, book-again CTA, policy-permitted cancellation/rescheduling, profile/security settings, and accurate notifications driven by persisted data.

## 6. Booking and availability
- [ ] Implement `/book-appointment` and the patient booking flow: choose published service, choose date, view available slots, select slot, confirm minimum patient details, review service/duration/time/deposit/policy, accept terms, continue to secure payment, and show confirmation only after required payment and booking checks succeed.
- [ ] Use real availability data with month/date navigation, disabled unavailable dates, mobile usability, visible America/Toronto local time, Monday–Friday 8:00 AM–5:00 PM, Saturday 8:00 AM–2:00 PM, Sunday closed, DST-safe handling, service duration fit checks, buffer time, staff availability, breaks, holidays/closures, blocked periods, minimum notice, booking horizon, temporary holds, cancellation/rescheduling limits, overlap prevention, and transactional server-side checks.
- [ ] Keep booking, hold, payment, cancellation, rescheduling, and confirmation states explicit. Never create a slot when the full service duration does not fit or trust browser state as proof of availability.

## 7. PayPal deposit workflow
- [x] Implement server-created PayPal orders for approved appointments, trusted CAD deposit calculation, unique booking/payment references, patient ownership checks, failure handling, and capture verification.
- [x] Confirm the `Deposit Paid` appointment state only after authenticated PayPal API capture verification matches the expected amount and currency. Never treat a browser redirect as payment proof and never persist card numbers, security codes, expiry dates, raw API keys, or raw provider payloads.
- [ ] Provide a payment history view with date, amount, status, and items; represent processing, cancellation, and failure separately.

## 8. Staff/admin operations
- [ ] Implement `/admin/login`, `/admin`, `/admin/appointments`, `/admin/availability`, `/admin/services`, `/admin/patients`, `/admin/journal`, `/admin/enquiries`, `/admin/payments`, `/admin/staff`, and `/admin/settings` with role-based access, auditability, loading/empty/error states, and no exposure of data outside a staff member’s permissions.
- [ ] Allow administrators to configure clinic details, opening hours, holidays, closures, services, prices, deposits, durations, staff availability, breaks, blocked times, booking notice/horizon, policy text, publication states, and launch placeholders.
- [ ] Provide appointment management, availability calendar, basic patient records, journal moderation, enquiry handling, payment reconciliation, staff roles, and settings screens without inventing clinic data.

## 9. Email, policies, SEO, and deployment
- [ ] Implement Resend-backed transactional email adapters for verification/recovery, booking/payment confirmation, cancellation/rescheduling, and staff notifications with honest delivery/error states and server-only credentials.
- [ ] Implement policy pages with editable legal copy and launch placeholders. Include opening hours, contact/location placeholders, privacy, terms, and cancellation/refund policy states.
- [ ] Include `public/manus-routes.json`, route-aware titles/descriptions/OG/Twitter/canonical metadata when a real public origin is configured, a sitemap/robots strategy, accessible alt text, and correct not-found behavior without exposing private routes to indexing.
- [ ] Add package manager pinning, lifecycle-script policy, strict TypeScript checks, build scripts, Dockerfile with `PORT` support and unauthenticated health endpoint, `.env.example`, and deployment config for the server-backed production app.

## 10. Validation and checkpoint
- [x] Run diagnostics before and during implementation, typecheck/build, inspect route manifest with HTTP 200, verify representative public routes and API health, validate authenticated/role boundaries through code paths, and fix actionable failures before delivery.
- [ ] Commit the intended implementation to the canonical `main` branch and confirm the resulting checkpoint SHA. Do not claim live production publication unless the published version is confirmed.
