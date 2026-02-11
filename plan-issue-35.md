# Implementation Plan: Issue #35 — Headless Auth Fallback

## Problem

When running `npx @dguido/google-workspace-mcp auth` in headless environments
(SSH, containers, WSL without browser integration), the OAuth flow hangs because:

1. `open(authorizeUrl)` silently fails (no browser available)
2. The fallback message shows a `127.0.0.1:<port>` URL, which points at the
   remote machine's loopback — unreachable from the user's local browser
3. Even if the user opens the auth URL locally, Google redirects to
   `http://127.0.0.1:<port>/oauth2callback?code=...` on the remote machine
4. The auth server waits indefinitely for a callback that never arrives

## Solution

Add a stdin readline prompt that races against the existing HTTP callback
server. When running interactively (`process.stdin.isTTY`), the user can paste
the redirect URL from their browser's address bar (which shows the full
callback URL with `?code=...&state=...` even if the page fails to load).

Whichever completes first — the HTTP callback or the stdin paste — wins.

## Design Decisions

1. **Race pattern**: A shared `resolved` boolean ensures only the first
   completion path (HTTP callback or stdin) triggers token exchange. The
   `resolveAuth` callback is set by `start()` and called by either path.
2. **Prompts go to stderr**: MCP protocol uses stdout, so all user-facing
   prompts use `process.stderr`.
3. **State validation**: Full redirect URLs are validated for CSRF (`state`
   param). Bare codes skip state validation (user manually copied the code;
   state cannot be verified, but PKCE still protects against interception).
4. **Re-prompt on bad input**: Invalid pastes print an error and re-prompt
   instead of failing the flow.
5. **Non-TTY environments**: No readline prompt. HTTP callback is the only
   path — identical to current behavior.

## File Changes

### 1. `src/auth/server.ts` — Core changes

**Add import** (line 1 area):

```typescript
import readline from "readline";
```

**Add `extractCodeFromInput()` function** (after `timingSafeEqual`, ~line 27):

- Accepts raw user input string
- Tries to parse as a URL → extract `code` and `state` query params
- Falls back to bare code detection (length > 10, no spaces)
- Returns `{ code, state? }` or `null`

**Add `resolveAuth` callback and `resolved` flag** to `AuthServer`:

- `private resolved = false`
- `private resolveAuth: ((code: string) => void) | null = null`
- Both paths (HTTP callback + stdin) call `resolveAuth` after exchanging the
  code for tokens

**Modify `handleOAuthCallback()`** (~line 73):

- After successfully exchanging code for tokens, check `resolved` flag
- If already resolved (stdin won the race), still return success HTML but
  skip duplicate token save
- Set `resolved = true` and call `resolveAuth`

**Modify `start()`** (~line 157):

- Return a `Promise<boolean>` that resolves when auth completes (not just
  when the server starts)
- After `open(authorizeUrl)`, if `process.stdin.isTTY`, start readline
- Readline prompt: `"Paste redirect URL or auth code: "`
- On input: call `extractCodeFromInput()`, validate state if present,
  exchange code, save tokens
- On invalid input: print error to stderr, re-prompt
- Race readline vs HTTP callback via shared `resolved` flag

**Add `exchangeCodeForTokens()` private method**:

- Extract the token exchange logic from `handleOAuthCallback` into a shared
  method that both paths can call
- Handles: code exchange via `flowOAuth2Client.getToken()`, token save via
  `tokenManager.saveTokens()`, setting `authCompletedSuccessfully`

**Modify `stop()`**:

- Close readline interface if active

### 2. `src/auth.ts` — Simplify polling

The `authenticate()` function currently polls `authCompletedSuccessfully`
every 1 second. With the new `start()` returning a promise that resolves on
auth completion, we can simplify this to just awaiting `start()` with a
timeout race.

**Changes:**

- `start()` now resolves its returned promise when auth completes (or
  rejects on failure)
- Replace poll loop with `Promise.race([authServer.start(true), timeout])`
- Keep the 5-minute timeout

### 3. `src/auth/server.test.ts` — New tests

Add test cases for:

- `extractCodeFromInput()` with full redirect URL
- `extractCodeFromInput()` with bare authorization code
- `extractCodeFromInput()` with shortened URL (`?code=...&state=...`)
- `extractCodeFromInput()` with invalid/garbage input returns null
- `extractCodeFromInput()` with URL missing code param returns null
- State extraction from pasted URL
- HTTP callback still works (existing tests, verify no regression)

### 4. `docs/TROUBLESHOOTING.md` — New section

Add a section for "Running on remote/SSH/container environments":

- Explains the stdin paste flow
- Shows the expected UX
- Notes that the redirect page won't load — copy URL from address bar

## Scope Verification (from issue checklist)

- [x] Add `extractCodeFromInput()` utility function
- [x] Add readline prompt in `AuthServer.start()` when `process.stdin.isTTY`
- [x] Race the stdin prompt against the HTTP callback
- [x] Validate state parameter from pasted URLs
- [x] Update auth flow messaging to guide remote users
- [x] Test: stdin input with full URL extracts code correctly
- [x] Test: stdin input with bare code works
- [x] Test: invalid input shows helpful error
- [x] Test: HTTP callback still works (no regression)
- [x] Update README troubleshooting section for remote/SSH usage

## Security Considerations

- PKCE is preserved — both paths use the same `codeVerifier`
- State validation on pasted URLs prevents CSRF for the URL path
- Bare codes skip state validation (acceptable: user manually copied it,
  and PKCE still protects the code exchange)
- No new network surface — stdin is local only
- `resolved` flag prevents double token exchange
