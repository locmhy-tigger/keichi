/**
 * GET /api/oauth/connect?service=<service>
 * ──────────────────────────────────────────────────────────────
 * Unified OAuth authorization initiator for all Google services.
 *
 * Query params:
 *   service   required  One of the registered service ids (e.g. "google-calendar")
 *   returnTo  optional  Path to redirect after success (default: role home)
 *
 * Flow:
 *   1. Verify user is authenticated
 *   2. Look up requested service in registry → get required scopes
 *   3. Build HMAC-signed state token (userId + service + returnTo + ts)
 *   4. Redirect to Google OAuth consent screen
 *   5. Google sends user back to /api/oauth/callback (single registered URI)
 *
 * Google Cloud Console only needs ONE redirect URI:
 *   https://YOUR_APP.zeabur.app/api/oauth/callback
 * ──────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { encodeOAuthState } from "@/lib/oauth-state"
import { getOAuthServiceHandler } from "@/lib/oauth-services"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

// Base scopes always included regardless of service
const BASE_SCOPES = ["openid", "email", "profile"]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const service  = searchParams.get("service")
  const returnTo = searchParams.get("returnTo")

  // Validate service
  if (!service) {
    return NextResponse.json({ error: "Missing ?service= parameter" }, { status: 400 })
  }

  const handler = getOAuthServiceHandler(service)
  if (!handler) {
    return NextResponse.json(
      { error: `Unknown service: "${service}"` },
      { status: 400 },
    )
  }

  // Determine where to send the user after the flow completes
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const roleHome = session.user.role === "STUDENT" ? "/student" : "/teacher"
  const resolvedReturnTo = returnTo ?? roleHome

  // Build HMAC-signed state token
  const state = encodeOAuthState({
    userId:   session.user.id,
    service,
    returnTo: resolvedReturnTo,
    ts:       Date.now(),
  })

  // Merge base scopes + service scopes (deduplicated)
  const scopeSet = new Set([...BASE_SCOPES, ...handler.scopes])
  const scopes = Array.from(scopeSet)

  const params = new URLSearchParams({
    client_id:     process.env.AUTH_GOOGLE_ID!,
    redirect_uri:  `${appUrl}/api/oauth/callback`,
    response_type: "code",
    scope:         scopes.join(" "),
    access_type:   "offline",
    prompt:        "consent",   // always get refresh_token
    state,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}
