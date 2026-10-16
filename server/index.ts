import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const port = Number(process.env.PORT || 3000);
const timezone = "America/Toronto";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalBase = process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const publicOrigin = process.env.PUBLIC_ORIGIN?.replace(/\/$/, "");
function isValidPublicOrigin(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && (url.pathname === "" || url.pathname === "/");
  } catch {
    return false;
  }
}
const publicOriginConfigured = isValidPublicOrigin(publicOrigin);
const paymentsConfigured = Boolean(paypalClientId && paypalClientSecret && publicOriginConfigured);
const routePatterns = [/^\/$/, /^\/services(?:\/[^/]+)?$/, /^\/about$/, /^\/journal(?:\/[^/]+)?$/, /^\/contact$/, /^\/book-appointment$/, /^\/(login|register|forgot-password|reset-password)$/, /^\/dashboard(?:\/appointments(?:\/[^/]+)?|\/profile)?$/, /^\/checkout\/[^/]+$/, /^\/payment\/return$/, /^\/admin(?:\/[^/]+)?$/, /^\/(privacy|terms|cancellation-policy)$/];
const cookieOptions = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" };

type Authed = { user: User; client: SupabaseClient };
function supabaseFor(token?: string) {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false }, global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined });
}
function tokenFrom(req: Request) { return req.cookies.oc_access_token || req.headers.authorization?.replace(/^Bearer\s+/i, ""); }
async function staffSession(req: Request) {
  const session = await authenticated(req);
  if (!session) return null;
  const { data: profile } = await session.client.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  return profile && ["staff", "admin"].includes(profile.role) ? session : null;
}
async function authenticated(req: Request): Promise<Authed | null> {
  const token = tokenFrom(req);
  const client = supabaseFor(token || undefined);
  if (!client || !token) return null;
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { user: data.user, client };
}
function fail(res: Response, status: number, code: string, message: string, details?: unknown) { return res.status(status).json({ ok: false, error: { code, message, details } }); }
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(limit: number, windowMs = 60_000) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    else if (bucket.count >= limit) return fail(res, 429, "rate_limited", "Too many requests. Please wait and try again.");
    else bucket.count += 1;
    next();
  };
}
function setSessionCookies(res: Response, session: { access_token: string; refresh_token: string; expires_in?: number }) { res.cookie("oc_access_token", session.access_token, { ...cookieOptions, maxAge: (session.expires_in || 3600) * 1000 }); res.cookie("oc_refresh_token", session.refresh_token, cookieOptions); }
function clearSessionCookies(res: Response) { res.clearCookie("oc_access_token", cookieOptions); res.clearCookie("oc_refresh_token", cookieOptions); }
function localToUtc(date: string, time: string) { const guess = new Date(`${date}T${time}:00Z`); const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(guess); const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)])); const localAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour % 24, values.minute); return new Date(guess.getTime() - (localAsUtc - guess.getTime())); }
function dayKey(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
function openingWindow(date: string) { const day = dayKey(date); if (day === 0) return null; return day === 6 ? ["08:00", "14:00"] as const : ["08:00", "17:00"] as const; }
function slotTimes(date: string, duration: number) { const window = openingWindow(date); if (!window) return []; const start = localToUtc(date, window[0]); const end = localToUtc(date, window[1]); const slots: Date[] = []; for (let cursor = start.getTime(); cursor + duration * 60_000 <= end.getTime(); cursor += 30 * 60_000) slots.push(new Date(cursor)); return slots; }
async function sendTransactional(to: string, subject: string, html: string, text: string) { if (!resend || !process.env.RESEND_FROM_EMAIL) return { sent: false, reason: "email_not_configured" }; const { error } = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL, to, subject, html, text }); return error ? { sent: false, reason: "email_provider_error" } : { sent: true }; }
function localAppointmentLabel(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" });
  return `${formatter.format(new Date(startsAt))} – ${new Intl.DateTimeFormat("en-CA", { timeZone: timezone, timeStyle: "short" }).format(new Date(endsAt))} (${timezone})`;
}
async function emailUser(userId: string, subject: string, html: string, text: string) {
  const adminClient = supabaseFor();
  if (!adminClient) return { sent: false, reason: "auth_not_configured" };
  try {
    const result = await adminClient.auth.admin.getUserById(userId);
    const email = result.data.user?.email;
    return email ? sendTransactional(email, subject, html, text) : { sent: false, reason: "email_not_available" };
  } catch { return { sent: false, reason: "email_lookup_failed" }; }
}
async function sendAppointmentNotice(client: SupabaseClient, appointmentId: string, kind: string, title: string, body: string, href: string, dedupeKey: string) {
  await client.rpc("notify_patient_appointment", { p_appointment_id: appointmentId, p_kind: kind, p_title: title, p_body: body, p_href: href, p_dedupe_key: dedupeKey });
}
async function sendSelfNotice(client: SupabaseClient, appointmentId: string, kind: string, title: string, body: string, href: string, dedupeKey: string) {
  await client.rpc("notify_self_appointment", { p_appointment_id: appointmentId, p_kind: kind, p_title: title, p_body: body, p_href: href, p_dedupe_key: dedupeKey });
}
async function paypalToken() { if (!paypalClientId || !paypalClientSecret) throw new Error("paypal_not_configured"); const response = await fetch(`${paypalBase}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" }); if (!response.ok) throw new Error("paypal_auth_failed"); const body = await response.json() as { access_token?: string }; if (!body.access_token) throw new Error("paypal_auth_failed"); return body.access_token; }
async function paypalRequest<T>(path: string, init: RequestInit = {}) { const token = await paypalToken(); const response = await fetch(`${paypalBase}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`paypal_request_failed:${response.status}`); return body as T; }


