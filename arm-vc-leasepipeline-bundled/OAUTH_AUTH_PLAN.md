# OAuth Authentication Plan — Lease Pipeline Tableau Extension

**Extension:** `arm-vc-leasepipeline-bundled`  
**Date:** 2026-07-07  
**Author:** Aldar Digital  

---

## 1. Background & Problem Statement

The extension is hosted on Aldar's static app hosting. Any person with the URL can load `index.html` directly in a browser — independently of Tableau Cloud. The security team requires that **only authenticated corporate users** can render the extension, regardless of how they reach it.

Tableau Cloud already authenticates users before they can view a dashboard, so in the normal flow there is no visible gap. The risk is the bypass path: the static hosting URL is accessible without going through Tableau, and the current extension has zero authentication logic.

---

## 2. Current State

| Area | Status |
|---|---|
| Authentication | None — extension calls `tableau.extensions.initializeAsync()` immediately on load |
| Data source | 100% from Tableau worksheets via `getSummaryDataAsync()`. No external API calls. |
| External services | None |
| Token storage | None |
| Sensitive data in scope | Agent names, deal values (AED), brand names — may be personal data under UAE PDPL if attributable to natural persons |

---

## 3. Why the Tableau Session Cannot Be Reused

The Tableau Extensions API **does not expose the user's Tableau session token or identity** to the extension. The extension runs in an iframe sandbox that deliberately blocks access to the host session. There is no `tableau.extensions.currentUser` API. Tableau's own Connected Apps (JWT) mechanism is for server-to-server trust and is not accessible from within an extension iframe.

The only viable path is an independent OAuth flow from within the extension itself.

---

## 4. Chosen Approach: PKCE Authorization Code Flow via Azure AD

### Why PKCE (not the full backend server approach)

Tableau's documentation shows a backend-server approach using Node.js + Socket.IO, designed for extensions that call external APIs with a client secret. **This extension calls no external APIs** — all data comes from Tableau worksheets. A backend server would add infrastructure, cost, and attack surface with no additional data protection gain in this specific case.

PKCE (Proof Key for Code Exchange, RFC 7636) is the IETF-recommended OAuth flow for browser-based public clients where no client secret can be safely stored. Azure AD / Entra ID fully supports it. No backend server required.

### Why Azure AD as the Identity Provider

Aldar runs Microsoft 365. Users are already federated to Azure AD. This means:
- No new IdP to manage
- Access revocation is tied to AD account status (offboarded employee = instant lockout)
- Supports silent authentication — see section 5

---

## 5. How the Flow Works

### Silent Authentication (Happy Path for Tableau Users)

If Aldar's Tableau Cloud is configured with Azure AD SSO (standard for Microsoft 365 enterprises), users already have an active Azure AD session in the browser when they open any Tableau dashboard. The PKCE flow starts with `prompt=none`, which tells Azure AD to return a token using the existing session — **no popup, no sign-in screen, no user action required**. The auth check is invisible.

Only when there is no existing Azure AD session (i.e., someone accessing the static URL directly from an unauthenticated machine) does a sign-in popup appear.

### Full Flow Diagram

```
User opens Tableau Cloud dashboard
           │
           ▼
   index.html loads in iframe
           │
   Check sessionStorage for valid token
           │
   ┌── Token valid ─────────────────────────────────────────────┐
   │                                                             │
   └── No token / expired ─────────────────────────────────────┤
           │                                                     │
           ▼                                                     │
   Generate PKCE pair                                           │
   (code_verifier stored in sessionStorage)                     │
           │                                                     │
   window.open(Azure AD /authorize                              │
     ?prompt=none    ← silent first attempt                     │
     &response_type=code                                        │
     &code_challenge=...                                        │
   )                                                             │
           │                                                     │
   ┌── Silent succeeds ──────────────────────────────────┐      │
   │       ▼                                             │      │
   │   auth-callback.html                                │      │
   │   POST /token with code + code_verifier             │      │
   │   (no client secret — PKCE handles it)              │      │
   │   postMessage(token) → window.opener                │      │
   │   window.close()                                    │      │
   └─────────────────────────────────────────────────────┘      │
           │                                                     │
   ┌── Silent fails (no AD session) ─────────────────────┐      │
   │   Retry with prompt=login                           │      │
   │   (visible sign-in popup for unauthenticated users) │      │
   └─────────────────────────────────────────────────────┘      │
           │                                                     │
   Extension receives postMessage                               │
   Validates event.origin (must match static host)             │
   Stores token + expiry in sessionStorage                     │
           │◄────────────────────────────────────────────────────┘
           ▼
   tableau.extensions.initializeAsync()
           │
           ▼
   Normal render (Kanban board, summary, risk strip)
```

