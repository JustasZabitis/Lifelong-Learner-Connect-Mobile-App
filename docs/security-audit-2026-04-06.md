# Security Audit Report — Lifelong Learner Connect
## Date: 2026-04-06
## Auditor: Claude (OWASP Top 10:2025 / ASVS 5.0)

---

## Executive Summary

The app has a **solid security foundation** — parameterised queries throughout, proper bcrypt hashing, JWT revocation via `force_logout_at`, httpOnly cookies, and SecureStore on mobile. However, **two issues require urgent attention before production**: a hardcoded JWT secret used in three places (if that string leaks, every token ever issued can be forged), and a SQL injection vulnerability in the notification bulk-insert in `academicYear.controller.ts` where user-supplied `type` and `academicYear` fields are interpolated directly into SQL strings. There is also no IP-based rate limit on the `/api/auth` routes, meaning a distributed attacker can lock out any account in seconds from multiple IPs.

---

## Findings

---

### 🔴 Critical

#### 1. Hardcoded JWT Fallback Secret Used in Three Places

- **Where**: `auth.service.ts` line 184, `auth.middleware.ts` line 36, `index.ts` line 110
- **The string**: `"secret_key_ABCD_8673217853219853965321"`
- **Risk**: If this string ever appears in a commit, log, error dump, or env diff, any attacker can forge admin-role JWTs for any user ID without knowing a password. They only need `jwt.sign({ id: 1, email: "x", role: "admin" }, "secret_key_ABCD_8673217853219853965321", { expiresIn: "999d" })`. This bypasses every RBAC check in the app.
- **Fix**: In Render's dashboard → Environment → add `JWT_SECRET` as a random 32+ character secret (e.g. `openssl rand -hex 32`). Remove the fallback entirely — change `process.env.JWT_SECRET || "secret_key_ABCD_8673217853219853965321"` to `process.env.JWT_SECRET!` in all three files. Add a startup check: `if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not set")`.

---

#### 2. SQL Injection via Unsanitised `type` and `academicYear` in Notification Bulk-Insert

- **Where**: `academicYear.controller.ts`
  - Line 248: `` `(${id}, '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', '${type}')` ``
  - Line 208: `` `(${id}, 'Welcome to ${yearLabel}! 🎉', '...', 'info')` `` where `yearLabel = academicYear` from `req.body`
- **Risk**: The `type` field (line 248) and `academicYear` field (line 208) are placed directly into the SQL string with only single-quote escaping. An attacker with admin credentials can send `type: "info'), (1, 'hacked', 'DROP TABLE users;--', 'x"` or similar payloads. The `.replace(/'/g, "''")` guard on `message` and `title` is not applied to `type` or `yearLabel` at all.
- **Note**: The `id` values come from `userIds` which is cast via `ANY($1::int[])` in other queries, but in the notification INSERT they are interpolated as `${id}` directly — if `userIds` contains a non-integer this also breaks the query.
- **Fix**: Replace all three bulk-insert patterns with proper parameterised multi-row inserts using `unnest`:
  ```sql
  INSERT INTO user_notifications (user_id, title, message, type)
  SELECT unnest($1::int[]), $2, $3, $4
  ```
  Then pass `[userIds, title, message, type]` as parameters. This eliminates all injection surface entirely.

---

### 🟠 High

#### 3. No IP-Based Rate Limiting on `/api/auth` Routes

- **Where**: `backend/src/index.ts` lines 72–73
- **The problem**: `app.use("/api/auth", authRoutes)` is registered **before** `app.use("/api", apiLimiter)`, meaning the `apiLimiter` (200 req/min) does **not** apply to login or registration. The only protection is the per-account lockout in `auth.service.ts`.
- **Risk**: An attacker can enumerate valid email addresses by sending login attempts across thousands of IPs (each gets 9 free attempts before lockout). At 1 request/second from 100 IPs, that's 900 credential attempts per second with zero IP-level throttle. They can also spam `/api/auth/register` to exhaust your DB with fake accounts — no limit at all.
- **Fix 1**: Move `app.use("/api", apiLimiter)` **above** `app.use("/api/auth", authRoutes)` — or better, apply a stricter dedicated limiter to auth:
  ```ts
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, ... });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  ```
- **Fix 2**: Consider adding `express-rate-limit` with `keyGenerator: (req) => req.ip` specifically for auth routes.

#### 4. Open Role Assignment on Self-Registration

