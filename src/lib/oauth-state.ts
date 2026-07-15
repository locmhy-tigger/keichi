/**
 * oauth-state.ts
 * ──────────────────────────────────────────────────────────────
 * CSRF-safe OAuth state token utilities.
 *
 * The state param encodes:
 *   - userId   : who initiated the flow (verified against session in callback)
 *   - service  : which OAuth service is being connected (drives dispatch)
 *   - returnTo : where to redirect after success/failure (role-aware path)
 *   - ts       : unix ms timestamp (used to reject stale tokens)
 *
 * Security: signed with HMAC-SHA256 using AUTH_SECRET so the payload cannot
 * be tampered with by a third party. Decode verifies the signature before
 * trusting any field.
 *
 * Format:  base64url( JSON.stringify(payload) ) + "." + base64url( HMAC )
 * ──────────────────────────────────────────────────────────────
 */

import { createHmac } from "crypto"

export interface OAuthStatePayload {
  userId:   string
  service:  string   // e.g. "google-calendar", "google-drive"
  returnTo: string   // e.g. "/teacher" or "/student"
  ts:       number   // Date.now()
}

const MAX_AGE_MS = 10 * 60 * 1000  // 10 minutes

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return secret
}

function sign(data: string): string {
  return createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url")
}

/**
 * Encodes and signs an OAuth state payload.
 * Returns a URL-safe string suitable for the `state` query parameter.
 */
export function encodeOAuthState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig   = sign(body)
  return `${body}.${sig}`
}

/**
 * Decodes and verifies an OAuth state token.
 * Returns the payload if valid, or null if tampered / expired / malformed.
 */
export function decodeOAuthState(state: string): OAuthStatePayload | null {
  try {
    const dotIdx = state.lastIndexOf(".")
    if (dotIdx === -1) return null

    const body        = state.slice(0, dotIdx)
    const receivedSig = state.slice(dotIdx + 1)
    const expectedSig = sign(body)

    // Constant-time comparison to prevent timing attacks
    if (receivedSig.length !== expectedSig.length) return null
    let diff = 0
    for (let i = 0; i < receivedSig.length; i++) {
      diff |= receivedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
    }
    if (diff !== 0) return null

    const payload: OAuthStatePayload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    )

    // Reject stale tokens
    if (Date.now() - payload.ts > MAX_AGE_MS) return null

    // Basic shape check
    if (!payload.userId || !payload.service || !payload.returnTo) return null

    return payload
  } catch {
    return null
  }
}