---

## 6. Files to Create / Modify

### New: `auth-callback.html`

A minimal, zero-dependency redirect landing page. This is the OAuth redirect URI that Azure AD sends the authorization code to.

**Responsibilities:**
- Read `code` and `state` from the URL query string
- Retrieve `code_verifier` from `sessionStorage` (keyed by `state`)
- POST to Azure AD `/token` endpoint with `code`, `code_verifier`, `client_id`, `redirect_uri`
- On success: `window.opener.postMessage({ type: 'OAUTH_TOKEN', accessToken, expiresAt }, staticHostOrigin)`
- On failure: `window.opener.postMessage({ type: 'OAUTH_ERROR', error }, staticHostOrigin)`
- Call `window.close()` in either case

This page is never loaded inside Tableau — it opens in a popup window managed by the browser. It does not import the Tableau Extensions API.

---

### Modified: `index.html`

Add an `Auth` module (a plain object, consistent with the existing `Utils` pattern) before the main IIFE.

**`Auth` module contents:**

| Member | Type | Purpose |
|---|---|---|
| `AZURE_AD_CONFIG` | Object literal | Constants: `tenantId`, `clientId`, `redirectUri`, `scopes` |
| `generatePKCE()` | async function | Returns `{ codeVerifier, codeChallenge }` using `crypto.subtle` |
| `buildAuthorizeUrl(codeChallenge, state, prompt)` | function | Constructs the Azure AD `/authorize` URL |
| `getStoredToken()` | function | Reads token from `sessionStorage`, returns `null` if absent or expired |
| `isTokenValid(token)` | function | Checks expiry with a 5-minute safety buffer |
| `beginAuth(prompt)` | async function | Generates PKCE pair, stores `code_verifier`, calls `window.open()` |
| `waitForMessage()` | function | Returns a Promise that resolves when a valid `postMessage` arrives, rejects on timeout or error |
| `ensureAuthenticated()` | async function | Orchestrates the full flow: check storage → silent attempt → fallback to login prompt |

**Modifications to the main `window.load` handler:**
- Before `tableau.extensions.initializeAsync()`, call `await Auth.ensureAuthenticated()`
- Add auth-state UI elements to `#app`: a spinner div for the waiting state and an error div with a "Sign In" retry button
- All existing logic below `initializeAsync()` is unchanged

---

### Updated: `manifest.trex`

The `<url>` tag currently points to `http://localhost:8765/...` (dev server). Update to the production static hosting URL before publishing. Confirm this has not already been done in the deployed artefact before editing.

---

## 7. Prerequisites (Outside the Code)

### Azure AD App Registration (Entra ID)

Register the extension as a public client SPA application:

| Setting | Value |
|---|---|
| Platform | Single-page application |
| Redirect URI | `https://[static-host]/arm-vc-leasepipeline-bundled/auth-callback.html` |
| Public client flows | Enabled |
| Client secret | None (public client) |
| Scopes | `openid profile` |

Record the `client_id` (Application ID) and `tenant_id` (Directory ID) — these go into `Auth.AZURE_AD_CONFIG` in `index.html`.

### Tableau Cloud Allowlist

The extension URL (`index.html`) must remain on Tableau Cloud's extension allowlist. The `auth-callback.html` redirect URI loads in a browser popup (not a Tableau dialog), so it does not need separate allowlisting in Tableau.

### Static Hosting CORS

