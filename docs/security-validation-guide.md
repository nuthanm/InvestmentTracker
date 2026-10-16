# Security Validation Guide

How to **validate** common security issues in InvestmentTracker **before** applying fixes. Each finding uses the same format so you can reason about risk, reproduce it safely, and know when a fix actually worked.

> **Scope:** Personal finance web app (Next.js + Neon Postgres). These checks apply to most web apps, not only messaging platforms.

---

## How to use this guide

1. **Run the app locally** with a test database (`npm run dev`, `.env.local` configured).
2. **Use a dedicated test account** — never run these checks against production user data.
3. For each finding below:
   - Read **What to pass** (the input or request pattern).
   - Understand **What could happen** (impact if exploited).
   - Follow **How to validate** (reproduce or probe the weakness).
   - After a fix, use **Fixed when** as acceptance criteria.
4. Record results in a simple table:

| ID | Finding | Validated? | Vulnerable? | Notes |
|----|---------|------------|-----------|-------|
| S-01 | Malicious PDF upload | | | |

---

## Validation methods (overview)

| Method | When to use | Tools |
|--------|-------------|-------|
| **Manual UI** | Flows that depend on the browser (login, signup, file upload) | Browser + DevTools |
| **Direct API (curl)** | Bypass client checks, test auth/IDOR/enumeration | `curl`, browser cookie jar |
| **Unauthenticated request** | IDOR, public endpoints, missing auth | `curl` without session cookie |
| **Cross-user test** | IDOR — User A tries User B's resource IDs | Two test accounts |
| **Response diff** | Enumeration — compare status/body for valid vs invalid input | `curl` + `diff` |
| **DB inspection** | At-rest secrets, plaintext storage | Neon SQL Editor |
| **Header check** | Missing CSP, HSTS, etc. | `curl -I` |

### Getting a session cookie for API tests

```bash
# 1. Log in and save cookies
curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"YourTestPass1!"}'

# 2. Reuse cookie on protected routes
curl -b /tmp/cookies.txt http://localhost:3000/api/investments
```

---

## Finding template (reference)

Every section below follows this structure:

```
### [ID] Title
**Category:** … | **Severity:** …

**What to pass**
  → The request, payload, or behavior an attacker would use.

**What could happen**
  → Realistic impact on users or the system.

**How to validate**
  → Step-by-step reproduction (safe, local).

**Fixed when**
  → Observable criteria after remediation.

**Recommended fix**
  → Direction for implementation (not necessarily done yet).
```

---

## S-01 — Malicious document upload (stored XSS / abuse)

**Category:** RCE / XSS adjacent | **Severity:** Medium–High

### What to pass

Bypass the UI and POST an investment with a non-PDF `data_url`, for example HTML/JavaScript in a data URI:

```json
{
  "type_code": "FD",
  "bank": "Test Bank",
  "plan_name": "Test",
  "amount": 10000,
  "rate_pct": 7,
  "tenure_months": 12,
  "nominee": "Self",
  "goal_id": "<valid-goal-uuid>",
  "documents": [{
    "filename": "evil.html",
    "size_bytes": 500,
    "page_count": 1,
    "data_url": "data:text/html,<script>alert('xss')</script>"
  }]
}
```

The UI only allows PDFs up to 5 MB (`NewInvestmentClient.js`); the API does not re-check.

### What could happen

- **Stored XSS:** When the victim opens the document viewer (`<iframe src={data_url}>`), script in a `data:text/html` URL may execute in their browser context.
- **Abuse of storage:** Huge base64 blobs can bloat the database (DoS / cost).
- **Not classic RCE** on the server, but attacker-controlled content in another user's session is still a serious web vulnerability.

### How to validate

1. Sign in as User A; create a goal and note its `goal_id`.
2. Call `POST /api/investments` with the JSON above (authenticated cookie).
3. Open the investment detail page and click to view the document.
4. **Vulnerable if:** the iframe loads non-PDF content or a script alert runs.
5. **Also try:** `data_url` larger than 5 MB — **vulnerable if** API accepts it.

```bash
curl -b /tmp/cookies.txt -X POST http://localhost:3000/api/investments \
  -H 'Content-Type: application/json' \
  -d @payload-malicious-doc.json
```

### Fixed when

- API rejects non-`application/pdf` payloads and enforces max size server-side.
- `data_url` must start with `data:application/pdf;base64,` (or files are stored outside the DB with signed URLs).
- CSP blocks inline script execution even if bad content is stored.
- Viewing a previously uploaded malicious doc no longer executes script.