- **Where**: `auth.service.ts` line 68–71, `auth.controller.ts` `register` handler
- **Risk**: The `/api/auth/register` endpoint accepts a `role` field from the request body and inserts it directly into the database **with no validation**. A user can register as `role: "admin"` or `role: "educator"` by sending a crafted POST request:
  ```json
  { "email": "hacker@test.com", "password": "test123", "role": "admin" }
  ```
  This gives them full admin access immediately — bypassing every admin gate in the app.
- **Fix**: In `auth.service.ts` `registerUser`, replace the raw `role` insert with a hardcoded default: always set `role = 'student'` for self-registration. Admins creating educator/admin accounts should go through the `/api/admin/users` endpoint only.

#### 5. Hardcoded Database Password Fallback

- **Where**: `backend/src/config/db.ts` line 27
- **The string**: `password: process.env.DB_PASSWORD || "lifelong_learner_connect"`
- **Risk**: If `DB_PASSWORD` is not set in production, the app silently connects to the database with the well-known default password. Anyone who discovers the database host can connect directly.
- **Fix**: Same approach as JWT_SECRET — remove the fallback. Add startup validation: `if (!process.env.DB_PASSWORD && !process.env.DATABASE_URL) throw new Error("DB credentials not set")`.

#### 6. `socket.io-parser` — Unbounded Binary Attachments (DoS)

- **Where**: Backend `package.json` → `socket.io ^4.8.3`
- **CVE**: GHSA-677m-j7p3-52f9
- **Risk**: An unauthenticated or authenticated Socket.IO client can send a crafted message claiming an arbitrarily large number of binary attachments, causing the server to allocate unbounded memory until it crashes (OOM DoS). Socket.io is used for the real-time messaging feature.
- **Fix**: Run `npm update socket.io` in the backend — this vulnerability is fixed in socket.io-parser 4.2.4+.

#### 7. `path-to-regexp` — ReDoS (Express Routing Layer)

- **Where**: Backend `package.json` → `express ^5.2.1` → `path-to-regexp`
- **CVE**: GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7
- **Risk**: Carefully crafted URL paths can trigger catastrophic backtracking in the route matching regex, hanging the Node.js event loop for several seconds per request. This is a DoS against the API server itself.
- **Fix**: Run `npm update express` or `npm update path-to-regexp` in the backend.

#### 8. `multer` — Denial of Service via Uncontrolled Recursion

- **Where**: Backend `package.json` → `multer ^2.1.0`
- **CVE**: GHSA-5528-5vmv-3xc2
- **Risk**: A malicious file upload can trigger uncontrolled recursion in multer's field parser, crashing the process. The file upload endpoint (`POST /api/resources`) is auth-protected so this requires an authenticated attacker (any student or educator).
- **Fix**: Run `npm update multer` in the backend.

---

### 🟡 Medium

#### 9. CORS Configured with `origin: true` (Reflects Any Origin)

- **Where**: `backend/src/index.ts` line 50: `app.use(cors({ origin: true, credentials: true }))`
- **Risk**: `origin: true` reflects back whatever `Origin` header the client sends, effectively allowing any domain to make credentialed cross-origin requests. This defeats CSRF protections. Combined with `credentials: true`, a malicious website can make authenticated requests on behalf of a logged-in user.
- **Fix**: Lock to your actual domains:
  ```ts
  const allowedOrigins = [
    "https://your-expo-web-build.render.com",
    "http://localhost:8081", // dev only
  ];
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));
  ```
- **Also**: Socket.io has `origin: "*"` on line 44 — same fix needed there.

#### 10. No Security Headers (No Helmet)

