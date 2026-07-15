/**
 * oauth-services/types.ts
 * ──────────────────────────────────────────────────────────────
 * Shared contract that every OAuth service handler must implement.
 *
 * To add a new service (e.g. Google Drive):
 *   1. Create src/lib/oauth-services/google-drive.ts
 *   2. Export a handler conforming to OAuthServiceHandler
 *   3. Register it in src/lib/oauth-services/index.ts
 *   4. That's it — no changes to connect or callback routes needed.
 * ──────────────────────────────────────────────────────────────
 */

export interface OAuthTokens {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  scope?:        string
  token_type?:   string
}

export interface OAuthServiceHandler {
  /** Service identifier — must match the `service` field in connect URL */
  readonly service: string

  /** OAuth 2.0 scopes required for this service */
  readonly scopes: string[]

  /**
   * Called after the central callback successfully exchanges the code for tokens.
   * Responsible for persisting the connection and doing any post-auth setup
   * (e.g. create dedicated calendar, subscribe to Watch).
   *
   * @param userId  Authenticated user's DB id
   * @param tokens  Fresh tokens from Google
   * @returns       Query param key=value pairs to append to the success redirect
   *                e.g. { gcal_connected: "1" }
   * @throws        On unrecoverable setup failure — callback will redirect with error
   */
  handleCallback(
    userId: string,
    tokens: OAuthTokens,
  ): Promise<Record<string, string>>
}