### Recommended fix

- Validate MIME, magic bytes (`%PDF`), and size in `app/api/investments/route.js` and PATCH handler.
- Serve documents with `Content-Disposition: attachment` or use object storage + short-lived signed URLs.
- Add `Content-Security-Policy` (see S-10).

---

## S-02 — IDOR on another user's resources

**Category:** IDOR / unauthorized data access | **Severity:** High

### What to pass

Authenticated as **User A**, request **User B's** resource UUIDs:

```bash
# User A's cookie, User B's investment ID
curl -b /tmp/cookies-userA.txt \
  http://localhost:3000/api/investments/<USER_B_INVESTMENT_UUID>

curl -b /tmp/cookies-userA.txt -X DELETE \
  http://localhost:3000/api/investments/<USER_B_INVESTMENT_UUID>

curl -b /tmp/cookies-userA.txt -X PATCH \
  http://localhost:3000/api/notifications \
  -H 'Content-Type: application/json' \
  -d '{"id":"<USER_B_NOTIFICATION_UUID>"}'
```

Repeat for goals, payments, transactions.

### What could happen

- Attacker reads another user's investments, PDFs, amounts, nominees.
- Attacker modifies or deletes another user's financial records.
- Compliance and trust failure; direct privacy breach.

### How to validate

1. Create **two accounts** (A and B). As B, create an investment; copy its `id` from the URL or API.
2. Log in as A only; call GET/PATCH/DELETE on B's IDs.
3. **Vulnerable if:** response is `200` with B's data, or B's row is changed/deleted.
4. **Secure if:** `404` or `403` and no data leak in body.

Also test **without any cookie**:

```bash
curl http://localhost:3000/api/investments/<ANY_UUID>
```

**Vulnerable if:** `200` with data. **Secure if:** `401`.

### Fixed when

- All mutating and read endpoints require `getCurrentUser()`.
- Every query includes `AND user_id = ${me.id}` (or equivalent ownership join).
- Unauthenticated requests always get `401`.
- New routes follow the same pattern (consider central middleware).

### Recommended fix

- Keep the current `user_id` scoping pattern; add Next.js middleware as a safety net.
- Add `user_id` to `documents` for defense in depth.

---

## S-03 — Account enumeration (login / signup / reset)

**Category:** Account takeover (recon) | **Severity:** Medium

### What to pass

Same password, different emails — compare HTTP status and error messages:

```bash
# Unknown email
curl -s -o /tmp/r1.json -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com","password":"WrongPass1!"}'

# Known email, wrong password
curl -s -o /tmp/r2.json -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"WrongPass1!"}'
```

