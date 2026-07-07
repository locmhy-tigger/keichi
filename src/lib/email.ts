// ============================================================
// Email sending via Resend (HTTPS API — works through the proxy).
// No SDK: a single fetch to the REST endpoint.
// Env: RESEND_API_KEY, MAIL_FROM (e.g. "訓育組 <discipline@school.edu.hk>")
// ============================================================

export type SendEmailInput = {
  to:       string | string[]
  subject:  string
  html?:    string
  text?:    string
  replyTo?: string
}

export type SendEmailResult = { ok: boolean; id?: string; error?: string }

/**
 * Best-effort email send. Never throws — returns { ok:false, error } so callers
 * can degrade gracefully (e.g. fall back to an in-app notification).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.MAIL_FROM

  if (!apiKey || !from) {
    console.error("sendEmail: RESEND_API_KEY or MAIL_FROM not configured")
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to:       Array.isArray(input.to) ? input.to : [input.to],
        subject:  input.subject,
        ...(input.html ? { html: input.html } : {}),
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error(`sendEmail: Resend ${res.status} — ${detail}`)
      return { ok: false, error: `RESEND_${res.status}` }
    }

    const data = await res.json().catch(() => ({}))
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error("sendEmail threw:", err)
    return { ok: false, error: "NETWORK" }
  }
}

/** True when Resend is configured — lets the UI show whether email will work. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)
}
