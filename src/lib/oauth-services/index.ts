/**
 * oauth-services/index.ts
 * ──────────────────────────────────────────────────────────────
 * Central registry of all OAuth service handlers.
 *
 * To add a new Google service:
 *   1. Create src/lib/oauth-services/google-<name>.ts
 *   2. Import and add it to the REGISTRY array below
 *   3. Add its scopes to the connect route's SCOPES_MAP
 *   Done — the callback route handles it automatically.
 * ──────────────────────────────────────────────────────────────
 */

import { googleCalendarHandler } from "./google-calendar"
import type { OAuthServiceHandler } from "./types"

const REGISTRY: OAuthServiceHandler[] = [
  googleCalendarHandler,
  // googleDriveHandler,       ← future
  // googleClassroomHandler,   ← future
]

/** Returns the handler for a given service identifier, or undefined if unknown. */
export function getOAuthServiceHandler(service: string): OAuthServiceHandler | undefined {
  return REGISTRY.find((h) => h.service === service)
}

export type { OAuthServiceHandler } from "./types"