Signup with existing email:

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com", ...}'
```

Password reset with unknown email:

```bash
curl -X POST http://localhost:3000/api/auth/password/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com","method":"recovery_key","recoveryKey":"wrongkey12"}'
```

### What could happen

- Attacker builds a list of valid emails for phishing, credential stuffing, or targeted recovery attacks.
- Makes brute force and social engineering cheaper.

### How to validate

1. Compare status codes: login returns `404` (unknown) vs `401` (wrong password) today.
2. Compare response bodies — different messages reveal account existence.
3. Signup `409` confirms email is registered.
4. **Vulnerable if:** attacker can distinguish registered vs unregistered emails reliably.

### Fixed when

- Login, signup conflict, and reset return **same status** (e.g. `401` or `400`) and **generic message** (e.g. "Invalid email or password") for all failure cases.
- Timing differences are minimized where feasible.

### Recommended fix

- Unify error responses in `login`, `signup`, and `password/request` routes.
- Always run password verify (or dummy bcrypt) even when user not found to reduce timing leaks.

---

## S-04 — Unauthenticated security questions leak

**Category:** Account takeover (recon) | **Severity:** Medium–High

### What to pass

No session — only victim email:

```bash
curl "http://localhost:3000/api/auth/security-questions?email=victim@example.com"
```

### What could happen

- Anyone learns the victim's recovery questions (e.g. "Mother's maiden name?").
- Attacker researches answers on social media and uses **password reset via security questions** (`POST /api/auth/password/request` with `method: "security_questions"`).
- Full account takeover without knowing the password.

### How to validate

1. Complete signup with security questions for `test@example.com`.
2. Call GET above **without** logging in.
3. **Vulnerable if:** `200` with `{ questions: [...] }`.
4. **Secure if:** `401`/`403`, or endpoint removed; questions only shown after additional verification.

### Fixed when

- Endpoint requires authentication, or
- Questions are never returned by email alone (e.g. only after recovery key + email), or
- Security-question recovery is removed in favor of stronger factors.

### Recommended fix

- Remove public GET or gate behind rate-limited, multi-step recovery.
- Prefer recovery key + backup codes only.

---

## S-05 — No rate limiting on authentication

**Category:** Account takeover (brute force) | **Severity:** Medium–High

### What to pass

Many rapid login or recovery attempts:

```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"guess'$i'"}'
done
```

Same for MFA challenge, `password/request`, and `security-questions`.

### What could happen

- **Password spraying / brute force** across many passwords or accounts.
- Lockout (5 failures / 15 min) helps **per account** but not **per IP** across many accounts.
- Recovery endpoints can be hammered to guess backup codes or security answers.

### How to validate

1. Run 50+ login attempts in a loop from one IP.
2. **Vulnerable if:** all requests are processed; no `429 Too Many Requests`.
3. Account lockout alone is **not** sufficient if attacker rotates emails or targets reset flows.

### Fixed when

- Excess requests return `429` with `Retry-After`.
- Limits apply per IP (and optionally per email) on `/api/auth/*`.
- Legitimate users can still log in after a short window.

### Recommended fix

- Edge rate limiting (Vercel, Cloudflare) or in-app limiter (e.g. Upstash Redis).
- Stricter limits on reset and MFA endpoints.

---

## S-06 — Password reset link exposure

**Category:** Account takeover | **Severity:** High (if API is exposed)

### What to pass

Valid recovery verification, then inspect JSON response:

```bash
curl -X POST http://localhost:3000/api/auth/password/request \
  -H 'Content-Type: application/json' \
  -d '{
    "email":"test@example.com",
    "method":"recovery_key",
    "recoveryKey":"<correct-recovery-key>"
  }'
```

Response today includes `resetUrl` with a one-time token.

### What could happen

- Reset link appears in API JSON instead of email — anyone who can read the response (proxy, logs, XSS, shared screen) can take over the account.
- Token in browser history or server logs.

### How to validate

1. Complete a valid reset request.
2. **Vulnerable if:** response body contains full `resetUrl` with `token=...`.
3. Check server/client logs for token leakage.

### Fixed when

- Token sent only via out-of-band channel (email/SMS) or shown once in a secure UI step with no logging.
- Response is generic: `{ ok: true }` only.
- Reset tokens are single-use and short-lived (already partially true — 30 min).

### Recommended fix

- Integrate transactional email; never return `resetUrl` in API.
- Until email exists, document that this flow is **dev-only**.

---

## S-07 — Weak hashing for recovery secrets

**Category:** Account takeover (offline crack) | **Severity:** Medium

### What to pass

Not an HTTP payload — inspect **database** after signup:

```sql
SELECT answer_hash FROM user_security_questions WHERE user_id = '<uuid>';
SELECT code_hash FROM backup_recovery_codes WHERE user_id = '<uuid>';
SELECT mfa_secret FROM users WHERE email = 'test@example.com';
```

### What could happen

- **Security answers:** SHA-256 without salt — rainbow tables crack common answers ("blue", "smith").
- **Backup codes:** 8 hex chars, SHA-256 — feasible to brute force if DB is leaked.
- **MFA secret plaintext:** DB breach → attacker generates valid TOTP codes.

### How to validate

1. Sign up; answer security questions with a weak answer like `"red"`.
2. Query `answer_hash` — **vulnerable if:** same answer always yields same hash (no per-user salt).
3. Check `mfa_secret` — **vulnerable if:** readable TOTP seed string.

### Fixed when

- Security answers use bcrypt/scrypt with per-user salt.
- Backup codes use slow hash or longer entropy.
- MFA secrets encrypted at rest (KMS/envelope encryption) or stored in a secrets vault.

### Recommended fix

- `hashAnswer()` → bcrypt in `lib/security.js`.
- Encrypt `mfa_secret` column with app-level key from env.

---

## S-08 — Session fixation / cookie flags

**Category:** Account takeover / session hijack | **Severity:** Low–Medium

### What to pass

Inspect `Set-Cookie` on login and behavior over HTTP (dev):

```bash
curl -v -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"..."}'
```

Check for: `HttpOnly`, `Secure`, `SameSite`, random token, expiry.

### What could happen

- Without `HttpOnly`: XSS steals session cookie.
- Without `Secure`: cookie sent over HTTP on misconfigured deploy.
- Without `SameSite`: some CSRF scenarios easier.
- Predictable session IDs: session guessing (not an issue here — 32-byte random).

### How to validate

1. Inspect `Set-Cookie` headers from `createSession()`.
2. **Good today:** `httpOnly`, `sameSite=lax`, `secure` in production, random 64-char hex.
3. Try accessing `/api/investments` with expired or forged cookie — **secure if** `401`.

Note: `SESSION_SECRET` in `.env.example` is **unused**; sessions are DB-backed opaque tokens (acceptable, but docs are misleading).

### Fixed when

- Cookie flags remain correct in production.
- README matches implementation (remove or use `SESSION_SECRET`).
- Session invalidation on password change/reset (already on reset).

### Recommended fix

- Document actual session model; optional signed cookie layer.
- Rotate sessions on privilege change.

---

## S-09 — CSRF on state-changing APIs

**Category:** Unauthorized action | **Severity:** Low–Medium

### What to pass

Trick a logged-in user into submitting a form from another site:

```html
<!-- evil.example.com -->
<form action="https://your-app.vercel.app/api/investments/<id>" method="POST">
  <input name="..." value="..." />
</form>
<script>document.forms[0].submit()</script>
```

Or cross-site `fetch` with `credentials: 'include'` (browser-dependent with `SameSite`).

### What could happen

- Attacker performs actions as the victim: delete investment, change password, export data.
- Impact depends on endpoint; `SameSite=Lax` blocks many cross-site POSTs but not all vectors.

### How to validate

1. Host a simple HTML page on another origin (or use browser console).
2. Attempt cross-site POST to PATCH/DELETE while victim is logged in.
3. **Partially mitigated if:** cookie is `SameSite=Lax` (blocks most cross-site POST).
4. **Still vulnerable** for top-level GET navigation tricks or if `SameSite=None` is ever set.

### Fixed when

- CSRF tokens on mutating requests, or `SameSite=Strict` for sensitive ops.
- Critical actions (delete account, change password) require re-auth or custom header.

### Recommended fix

- Double-submit cookie or synchronizer token for POST/PATCH/DELETE.
- Require `Content-Type: application/json` + custom header for API mutations.

---

## S-10 — Missing security headers

**Category:** Defense in depth (XSS, clickjacking) | **Severity:** Medium

### What to pass

Inspect response headers:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/api/investments
```

Look for absence of: `Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`.

### What could happen

- **No CSP:** XSS payloads (e.g. S-01) execute more easily.
- **No frame protection:** UI clickjacking.
- **No HSTS:** SSL stripping on first visit (production).

### How to validate

1. `curl -I` on pages and API routes.
2. **Vulnerable if:** headers are missing (true for default `next.config.js` today).

### Fixed when

- Headers present on all HTML and API responses.
- CSP allows only trusted script/style sources.

### Recommended fix

- Add `headers()` in `next.config.js` or middleware.

---

## S-11 — SQL injection

**Category:** RCE / data breach | **Severity:** Critical (if present)

### What to pass

SQL metacharacters in inputs:

```bash
curl -b /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com'\'' OR 1=1--","password":"x"}'

curl -b /tmp/cookies.txt \
  "http://localhost:3000/api/investments/00000000-0000-0000-0000-000000000001;DROP%20TABLE%20users--"
```

### What could happen

- Full database read/write, authentication bypass, data destruction.

### How to validate

1. Inject quotes, `--`, `;` in email, IDs, search fields.
2. Watch for 500 errors with SQL fragments in logs (information leak).
3. **Secure if:** queries use parameterized templates (`sql\`...\${var}...\``) — current codebase pattern.

### Fixed when

- No string concatenation into SQL.
- Invalid UUIDs return `400`, not server errors with SQL details.

### Recommended fix

- Keep Neon tagged templates; never interpolate user input into raw SQL strings.

---

## S-12 — Sensitive data at rest (finance / PDFs)

**Category:** Data confidentiality | **Severity:** Medium (context-dependent)

### What to pass

DB access (insider, leaked `DATABASE_URL`, SQL injection):

```sql
SELECT amount, bank, plan_name, nominee FROM investments LIMIT 5;
SELECT LEFT(data_url, 80) FROM documents LIMIT 1;
SELECT mfa_secret, email FROM users LIMIT 1;
```

### What could happen

- Complete exposure of financial portfolio, identity (nominee), and documents.
- MFA bypass if secrets are plaintext.

### How to validate

1. Run queries in Neon SQL Editor with app DB credentials.
2. **Vulnerable if:** all fields readable without additional decryption keys.

### Fixed when

- Threat model documented (personal tracker vs regulated finance).
- Optional: field-level encryption for PDFs and amounts; encrypted MFA secrets.

### Recommended fix

- Encrypt high-sensitivity columns; restrict DB access; rotate credentials.

---

## S-13 — SSRF (future feature risk)

**Category:** SSRF | **Severity:** N/A today

### What to pass

If you add "import from URL", webhooks, or PDF from URL:

```json
{ "url": "http://169.254.169.254/latest/meta-data/" }
{ "url": "http://localhost:5432/" }
```

### What could happen

- Server fetches internal cloud metadata, scans internal network, accesses admin services.

### How to validate

- **Today:** no server-side `fetch(userUrl)` — nothing to test.
- **Before shipping URL features:** block private IPs, localhost, link-local; allowlist domains.

### Fixed when

- URL fetch uses allowlist, DNS rebinding protections, and no raw redirects to internal hosts.

### Recommended fix

- Design URL ingestion with SSRF checklist before implementation.

---

## S-14 — Information disclosure via errors and exports

**Category:** Unauthorized data access | **Severity:** Low–Medium

### What to pass

- Trigger invalid UUIDs, missing tables, verbose 500 responses.
- Call `GET /api/auth/export` as authenticated user — ensure unauthenticated cannot.

```bash
curl http://localhost:3000/api/auth/export
# expect 401

curl -b /tmp/cookies.txt http://localhost:3000/api/auth/export
# expect CSV only for own data
```

### What could happen

- Stack traces or migration hints leak implementation details.
- Export without auth leaks all user data (critical).

### How to validate

1. Send malformed IDs; check JSON errors for internal paths/SQL.
2. Export without cookie — **vulnerable if** CSV returned.

### Fixed when

- Generic errors to clients; details only in server logs.
- Export and delete-account require session + password confirmation.

### Recommended fix

- Central error handler; audit export/delete routes.

---

## Priority matrix (validation order)

| Priority | ID | Why validate first |
|----------|-----|-------------------|
| 1 | S-02 | IDOR — direct data breach |
| 2 | S-01 | Upload XSS — easy API bypass |
| 3 | S-04 | Security questions — account takeover path |
| 4 | S-05 | Brute force — no rate limits |
| 5 | S-06 | Reset URL in response |
| 6 | S-03 | Enumeration — low effort recon |
| 7 | S-10 | Headers — amplifies other bugs |
| 8 | S-07 | DB leak scenario |
| 9 | S-09 | CSRF — partially mitigated |
| 10 | S-08, S-11, S-12, S-13, S-14 | Baseline / future / context |

---

## Safe testing rules

- **Do not** run brute-force or scanning tools against production.
- **Do not** test on real user accounts or real financial data.
- **Do** use isolated Neon branch/database for destructive tests (DELETE, large uploads).
- **Do** capture request/response pairs as evidence before and after fixes.
- **Do** re-run the same validation steps after each fix — regression checks matter.

---

## Quick checklist before production

- [ ] S-02: Cross-user ID access denied on all resources
- [ ] S-01: API rejects invalid document uploads
- [ ] S-04: Security questions not public by email
- [ ] S-05: Rate limits on auth endpoints
- [ ] S-06: Reset tokens not in API JSON (or email integrated)
- [ ] S-03: Uniform auth error messages
- [ ] S-10: Security headers configured
- [ ] S-11: No SQL injection on fuzzed inputs
- [ ] S-08: Session cookies correct in production (`Secure`, `HttpOnly`)

---

## Related files

| Area | Location |
|------|----------|
| Sessions & passwords | `lib/auth.js` |
| MFA, reset tokens, backup codes | `lib/security.js` |
| Input validation | `lib/validation.js` |
| Investment API (documents) | `app/api/investments/route.js`, `[id]/route.js` |
| Login / lockout | `app/api/auth/login/route.js` |
| Security questions (public) | `app/api/auth/security-questions/route.js` |
| Password reset | `app/api/auth/password/request/route.js` |
| PDF viewer | `app/investments/[id]/DetailClient.js` |
| Next config | `next.config.js` |

---

*This document describes validation and remediation guidance only. Fixes are tracked separately; implement and re-validate using the **Fixed when** criteria for each finding.*
