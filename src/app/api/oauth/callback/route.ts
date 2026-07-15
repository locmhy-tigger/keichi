/**
 * GET /api/oauth/callback
 * ──────────────────────────────────────────────────────────────
 * Central OAuth 2.0 callback handler for ALL Google service integrations.
 *
 * This is the ONLY redirect URI that needs to be registered in Google Cloud Console:
 *   https://YOUR_APP.zeabur.app/api/oauth/callback
 *   http://localhost:3000/api/oauth/callback  (local dev)
 *
 * Steps:
 *   1. Verify session is still valid
 *   2. Decode + verify HMAC-signed state (CSRF protection)
 *   3. Match state.service to a registered OAuthServiceHandler
 *   4. Exchange authorization code for tokens
 *   5. Delegate post-auth setup to the service handler
 *   6. Redirect to state.returnTo with success/error query params
 *
 * Adding a new service requires zero changes here — just register a handler
 * in src/lib/oauth-services/index.ts.
 * ──────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { decodeOAuthState } from "@/lib/oauth-state"
import { getOAuthServiceHandler } from "@/lib/oauth-services"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // ── 1. Session check ────────────────────────────────────────
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { searchParams } = new URL(req.url)
  const code        = searchParams.get("code")
  const stateParam  = searchParams.get("state")
  const googleError = searchParams.get("error")

  // ── 2. Decode & verify state ────────────────────────────────
  const state = stateParam ? decodeOAuthState(stateParam) : null

  // Fallback redirect if state is missing / invalid (before we know returnTo)
  const roleHome = session.user.role === "STUDENT" ? "/student" : "/teacher"
  const returnTo  = state?.returnTo ?? roleHome

  if (!state) {
    console.warn("[OAuth callback] invalid or missing state")
    return NextResponse.redirect(`${appUrl}${returnTo}?oauth_error=invalid_state`)
  }

  // Verify the state belongs to the current session user
  if (state.userId !== session.user.id) {
    console.warn("[OAuth callback] state userId mismatch")
    return NextResponse.redirect(`${appUrl}${returnTo}?oauth_error=state_mismatch`)
  }

  // ── 3. Look up service handler ──────────────────────────────
  const handler = getOAuthServiceHandler(state.service)
  if (!handler) {
    console.error("[OAuth callback] unknown service:", state.service)
    return NextResponse.redirect(`${appUrl}${returnTo}?oauth_error=unknown_service`)
  }

  // ── 4. User denied consent ──────────────────────────────────
  if (googleError || !code) {
    console.warn(`[OAuth callback] ${state.service}: user denied or no code:`, googleError)
    return NextResponse.redirect(
      `${appUrl}${returnTo}?oauth_error=denied&service=${state.service}`,
    )
  }

  // ── 5. Exchange code for tokens ─────────────────────────────
  let tokens: {
    access_token:   string
    refresh_token?: string
    expires_in:     number
    scope?:         string
    token_type?:    string
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        redirect_uri:  `${appUrl}/api/oauth/callback`,
        grant_type:    "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error(`[OAuth callback] ${state.service}: token exchange failed:`, errText)
      return NextResponse.redirect(
        `${appUrl}${returnTo}?oauth_error=token_exchange&service=${state.service}`,
      )
    }

    tokens = await tokenRes.json()
  } catch (err) {
    console.error(`[OAuth callback] ${state.service}: network error during token exchange:`, err)
    return NextResponse.redirect(
      `${appUrl}${returnTo}?oauth_error=network&service=${state.service}`,
    )
  }

  // ── 6. Delegate to service handler ──────────────────────────
  try {
    const successParams = await handler.handleCallback(session.user.id, tokens)
    const qs = new URLSearchParams(successParams).toString()
    return NextResponse.redirect(`${appUrl}${returnTo}${qs ? `?${qs}` : ""}`)
  } catch (err) {
    const reason = err instanceof Error ? err.message : "setup_failed"
    console.error(`[OAuth callback] ${state.service}: handler error:`, err)
    return NextResponse.redirect(
      `${appUrl}${returnTo}?oauth_error=${encodeURIComponent(reason)}&service=${state.service}`,
    )
  }
}