app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use((req, res, next) => { if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/manus-storage") && !req.path.includes(".")) { if (!routePatterns.some(pattern => pattern.test(req.path))) res.status(404); } next(); });
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, service: "oralcare", time: new Date().toISOString(), providers: { auth: Boolean(supabaseUrl && supabaseKey), payments: paymentsConfigured, publicOrigin: publicOriginConfigured, email: Boolean(resend && process.env.RESEND_FROM_EMAIL) } }));
app.get("/api/config", (_req, res) => res.json({ city: "Ottawa", province: "Ontario", currency: "CAD", timezone, openingHours: ["Mon-Fri 08:00-17:00", "Sat 08:00-14:00", "Sun closed"], configured: { auth: Boolean(supabaseUrl && supabaseKey), payments: paymentsConfigured, publicOrigin: publicOriginConfigured, email: Boolean(resend && process.env.RESEND_FROM_EMAIL) } }));

const registerSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email(), phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid international phone number with country code."), password: z.string().min(8).max(72), confirmPassword: z.string(), acceptedTerms: z.literal(true) }).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." });
app.post("/api/auth/register", rateLimit(5), express.json(), async (req, res) => { const parsed = registerSchema.safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "Please correct the highlighted fields.", parsed.error.flatten().fieldErrors); const client = supabaseFor(); if (!client) return fail(res, 503, "auth_not_configured", "Patient registration is not available until authentication is configured."); const { firstName, lastName, email, phone, password } = parsed.data; const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: `${firstName} ${lastName}`, phone } } }); if (error) { const duplicate = /already registered|already exists/i.test(error.message); return fail(res, duplicate ? 409 : 400, duplicate ? "email_in_use" : "registration_failed", duplicate ? "An account already exists for that email." : "We could not create the account."); } const emailStatus = data.user?.email ? await sendTransactional(data.user.email, "Welcome to OralCare+", `<p>Welcome to OralCare+, ${firstName}.</p><p>Your account has been created. ${data.session ? "You can sign in and begin when you are ready." : "Please follow the verification email from the authentication provider before signing in."}</p><p><a href="${process.env.PUBLIC_ORIGIN || "/login"}">Return to OralCare+</a></p>`, `Welcome to OralCare+, ${firstName}. Your account has been created. ${data.session ? "You can sign in and begin when you are ready." : "Please follow the verification email from the authentication provider before signing in."}`) : { sent: false, reason: "no_user" }; if (data.session) setSessionCookies(res, data.session); return res.status(201).json({ ok: true, user: data.user, session: Boolean(data.session), emailStatus }); });
app.post("/api/auth/login", rateLimit(10), express.json(), async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Enter a valid email and password.");
  const client = supabaseFor();
  if (!client) return fail(res, 503, "auth_not_configured", "Patient login is not available until authentication is configured.");
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error || !data.session) return fail(res, 401, "invalid_credentials", "The email or password is not correct.");
  const sessionClient = supabaseFor(data.session.access_token);
  if (!sessionClient) return fail(res, 503, "auth_not_configured", "The authenticated session could not be prepared.");
  const { data: profile, error: profileError } = await sessionClient.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError) return fail(res, 500, "role_lookup_failed", "We could not verify your clinic account role.");
  const role = profile?.role;
  if (!role || !["patient", "staff", "admin"].includes(role)) return fail(res, 403, "role_not_configured", "Your account does not have a configured clinic role. Contact the clinic administrator.");
  setSessionCookies(res, data.session);
  return res.json({ ok: true, user: data.user, role });
});
app.post("/api/auth/forgot-password", rateLimit(5), express.json(), async (req, res) => { const parsed = z.object({ email: z.string().email() }).safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "Enter a valid email address."); const client = supabaseFor(); if (!client || !process.env.PUBLIC_ORIGIN) return fail(res, 503, "auth_not_configured", "Password recovery is not configured yet."); const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${process.env.PUBLIC_ORIGIN}/reset-password` }); if (error) return fail(res, 502, "recovery_failed", "We could not request a recovery email."); const status = process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL ? await sendTransactional(parsed.data.email, "Reset your OralCare+ password", `<p>A password reset was requested for your OralCare+ account.</p><p>Use the secure link in the authentication email to choose a new password.</p>`, "A password reset was requested for your OralCare+ account. Use the secure authentication email to choose a new password.") : { sent: false, reason: "email_not_configured" }; return res.json({ ok: true, emailStatus: status }); });
app.post("/api/auth/reset-password", rateLimit(5), express.json(), async (req, res) => { const parsed = z.object({ accessToken: z.string().min(20), password: z.string().min(8).max(72), confirmPassword: z.string() }).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." }).safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "Choose a valid matching password."); const client = supabaseFor(parsed.data.accessToken); if (!client) return fail(res, 503, "auth_not_configured", "Password reset is not configured yet."); const { error } = await client.auth.updateUser({ password: parsed.data.password }); if (error) return fail(res, 400, "reset_failed", "That recovery link is invalid or expired. Request a new one."); return res.json({ ok: true }); });
app.post("/api/auth/logout", (_req, res) => { clearSessionCookies(res); return res.json({ ok: true }); });
app.get("/api/auth/me", async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const { data: profile, error } = await session.client.from("profiles").select("id,full_name,phone,role,created_at,updated_at").eq("id", session.user.id).maybeSingle(); if (error) return fail(res, 500, "profile_lookup_failed", "We could not load your profile."); return res.json({ ok: true, user: session.user, profile }); });
app.patch("/api/auth/profile", express.json(), async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const parsed = z.object({ fullName: z.string().trim().min(2).max(160), phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid international phone number with country code.") }).safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "Please correct your profile details.", parsed.error.flatten().fieldErrors); const { data, error } = await session.client.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone }).eq("id", session.user.id).select("id,full_name,phone,role,created_at,updated_at").single(); if (error) return fail(res, 500, "profile_update_failed", "We could not save your profile."); return res.json({ ok: true, profile: data }); });
app.get("/api/patient/appointments", async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const { data, error } = await session.client.from("appointments").select("id,booking_reference,starts_at,ends_at,timezone,status,patient_note,price_cents,deposit_cents,rejection_reason,created_at,services(id,name,slug,duration_minutes,currency),payments(id,amount_cents,currency,status,paid_at,paypal_capture_id)").eq("patient_id", session.user.id).order("starts_at", { ascending: false }); if (error) return fail(res, 500, "appointments_lookup_failed", "We could not load appointments."); return res.json({ ok: true, appointments: data || [] }); });
app.get("/api/patient/appointments/:id", async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const { data, error } = await session.client.from("appointments").select("id,booking_reference,starts_at,ends_at,timezone,status,patient_note,price_cents,deposit_cents,rejection_reason,created_at,services(id,name,slug,duration_minutes,currency),payments(id,amount_cents,currency,status,paid_at,paypal_capture_id)").eq("id", req.params.id).eq("patient_id", session.user.id).maybeSingle(); if (error) return fail(res, 500, "appointment_lookup_failed", "We could not load that appointment."); if (!data) return fail(res, 404, "appointment_not_found", "That appointment is not available."); return res.json({ ok: true, appointment: data }); });

app.get("/api/patient/notifications", async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const { data, error } = await session.client.from("notifications").select("id,kind,title,body,href,read_at,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(100); if (error) return fail(res, 500, "notifications_lookup_failed", "We could not load notifications."); return res.json({ ok: true, unread: (data || []).filter(item => !item.read_at).length, notifications: data || [] }); });
app.patch("/api/patient/notifications/:id/read", async (req, res) => { const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in to continue."); const { data, error } = await session.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", req.params.id).eq("user_id", session.user.id).select("id,read_at").maybeSingle(); if (error || !data) return fail(res, 404, "notification_not_found", "That notification could not be found."); return res.json({ ok: true, notification: data }); });

app.get("/api/journal", async (_req, res) => {
  const client = supabaseFor();
  if (!client) return fail(res, 503, "database_not_configured", "Journal content is not available until the database is configured.");
  const { data, error } = await client.from("journal_articles").select("id,slug,title,excerpt,body,category,author_name,featured_image_url,published_at,seo_title,seo_description").eq("status", "published").order("published_at", { ascending: false }).limit(50);
  if (error) return fail(res, 500, "journal_lookup_failed", "We could not load the journal.");
  return res.json({ ok: true, articles: data || [] });
});
app.get("/api/media/homepage", async (_req, res) => {
  const client = supabaseFor();
  if (!client) return fail(res, 503, "database_not_configured", "Homepage media is not available until the database is configured.");
  const { data, error } = await client.from("homepage_images").select("slot,image_url,alt_text").eq("active", true).order("sort_order", { ascending: true }).limit(20);
  if (error) return fail(res, 500, "homepage_media_lookup_failed", "We could not load homepage images.");
  return res.json({ ok: true, images: data || [] });
});

app.get("/api/admin/overview", async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const [appointments, pendingRequests, approvedAppointments, outstandingDeposits, paidDeposits, cancellations, upcomingVisits, enquiries, services] = await Promise.all([
    session.client.from("appointments").select("id", { count: "exact", head: true }),
    session.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    session.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "approved_deposit_required"),
    session.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "approved_deposit_required"),
    session.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "deposit_paid"),
    session.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    session.client.from("appointments").select("id", { count: "exact", head: true }).in("status", ["approved_deposit_required", "deposit_paid", "confirmed"]).gte("starts_at", new Date().toISOString()),
    session.client.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    session.client.from("services").select("id,name,published,price_mode").order("name")
  ]);
  if ([appointments, pendingRequests, approvedAppointments, outstandingDeposits, paidDeposits, cancellations, upcomingVisits, enquiries].some(result => result.error) || services.error) return fail(res, 500, "admin_lookup_failed", "We could not load clinic operations.");
  return res.json({ ok: true, counts: { appointments: appointments.count || 0, pendingRequests: pendingRequests.count || 0, approvedAppointments: approvedAppointments.count || 0, outstandingDeposits: outstandingDeposits.count || 0, paidDeposits: paidDeposits.count || 0, cancellations: cancellations.count || 0, upcomingVisits: upcomingVisits.count || 0, enquiries: enquiries.count || 0, services: services.data?.length || 0 }, services: services.data || [] });
});


app.get("/api/admin/appointments", async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const status = typeof req.query.status === "string" ? req.query.status : null;
  let query = session.client.from("appointments").select("id,patient_id,booking_reference,starts_at,ends_at,timezone,status,patient_note,price_cents,deposit_cents,rejection_reason,created_at,services(id,name,duration_minutes),payments(id,amount_cents,currency,status,paid_at,paypal_capture_id)").order("starts_at", { ascending: true }).limit(200);
  if (status && ["pending_approval", "approved_deposit_required", "deposit_paid", "pending_payment", "confirmed", "cancelled", "rejected", "payment_failed", "completed", "reschedule_requested"].includes(status)) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail(res, 500, "admin_appointments_failed", "We could not load appointments.");
  const patientIds = Array.from(new Set((data || []).map(item => item.patient_id).filter(Boolean)));
  const { data: profiles, error: profileError } = patientIds.length ? await session.client.from("profiles").select("id,full_name,phone").in("id", patientIds) : { data: [], error: null };
  if (profileError) return fail(res, 500, "admin_patients_failed", "We could not load patient details.");
  const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  return res.json({ ok: true, appointments: (data || []).map(item => ({ ...item, patient: profileMap.get(item.patient_id) || null })) });
});

app.get("/api/admin/journal", async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const { data, error } = await session.client.from("journal_articles").select("id,slug,title,excerpt,body,category,author_name,featured_image_url,published_at,status,seo_title,seo_description,updated_at").order("updated_at", { ascending: false }).limit(100);
  if (error) return fail(res, 500, "admin_journal_failed", "We could not load journal entries.");
  return res.json({ ok: true, articles: data || [] });
});
app.post("/api/admin/journal", express.json(), async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const parsed = z.object({ slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(3).max(180), excerpt: z.string().trim().min(10).max(500), body: z.string().trim().min(20).max(20000), category: z.string().trim().min(2).max(80), authorName: z.string().trim().min(2).max(120), featuredImageUrl: z.string().trim().max(500).nullable().optional(), status: z.enum(["draft", "published"]) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Review the journal title, slug, excerpt, body, and publication fields.", parsed.error.flatten().fieldErrors);
  const now = new Date().toISOString();
  const { data, error } = await session.client.from("journal_articles").insert({ slug: parsed.data.slug, title: parsed.data.title, excerpt: parsed.data.excerpt, body: parsed.data.body.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean), category: parsed.data.category, author_name: parsed.data.authorName, author_id: session.user.id, featured_image_url: parsed.data.featuredImageUrl || null, status: parsed.data.status, published_at: parsed.data.status === "published" ? now : null, updated_at: now }).select("id,slug,title,status,published_at").single();
  if (error) return fail(res, 400, "journal_create_failed", "We could not create that journal entry.");
  return res.status(201).json({ ok: true, article: data });
});
app.patch("/api/admin/journal/:id", express.json(), async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const parsed = z.object({ slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(3).max(180), excerpt: z.string().trim().min(10).max(500), body: z.string().trim().min(20).max(20000), category: z.string().trim().min(2).max(80), authorName: z.string().trim().min(2).max(120), featuredImageUrl: z.string().trim().max(500).nullable().optional(), status: z.enum(["draft", "published"]) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Review the journal title, slug, excerpt, body, and publication fields.", parsed.error.flatten().fieldErrors);
  const now = new Date().toISOString();
  const { data, error } = await session.client.from("journal_articles").update({ slug: parsed.data.slug, title: parsed.data.title, excerpt: parsed.data.excerpt, body: parsed.data.body.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean), category: parsed.data.category, author_name: parsed.data.authorName, featured_image_url: parsed.data.featuredImageUrl || null, status: parsed.data.status, published_at: parsed.data.status === "published" ? now : null, updated_at: now }).eq("id", req.params.id).select("id,slug,title,status,published_at").single();
  if (error || !data) return fail(res, 400, "journal_update_failed", "We could not update that journal entry.");
  return res.json({ ok: true, article: data });
});
app.get("/api/admin/homepage-images", async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const { data, error } = await session.client.from("homepage_images").select("id,slot,image_url,alt_text,active,sort_order,updated_at").order("slot").order("sort_order");
  if (error) return fail(res, 500, "admin_homepage_media_failed", "We could not load homepage image settings.");
  return res.json({ ok: true, images: data || [] });
});
app.patch("/api/admin/homepage-images/:id", express.json(), async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const parsed = z.object({ imageUrl: z.string().trim().min(1).max(500), altText: z.string().trim().min(3).max(240), active: z.boolean(), sortOrder: z.number().int().min(0).max(100) }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Provide a valid image URL, alt text, and display order.");
  const { data, error } = await session.client.from("homepage_images").update({ image_url: parsed.data.imageUrl, alt_text: parsed.data.altText, active: parsed.data.active, sort_order: parsed.data.sortOrder, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("id,slot,image_url,alt_text,active,sort_order,updated_at").single();
  if (error || !data) return fail(res, 400, "homepage_media_update_failed", "We could not save that homepage image.");
  return res.json({ ok: true, image: data });
});

app.get("/api/admin/services", async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const { data, error } = await session.client.from("services").select("id,slug,name,category,description,long_description,duration_minutes,price_mode,price_min_cents,price_max_cents,deposit_cents,currency,published,image_url").order("name");
  if (error) return fail(res, 500, "admin_services_failed", "We could not load service settings.");
  return res.json({ ok: true, services: data || [] });
});

app.patch("/api/admin/services/:id", express.json(), async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const parsed = z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().min(2).max(500), longDescription: z.string().trim().min(2).max(3000), durationMinutes: z.number().int().min(15).max(480), priceMode: z.enum(["published", "starting", "quote", "pending"]), priceMinCents: z.number().int().min(0).nullable(), priceMaxCents: z.number().int().min(0).nullable(), depositCents: z.number().int().min(0).max(100000), published: z.boolean(), imageUrl: z.string().trim().max(500).nullable().optional() }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Review the service name, duration, pricing, and deposit settings.", parsed.error.flatten().fieldErrors);
  if (parsed.data.priceMinCents !== null && parsed.data.priceMaxCents !== null && parsed.data.priceMaxCents < parsed.data.priceMinCents) return fail(res, 400, "validation_error", "The maximum price cannot be lower than the minimum price.");
  const { data, error } = await session.client.from("services").update({ name: parsed.data.name, description: parsed.data.description, long_description: parsed.data.longDescription, duration_minutes: parsed.data.durationMinutes, price_mode: parsed.data.priceMode, price_min_cents: parsed.data.priceMinCents, price_max_cents: parsed.data.priceMaxCents, deposit_cents: parsed.data.depositCents, published: parsed.data.published, image_url: parsed.data.imageUrl ?? null, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("id,slug,name,category,description,long_description,duration_minutes,price_mode,price_min_cents,price_max_cents,deposit_cents,currency,published,image_url").single();
  if (error || !data) return fail(res, 400, "service_update_failed", "We could not update that service.");
  return res.json({ ok: true, service: data });
});

app.patch("/api/admin/appointments/:id", express.json(), async (req, res) => {
  const session = await staffSession(req);
  if (!session) { const token = tokenFrom(req); return fail(res, token ? 403 : 401, token ? "staff_required" : "not_authenticated", token ? "A staff role is required." : "Sign in to continue."); }
  const parsed = z.object({ action: z.enum(["approve", "reject", "confirm", "cancel", "reschedule", "complete"]), startsAt: z.string().datetime().optional(), rejectionReason: z.string().trim().min(3).max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Choose a valid appointment action and required details.");
  const { data: appointment, error: appointmentError } = await session.client.from("appointments").select("id,patient_id,booking_reference,status,service_id,starts_at,ends_at,deposit_cents,services(name,duration_minutes)").eq("id", req.params.id).maybeSingle();
  if (appointmentError || !appointment) return fail(res, 404, "appointment_not_found", "That appointment could not be found.");
  const serviceRecord = appointment.services as unknown as { name?: string; duration_minutes?: number } | { name?: string; duration_minutes?: number }[] | null;
  const service = Array.isArray(serviceRecord) ? serviceRecord[0] : serviceRecord;
  const action = parsed.data.action;
  if (action === "approve") {
    if (appointment.status !== "pending_approval") return fail(res, 409, "invalid_transition", "Only pending requests can be approved.");
    const { data: overlap } = await session.client.from("appointments").select("id").neq("id", appointment.id).lt("starts_at", appointment.ends_at).gt("ends_at", appointment.starts_at).in("status", ["pending_approval", "approved_deposit_required", "pending_payment", "confirmed", "deposit_paid"]).limit(1);
    if (overlap?.length) return fail(res, 409, "slot_unavailable", "That time is no longer available.");
    const { data, error } = await session.client.from("appointments").update({ status: "approved_deposit_required", approved_at: new Date().toISOString(), approved_by: session.user.id, hold_expires_at: null }).eq("id", appointment.id).eq("status", "pending_approval").select("id,booking_reference,status,starts_at,ends_at,deposit_cents").single();
    if (error || !data) return fail(res, 409, "appointment_update_failed", "We could not approve that request.");
    const label = localAppointmentLabel(appointment.starts_at, appointment.ends_at); const amount = `CAD $${((appointment.deposit_cents || 0) / 100).toFixed(2)}`;
    await sendAppointmentNotice(session.client, appointment.id, "appointment_approved", "Appointment approved — deposit required", `Your ${service?.name || "dental"} appointment is approved for ${label}. Pay the ${amount} deposit securely from your dashboard.`, `/dashboard/appointments/${appointment.id}`, `appointment:${appointment.id}:approved`);
    await emailUser(appointment.patient_id, "Your OralCare+ appointment was approved", `<p>Your ${service?.name || "dental"} appointment has been approved.</p><p><strong>${label}</strong><br />Booking reference: <strong>${appointment.booking_reference}</strong><br />Deposit due: <strong>${amount}</strong></p><p>Sign in to OralCare+ to pay the deposit securely.</p>`, `Your appointment was approved for ${label}. Booking reference: ${appointment.booking_reference}. Deposit due: ${amount}. Sign in to pay securely.`);
    return res.json({ ok: true, appointment: data });
  }
  if (action === "reject") {
    if (appointment.status !== "pending_approval") return fail(res, 409, "invalid_transition", "Only pending requests can be rejected.");
    const reason = parsed.data.rejectionReason || "The clinic could not approve this requested time.";
    const { data, error } = await session.client.from("appointments").update({ status: "rejected", rejected_at: new Date().toISOString(), rejected_by: session.user.id, rejection_reason: reason, hold_expires_at: null }).eq("id", appointment.id).eq("status", "pending_approval").select("id,booking_reference,status,rejection_reason").single();
    if (error || !data) return fail(res, 409, "appointment_update_failed", "We could not reject that request.");
    await sendAppointmentNotice(session.client, appointment.id, "appointment_rejected", "Appointment request not approved", `Your appointment request ${appointment.booking_reference} was not approved. Reason: ${reason}`, `/dashboard/appointments/${appointment.id}`, `appointment:${appointment.id}:rejected`);
    await emailUser(appointment.patient_id, "Update on your OralCare+ appointment request", `<p>Your appointment request <strong>${appointment.booking_reference}</strong> was not approved.</p><p>Reason: ${reason}</p><p>Sign in to OralCare+ to choose another time or contact the clinic.</p>`, `Your appointment request ${appointment.booking_reference} was not approved. Reason: ${reason}`);
    return res.json({ ok: true, appointment: data });
  }
  if (action === "reschedule") {
    if (!parsed.data.startsAt || Number.isNaN(new Date(parsed.data.startsAt).getTime()) || !service?.duration_minutes) return fail(res, 400, "validation_error", "Choose a valid new appointment time.");
    const starts = new Date(parsed.data.startsAt); const ends = new Date(starts.getTime() + service.duration_minutes * 60_000);
    const { data: overlap } = await session.client.from("appointments").select("id").neq("id", appointment.id).lt("starts_at", ends.toISOString()).gt("ends_at", starts.toISOString()).in("status", ["pending_approval", "approved_deposit_required", "pending_payment", "confirmed", "deposit_paid"]).limit(1);
    if (overlap?.length) return fail(res, 409, "slot_unavailable", "That time overlaps another appointment.");
    const { data, error } = await session.client.from("appointments").update({ starts_at: starts.toISOString(), ends_at: ends.toISOString(), hold_expires_at: null }).eq("id", appointment.id).select("id,booking_reference,status,starts_at,ends_at").single();
    if (error || !data) return fail(res, 400, "appointment_update_failed", "We could not reschedule that appointment.");
    await sendAppointmentNotice(session.client, appointment.id, "appointment_rescheduled", "Appointment time updated", `Your appointment ${appointment.booking_reference} is now scheduled for ${localAppointmentLabel(data.starts_at, data.ends_at)}.`, `/dashboard/appointments/${appointment.id}`, `appointment:${appointment.id}:rescheduled:${data.starts_at}`);
    return res.json({ ok: true, appointment: data });
  }
  const targetStatus = action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "confirmed";
  if (action === "complete" && !["deposit_paid", "confirmed"].includes(appointment.status)) return fail(res, 409, "invalid_transition", "Only paid or confirmed appointments can be completed.");
  if (action === "confirm" && !["deposit_paid", "confirmed"].includes(appointment.status)) return fail(res, 409, "invalid_transition", "Only paid appointments can be confirmed.");
  const { data, error } = await session.client.from("appointments").update({ status: targetStatus, hold_expires_at: null }).eq("id", appointment.id).select("id,booking_reference,status,starts_at,ends_at").single();
  if (error || !data) return fail(res, 400, "appointment_update_failed", "We could not update that appointment.");
  if (action === "cancel") { await sendAppointmentNotice(session.client, appointment.id, "appointment_cancelled", "Appointment cancelled", `Your appointment ${appointment.booking_reference} has been cancelled.`, `/dashboard/appointments/${appointment.id}`, `appointment:${appointment.id}:cancelled`); }
  return res.json({ ok: true, appointment: data });
});

app.get("/api/services", async (_req, res) => { const client = supabaseFor(); if (!client) return fail(res, 503, "database_not_configured", "Services are not available until the database is configured."); const { data, error } = await client.from("services").select("id,slug,name,category,description,long_description,duration_minutes,price_mode,price_min_cents,price_max_cents,deposit_cents,currency,image_url").eq("published", true).order("name"); if (error) return fail(res, 500, "services_lookup_failed", "We could not load services."); return res.json({ ok: true, services: data || [] }); });
app.get("/api/booking/availability", async (req, res) => { const parsed = z.object({ serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query); if (!parsed.success) return fail(res, 400, "validation_error", "Choose a valid service and date."); const client = supabaseFor(); if (!client) return fail(res, 503, "database_not_configured", "Live availability is not configured."); const { data: service, error: serviceError } = await client.from("services").select("id,duration_minutes,published").eq("id", parsed.data.serviceId).eq("published", true).maybeSingle(); if (serviceError || !service?.duration_minutes) return fail(res, 409, "service_not_configured", "This service is not ready for online booking."); const start = localToUtc(parsed.data.date, "00:00"); const next = new Date(start.getTime() + 24 * 60 * 60 * 1000); const { data: appointments, error } = await client.from("appointments").select("starts_at,ends_at,status").lt("starts_at", next.toISOString()).gte("ends_at", start.toISOString()).in("status", ["pending_approval", "approved_deposit_required", "pending_payment", "confirmed", "deposit_paid"]); if (error) return fail(res, 500, "availability_lookup_failed", "We could not load availability."); const busy = (appointments || []).map(item => [new Date(item.starts_at).getTime(), new Date(item.ends_at).getTime()] as const); const slots = slotTimes(parsed.data.date, service.duration_minutes).filter(slot => !busy.some(([busyStart, busyEnd]) => slot.getTime() < busyEnd && slot.getTime() + service.duration_minutes! * 60_000 > busyStart)).map(slot => ({ startsAt: slot.toISOString(), label: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(slot) })); return res.json({ ok: true, timezone, serviceId: parsed.data.serviceId, date: parsed.data.date, slots }); });

const bookingSchema = z.object({ serviceId: z.string().uuid(), startsAt: z.string().datetime(), patientNote: z.string().trim().max(1000).optional(), policyAccepted: z.literal(true) });
app.post("/api/booking", rateLimit(10), express.json(), async (req, res) => {
  const session = await authenticated(req);
  if (!session) return fail(res, 401, "not_authenticated", "Sign in before booking an appointment.");
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "validation_error", "Review the service, time, and policy acceptance.", parsed.error.flatten().fieldErrors);
  const { data: service, error: serviceError } = await session.client.from("services").select("id,name,duration_minutes,deposit_cents,price_min_cents,price_mode,currency,published").eq("id", parsed.data.serviceId).eq("published", true).maybeSingle();
  if (serviceError || !service?.duration_minutes) return fail(res, 409, "service_not_configured", "This service is not ready for online booking.");
  const starts = new Date(parsed.data.startsAt); const ends = new Date(starts.getTime() + service.duration_minutes * 60_000);
  const { data: createdRows, error: createError } = await session.client.rpc("create_appointment_request", { p_service_id: service.id, p_starts_at: starts.toISOString(), p_ends_at: ends.toISOString(), p_timezone: timezone, p_patient_note: parsed.data.patientNote || null, p_policy_accepted_at: new Date().toISOString() });
  const appointment = Array.isArray(createdRows) ? createdRows[0] : createdRows;
  if (createError || !appointment) {
    const message = createError?.message || "";
    if (message.includes("slot_unavailable")) return fail(res, 409, "slot_unavailable", "That time is no longer available. Choose another slot.");
    if (message.includes("service_not_configured")) return fail(res, 409, "service_not_configured", "This service is not ready for online booking.");
    return fail(res, 409, "appointment_request_failed", "That appointment request could not be saved.");
  }
  await session.client.rpc("notify_staff_booking_request", { p_appointment_id: appointment.id });
  await sendTransactional(session.user.email || "", "OralCare+ appointment request received", `<p>We received your appointment request for <strong>${service.name}</strong>.</p><p><strong>${localAppointmentLabel(appointment.starts_at, appointment.ends_at)}</strong><br />Booking reference: <strong>${appointment.booking_reference}</strong><br />Status: <strong>Pending Approval</strong></p><p>No payment is requested until the clinic reviews and approves the request.</p>`, `We received your appointment request for ${service.name}. ${localAppointmentLabel(appointment.starts_at, appointment.ends_at)}. Booking reference: ${appointment.booking_reference}. Status: Pending Approval. No payment is requested until approval.`);
  return res.status(201).json({ ok: true, appointment, status: "pending_approval" });
});

app.post("/api/enquiries", rateLimit(5), express.json(), async (req, res) => { const parsed = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), message: z.string().trim().min(10).max(3000) }).safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "Please enter your name, email, and message."); const client = supabaseFor(); if (!client) return fail(res, 503, "database_not_configured", "Contact forms are not configured yet."); const { error } = await client.from("enquiries").insert(parsed.data); if (error) return fail(res, 500, "enquiry_failed", "We could not send your enquiry."); return res.status(201).json({ ok: true }); });

app.post("/api/patient/appointments/:id/pay", rateLimit(10), express.json(), async (req, res) => {
  const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in before paying a deposit.");
  const { data: appointment, error } = await session.client.from("appointments").select("id,booking_reference,patient_id,status,starts_at,ends_at,deposit_cents,services(name,currency)").eq("id", req.params.id).eq("patient_id", session.user.id).maybeSingle();
  if (error || !appointment) return fail(res, 404, "appointment_not_found", "That appointment could not be found.");
  if (appointment.status !== "approved_deposit_required") return fail(res, 409, "deposit_not_due", "This appointment is not currently awaiting a deposit.");
  if (!paymentsConfigured) return fail(res, 503, "payments_not_configured", "PayPal online deposits are not configured yet.");
  const { data: paymentRows, error: paymentError } = await session.client.rpc("create_pending_payment", { p_appointment_id: appointment.id });
  const payment = Array.isArray(paymentRows) ? paymentRows[0] : paymentRows;
  if (paymentError || !payment) return fail(res, 500, "payment_record_failed", "We could not prepare the secure payment step.");
  try {
    const serviceRecord = appointment.services as unknown as { name?: string; currency?: string } | { name?: string; currency?: string }[] | null; const service = Array.isArray(serviceRecord) ? serviceRecord[0] : serviceRecord;
    const order = await paypalRequest<{ id: string; links?: { rel: string; href: string }[] }>("/v2/checkout/orders", { method: "POST", body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: appointment.id, custom_id: appointment.id, invoice_id: payment.id, description: `${service?.name || "Dental"} appointment deposit`, amount: { currency_code: service?.currency || "CAD", value: ((appointment.deposit_cents || 0) / 100).toFixed(2) } }], application_context: { brand_name: "OralCare+", user_action: "PAY_NOW", return_url: `${publicOrigin}/payment/return`, cancel_url: `${publicOrigin}/dashboard/appointments/${appointment.id}` } }) });
    const approval = order.links?.find(link => link.rel === "approve")?.href; if (!order.id || !approval) throw new Error("paypal_approval_missing");
    await session.client.from("payments").update({ paypal_order_id: order.id }).eq("id", payment.id).eq("appointment_id", appointment.id);
    return res.status(201).json({ ok: true, checkoutUrl: approval, paypalOrderId: order.id, appointmentId: appointment.id });
  } catch { await session.client.from("payments").update({ status: "failed" }).eq("id", payment.id); return fail(res, 503, "checkout_unavailable", "PayPal checkout is temporarily unavailable. You can retry from your dashboard."); }
});

app.post("/api/paypal/capture", rateLimit(10), express.json(), async (req, res) => {
  const session = await authenticated(req); if (!session) return fail(res, 401, "not_authenticated", "Sign in before completing payment.");
  const parsed = z.object({ orderId: z.string().min(5).max(100) }).safeParse(req.body); if (!parsed.success) return fail(res, 400, "validation_error", "A valid PayPal order is required.");
  const { data: payment, error: paymentError } = await session.client.from("payments").select("id,appointment_id,amount_cents,currency,status,paypal_order_id").eq("patient_id", session.user.id).eq("paypal_order_id", parsed.data.orderId).maybeSingle();
  if (paymentError || !payment) return fail(res, 404, "payment_not_found", "That PayPal payment could not be matched to your appointment.");
  if (payment.status === "paid") return res.json({ ok: true, status: "paid" });
  try {
    const capture = await paypalRequest<{ status?: string; purchase_units?: { payments?: { captures?: { id?: string; status?: string; amount?: { currency_code?: string; value?: string } }[] } }[] }>(`/v2/checkout/orders/${encodeURIComponent(parsed.data.orderId)}/capture`, { method: "POST", body: "{}" });
    const captureRecord = capture.purchase_units?.[0]?.payments?.captures?.[0]; const expectedAmount = (payment.amount_cents / 100).toFixed(2);
    if (capture.status !== "COMPLETED" || captureRecord?.status !== "COMPLETED" || captureRecord.amount?.currency_code !== payment.currency || captureRecord?.amount?.value !== expectedAmount) { await session.client.from("payments").update({ status: "failed" }).eq("id", payment.id); return fail(res, 402, "payment_not_completed", "PayPal did not confirm the expected payment amount."); }
    const { data: updatedPayment, error: updateError } = await session.client.from("payments").update({ status: "paid", paypal_capture_id: captureRecord.id || null, paid_at: new Date().toISOString() }).eq("id", payment.id).eq("paypal_order_id", parsed.data.orderId).select("id,appointment_id,amount_cents,currency,status,paid_at,paypal_capture_id").single();
    if (updateError || !updatedPayment) return fail(res, 500, "payment_record_failed", "The payment was verified but could not be recorded.");
    const { data: updatedAppointment, error: appointmentError } = await session.client.from("appointments").update({ status: "deposit_paid", hold_expires_at: null }).eq("id", payment.appointment_id).eq("patient_id", session.user.id).eq("status", "approved_deposit_required").select("id,booking_reference,status,starts_at,ends_at").single();
    if (appointmentError || !updatedAppointment) return fail(res, 409, "appointment_update_failed", "The payment was recorded, but the appointment status needs clinic reconciliation.");
    await sendSelfNotice(session.client, payment.appointment_id, "payment_received", "Deposit received", `Your CAD $${expectedAmount} deposit was verified. Reference: ${captureRecord.id || updatedPayment.id}.`, `/dashboard/appointments/${payment.appointment_id}`, `appointment:${payment.appointment_id}:payment:${captureRecord.id || updatedPayment.id}`);
    await sendTransactional(session.user.email || "", "OralCare+ deposit receipt", `<p>Your deposit has been verified for booking <strong>${updatedAppointment.booking_reference}</strong>.</p><p>Amount paid: <strong>CAD $${expectedAmount}</strong><br />Payment reference: <strong>${captureRecord.id || updatedPayment.id}</strong><br />Appointment: <strong>${localAppointmentLabel(updatedAppointment.starts_at, updatedAppointment.ends_at)}</strong></p>`, `Your CAD $${expectedAmount} deposit was verified for booking ${updatedAppointment.booking_reference}. Payment reference: ${captureRecord.id || updatedPayment.id}. Appointment: ${localAppointmentLabel(updatedAppointment.starts_at, updatedAppointment.ends_at)}.`);
    return res.json({ ok: true, status: "paid", appointment: updatedAppointment, payment: updatedPayment });
  } catch { await session.client.from("payments").update({ status: "failed" }).eq("id", payment.id); return fail(res, 502, "payment_capture_failed", "PayPal could not verify this payment. You can retry from your dashboard."); }
});

async function start() {
  const hasBuiltBundle = existsSync(path.join(root, "dist", "index.html"));
  if (process.env.NODE_ENV === "production" || hasBuiltBundle) { app.use(express.json()); app.use(express.static(path.join(root, "dist"))); app.use((req, res) => res.sendFile(path.join(root, "dist", "index.html"))); }
  else { const vite = await createViteServer({ root: path.join(root, "client"), server: { middlewareMode: true, hmr: false, allowedHosts: true }, appType: "spa" }); app.use(async (req, res, next) => { if (req.method !== "GET" || req.path.startsWith("/api") || req.path.includes(".")) return next(); try { const template = await fs.readFile(path.join(root, "client", "index.html"), "utf8"); const html = await vite.transformIndexHtml(req.originalUrl, template); res.status(res.statusCode === 404 ? 404 : 200).type("html").send(html.replace(/<script type="module" src="\/@vite\/client"><\/script>\s*/g, "")); } catch (error) { vite.ssrFixStacktrace(error as Error); next(error); } }); app.use(vite.middlewares); }
  app.listen(port, "0.0.0.0", () => console.log(`OralCare+ listening on http://0.0.0.0:${port}`));
}
start().catch(error => { console.error(error); process.exit(1); });