No special CORS configuration is needed on the static host. The token POST from `auth-callback.html` goes to `login.microsoftonline.com` (Microsoft's endpoint), which already permits cross-origin requests.

---

## 8. Security Implications

| Topic | Detail |
|---|---|
| **PKCE security** | No client secret ever touches the browser. The `code_verifier` is single-use and never leaves the client. Secure for static hosting per RFC 7636. |
| **Token storage** | `sessionStorage` only — cleared when the browser tab closes. Not `localStorage` (persists across sessions) and not a cookie (CSRF risk). |
| **postMessage origin validation** | The message listener must check `event.origin === 'https://[static-host]'` before accepting any token payload. A malicious page on a different origin cannot inject a forged token. |
| **Token expiry** | Azure AD access tokens expire in ~1 hour by default. The extension checks expiry with a 5-minute buffer before each `fetchAndRender()` and re-runs silent auth if needed. |
| **Scope minimisation** | Request only `openid profile`. Do **not** request `offline_access` (refresh tokens) without a secure backend to hold them. |
| **iFrame & clickjacking** | Azure AD's own pages enforce `X-Frame-Options: DENY`, which is why `window.open()` is mandatory. The auth flow must not be attempted inside the extension iframe itself. |
| **Direct URL access** | If `index.html` is opened outside Tableau: auth gate fires first. Even if auth succeeds, `tableau.extensions.initializeAsync()` fails (no Tableau host) and no data is ever rendered. Double-gated. |
| **Offboarding** | Tying auth to Azure AD means deactivating a departed employee's AD account revokes extension access immediately, without requiring a separate Tableau Cloud admin action. |
| **UAE PDPL** | Agent names, deal values, and brand names may be personal data if attributable to natural persons (e.g., sole traders). Binding access to Azure AD provides an auditable access control record supporting PDPL Article 4 (lawful basis) and Article 6 (data minimisation). No payment card data is in scope. |
| **Tableau Desktop** | PKCE + `window.open()` + `postMessage` works in Tableau Desktop as well. Desktop opens the popup in the system browser. No infrastructure change required. |

---

## 9. Test Plan

### Test Environments

| Env | Description |
|---|---|
| **A — Normal user** | Browser with active Tableau Cloud session + active Azure AD session |
| **B — Unauthenticated** | Private/incognito window, no existing sessions |
| **C — Direct access** | Extension URL typed directly into address bar, not via Tableau |

---

### TC-01: Authenticated Tableau Cloud user (happy path — with auth)

**Preconditions:** User is logged into Tableau Cloud via Azure AD SSO. Dashboard is open.

**Steps:** Open the Tableau Cloud dashboard containing the extension.

**Expected:**
- No popup window appears (silent `prompt=none` completes invisibly).
- `sessionStorage` key `aldar_ext_token` is populated.
- Extension renders the Kanban board with live data.
- No auth UI elements visible.

**Pass criteria:** Full render within 3 seconds; no user interaction required.

---

### TC-02: Corporate Azure AD user — no Tableau session but valid AD session (with auth)

**Preconditions:** User is signed into Aldar Azure AD (e.g., Outlook open in another tab) but has not opened Tableau Cloud.

**Steps:** Open the Tableau Cloud dashboard.

**Expected:**
- Silent auth succeeds via existing AD session.
- Extension renders normally after Tableau initialisation.
- No visible popup.

**Pass criteria:** Same as TC-01.

---

### TC-03: Unauthenticated browser — no AD session (without auth)

**Preconditions:** Incognito window, no Azure AD cookies.

**Steps:** Open the Tableau Cloud dashboard.

**Expected:**
- Silent auth (`prompt=none`) fails immediately.
- A login popup opens to `login.microsoftonline.com`.
- Extension iframe shows a "Waiting for sign-in…" state while popup is open.
- User signs in; popup closes automatically after token exchange.
- Extension receives token via `postMessage`, stores it, and renders.

**Pass criteria:** Extension renders after sign-in; popup closes cleanly.

---

### TC-04: Direct URL access — unauthenticated (security test — without auth)

**Preconditions:** Navigate directly to the static `index.html` URL in a browser with no Azure AD session.

**Expected:**
- Auth gate fires; silent auth fails; login popup appears.
- User signs in successfully.
- `tableau.extensions.initializeAsync()` is called but fails (not in Tableau context).
- Extension shows: "This extension must be used inside Tableau."
- **No lease pipeline data is rendered.**

**Pass criteria:** No data shown. Auth succeeds; Tableau init fails gracefully with a clear error message.

---

### TC-05: Direct URL access — authenticated AD user (security test — without auth)

**Preconditions:** Navigate directly to the extension URL in a browser that has an active Azure AD session but is not in Tableau.

**Expected:**
- Silent auth completes; token is issued.
- `initializeAsync()` fails (no Tableau host).
- Extension shows the Tableau context error; no data rendered.

**Pass criteria:** Auth completes silently but no Tableau data is accessible.

---

### TC-06: Expired token handling (regression test — with auth)

**Preconditions:** Extension is loaded and running normally (TC-01 passed).

**Steps:**
1. Open DevTools → Application → Session Storage.
2. Set `aldar_ext_token_expiry` to a Unix timestamp in the past.
3. Trigger a data refresh (change a Tableau filter).

**Expected:**
- Auth module detects the expired token.
- Silent re-auth fires invisibly (AD session is still active).
- New token replaces the old one in sessionStorage.
- Data refresh completes with no user-visible disruption.

**Pass criteria:** No visible interruption; token silently refreshed.

---

### TC-07: Popup blocked by browser (edge case — without auth)

**Preconditions:** Browser popup blocker is set to block all popups. No AD session.

**Steps:** Open the extension inside Tableau.

**Expected:**
- Silent auth fails (no AD session).
- Extension attempts `window.open()`; browser blocks it.
- Extension shows: "Sign-in popup was blocked. Please allow popups for this site and reload." with a "Sign In" button.
- Clicking "Sign In" (a user gesture) opens the popup — user-gesture-triggered popups bypass most browser blockers.

**Pass criteria:** Graceful error state; user is guided to resolve the blocked popup.

---

### TC-08: postMessage origin spoofing (security test)

**Preconditions:** Extension is in auth-waiting state (waiting for postMessage from popup).

**Steps:** Open browser DevTools console on the extension tab and run:
```javascript
window.postMessage({ type: 'OAUTH_TOKEN', accessToken: 'fake-token', expiresAt: Date.now() + 3600000 }, '*')
```

**Expected:**
- `message` event listener receives the event.
- `event.origin` does not match the expected static host origin.
- Message is silently ignored; no token stored; extension remains in auth-waiting state.

**Pass criteria:** No fake token is accepted. Extension does not render.

---

### TC-09: Network failure during token exchange (edge case)

**Preconditions:** User has completed Azure AD consent; `auth-callback.html` is executing the `/token` POST.

**Steps:** Use DevTools Network tab → set throttling to "Offline" immediately after the Azure AD redirect to `auth-callback.html`.

**Expected:**
- Token POST fails.
- `auth-callback.html` posts `{ type: 'OAUTH_ERROR', error: 'network_error' }` to opener.
- Extension shows: "Authentication failed. Please retry." with a retry button.
- Popup closes.

**Pass criteria:** Extension does not hang; error is surfaced clearly.

---

### TC-10: User closes login popup manually (edge case — without auth)

**Preconditions:** Login popup is open (TC-03 scenario).

**Steps:** User clicks the X button on the popup without signing in.

**Expected:**
- Extension detects the popup was closed (polling `popup.closed`).
- Extension shows: "Sign-in cancelled. Click Sign In to try again." with a retry button.
- Extension does not crash; user can retry without reloading the page.

**Pass criteria:** Graceful cancellation; retry available without a page reload.

---

### TC-11: Config dialog still works post-auth (regression test)

**Preconditions:** TC-01 completed; extension is rendering normally.

**Steps:**
1. Switch Tableau to Authoring mode.
2. Click the gear icon to open the config dialog.
3. Change any setting and save.

**Expected:**
- Config dialog opens normally (`initializeDialogAsync()` is unaffected by the auth flow in `index.html`).
- Settings save and the main view re-renders with the new configuration.

**Pass criteria:** Auth implementation has no regression on the config dialog flow.

---

## 10. Out of Scope

- Tableau Desktop-specific testing (the architecture supports it, but UAT should be conducted on Tableau Cloud only in the first release).
- Refresh token handling (requires a backend service; deferred unless external API calls are added to the extension).
- Multi-IdP support (Azure AD only; no guest / B2B accounts in scope).