- **Where**: `backend/src/index.ts` — no `helmet` import or usage
- **Risk**: The API responses have no `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or `X-XSS-Protection` headers. While the mobile app isn't directly affected, the web version of the app (Expo Web) is vulnerable to clickjacking and MIME sniffing attacks.
- **Fix**: `npm install helmet` then add `app.use(helmet())` as the first middleware in `index.ts`.

#### 11. Login Error Reveals Remaining Attempt Count

- **Where**: `auth.service.ts` lines 156–163
- **Risk**: The error message `"Invalid credentials. 4 attempts remaining before account lockout."` tells an attacker exactly how many more guesses they have before triggering a lockout. This assists targeted brute force — an attacker knows to back off at 1 remaining attempt, wait, and try again.
- **Fix**: Return a generic `"Invalid credentials"` message only. Internally track the count but don't expose it in the error.

#### 12. Weak Password Policy (6 Character Minimum)

- **Where**: `auth.service.ts` line 47, `admin.controller.ts` line 306
- **Risk**: A 6-character minimum allows trivially weak passwords like `abc123`. For an educational platform handling student data, this doesn't meet reasonable security standards.
- **Fix**: Raise the minimum to 8 characters and add at least one complexity requirement (uppercase, number, or special character). Consider using `zxcvbn` for strength estimation.

#### 13. `node-forge` — Multiple Certificate/Signature Vulnerabilities (Mobile)

- **Where**: `mobile-app/package.json` (indirect dep via expo-crypto / expo-modules)
- **CVEs**: GHSA-2328-f5f3-gj25 (basicConstraints bypass), GHSA-q67f-28xg-22rw (Ed25519 forgery), GHSA-ppp5-5v6c-4jwp (RSA-PKCS forgery)
- **Risk**: These allow certificate chain verification bypass and signature forgery in TLS/crypto operations done by Expo's underlying crypto modules. Lower practical risk since it requires a MITM position, but notable for a production app.
- **Fix**: Run `npm update` in `mobile-app/` and check if Expo SDK update resolves the transitive dependency.

#### 14. `flatted` — Prototype Pollution (Mobile)

- **Where**: `mobile-app/package.json` (indirect dep)
- **CVE**: GHSA-rf6f-7fwh-wjgh
- **Risk**: The `flatted.parse()` function is vulnerable to prototype pollution, which can lead to property injection on `Object.prototype` affecting all objects in the app. Practical exploitability depends on whether user-supplied JSON is parsed via `flatted`.
- **Fix**: `npm update` in `mobile-app/` — check for Expo SDK or Metro bundler updates.

#### 15. `tar` — Path Traversal / Symlink Attacks (Mobile Build Tool)

- **Where**: `mobile-app/package.json` (indirect dep, build toolchain only)
- **CVEs**: GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256
- **Risk**: Path traversal vulnerabilities in `tar` during `npm install` or build steps could allow a malicious npm package to write files outside the expected directory. Risk is limited to the development/build environment, not runtime.
- **Fix**: `npm update` in `mobile-app/`.

---

### 🟢 Low / ℹ️ Info

#### 16. ✅ SQL Injection — Main Queries: CLEAN
All database queries in `admin.controller.ts`, `auth.service.ts`, `auth.middleware.ts`, `resource.controller.ts`, and `forum.controller.ts` use proper parameterised queries (`$1`, `$2` placeholders). Dynamic query building (e.g. `getUsers` with optional filters) builds conditions with `$i` parameters correctly. No raw concatenation found in these files.

#### 17. ✅ JWT Expiry: GOOD
Token expiry is `1h` (line 185 `auth.service.ts`) — reasonable for a student app. Cookie `maxAge` matches (line 18 `auth.controller.ts`).

#### 18. ✅ JWT Revocation: GOOD
`force_logout_at` mechanism in `auth.middleware.ts` (lines 59–63) means admin can invalidate any user's token immediately. Suspension is also checked on every request.

#### 19. ✅ Cookie Security: GOOD (in production)
`httpOnly: true`, `secure: IS_PROD` (HTTPS-only in prod), `sameSite: "lax"` are all set correctly in `auth.controller.ts` lines 14–20.

#### 20. ✅ Mobile Token Storage: GOOD
All mobile screens use `expo-secure-store` (backed by iOS Keychain / Android Keystore). `localStorage` is only used on `Platform.OS === "web"`, which is expected for Expo Web.

#### 21. ✅ User Enumeration: GOOD
Login returns `"Invalid credentials"` for both missing user and wrong password (lines 107–109 and generic catch in `auth.service.ts`). Email lookups are normalized before comparison.

#### 22. ✅ Password Hashing: GOOD
bcrypt with 10 salt rounds used throughout. No MD5, SHA1, or plaintext storage found.

#### 23. ✅ File Upload Security: GOOD
`resource.routes.ts` has extension + MIME whitelist, filename sanitisation, 100MB size cap, and path traversal prevention in `downloadResource`. Files are served as `attachment` (not inline) to prevent browser execution.

#### 24. ✅ Admin RBAC — Backend: GOOD (mostly)
Every admin controller function calls `requireAdmin()` as its first line. The `authMiddleware` is applied to all admin routes. The backend would correctly reject a non-admin token even if the frontend was bypassed — **except** for the open registration role issue in finding #4 above.

#### 25. ✅ `.gitignore`: PRESENT
`.env` is listed in `.gitignore` at the project root. `.expo` is also excluded. Good.

#### 26. ✅ `eval()` / `Function()` Calls: NONE FOUND
No dynamic code execution found in any backend TypeScript file.

#### 27. ✅ Escalating Lockout: GOOD
5→10→15→30→60 minute lockout tiers after every 10 failed attempts are well-designed. Lockout is checked before the password compare (line 117 `auth.service.ts`), which is correct.

#### 28. ℹ️ No Refresh Tokens
JWTs are 1-hour, non-refreshable. Users have to re-login every hour on the web. On mobile, SecureStore tokens persist so this is less painful. No immediate security risk but poor UX — consider implementing refresh tokens with a 7-day sliding window.

#### 29. ℹ️ No Admin Screen Route Guard on Mobile Frontend
`admin-portal.tsx` and `admin-dashboard.tsx` do not have a frontend route guard redirecting non-admins. The backend correctly rejects all admin API calls from non-admins (finding #24), so there is no security vulnerability — but a student who navigates to `/admin-portal` directly will see the UI render (with all API calls failing with 403). Low-priority UX polish: add `if (userRole !== "admin") router.replace("/")` in a `useEffect`.

---

## Dependency Audit Summary

### Backend — 6 total vulnerabilities
| Severity | Count | Key Packages |
|----------|-------|--------------|
| 🔴 Critical | 0 | — |
| 🟠 High | 5 | `socket.io-parser`, `path-to-regexp`, `multer`, `minimatch`, `picomatch` |
| 🟡 Moderate | 1 | `minimatch` (additional ReDoS variant) |

**Most urgent**: `socket.io-parser` (OOM DoS on live WebSocket connections), `path-to-regexp` (route-level ReDoS against the Express server), `multer` (DoS on file upload endpoint).

**Fix**: Run `npm update` in `backend/` — most of these are transitive and will resolve automatically. Verify with `npm audit` after.

### Mobile App — 12 total vulnerabilities
| Severity | Count | Key Packages |
|----------|-------|--------------|
| 🔴 Critical | 0 | — |
| 🟠 High | 9 | `node-forge`, `flatted`, `tar`, `undici`, `minimatch`, `picomatch`, `socket.io-parser`, `@xmldom/xmldom`, `@isaacs/brace-expansion` |
| 🟡 Moderate | 3 | Various |

Most of the mobile vulns are in the Expo SDK's deep dependency tree. Run `npx expo upgrade` to pull in Expo's patched versions rather than individual `npm update` calls.

---

## Recommended Priority Actions

1. **[CRITICAL — Do now]** Set `JWT_SECRET` as a real environment variable in Render. Remove all three `|| "secret_key_ABCD_8673217853219853965321"` fallbacks in `auth.service.ts:184`, `auth.middleware.ts:36`, and `index.ts:110`. Add startup validation.

2. **[CRITICAL — Do now]** Fix the SQL injection in `academicYear.controller.ts`. Replace the three `VALUES ${notifValues}` bulk-inserts (lines 152, 214, 254) with `unnest`-based parameterised queries.

3. **[HIGH — Before launch]** Fix open role assignment in `auth.service.ts` `registerUser` — hardcode `role = 'student'` for self-registration. This currently lets anyone become an admin.

4. **[HIGH — Before launch]** Move `app.use("/api", apiLimiter)` above `app.use("/api/auth", ...)` in `index.ts`, or add a separate strict limiter (`max: 20 per 15min`) on `/api/auth/login` and `/api/auth/register`.

5. **[HIGH — Before launch]** Remove the hardcoded `DB_PASSWORD` fallback in `db.ts:27`. Set `DB_PASSWORD` in Render environment variables.

6. **[HIGH — Soon]** Run `npm update` in `backend/` to fix `socket.io-parser` (DoS), `path-to-regexp` (DoS), and `multer` (DoS) vulnerabilities.

7. **[MEDIUM — Before launch]** Lock CORS `origin` to your actual deployed domain(s) in `index.ts:50` and the Socket.io config `index.ts:44`. Remove `origin: true` and `origin: "*"`.

8. **[MEDIUM — Before launch]** Add `helmet()` middleware: `npm install helmet`, then `app.use(helmet())` as the first line in `index.ts`.

9. **[MEDIUM — Soon]** Change the login error message from `"Invalid credentials. X attempts remaining"` to a generic `"Invalid credentials"` to stop leaking lockout state.

10. **[MEDIUM — Soon]** Raise password minimum from 6 to 8+ characters with complexity rules in both `auth.service.ts:47` and `admin.controller.ts:306`.

11. **[MEDIUM — Expo update cycle]** Run `npx expo upgrade` in `mobile-app/` to pull patched versions of `node-forge`, `flatted`, `tar`, `undici`, and other high-severity mobile dependencies.
