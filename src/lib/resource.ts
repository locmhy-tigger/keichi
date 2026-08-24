// AI 教學資源 — shared taxonomy + link helpers.

export const RESOURCE_CATEGORIES = ["AI_TOOL", "LESSON", "PEDAGOGY", "ASSESSMENT", "PD", "OTHER"] as const
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  AI_TOOL:    "AI 工具",
  LESSON:     "課堂應用",
  PEDAGOGY:   "教學法",
  ASSESSMENT: "評估",
  PD:         "專業發展",
  OTHER:      "其他",
}

export const CATEGORY_COLOR: Record<ResourceCategory, string> = {
  AI_TOOL:    "#7E57C2",
  LESSON:     "#1E88E5",
  PEDAGOGY:   "#2E7D32",
  ASSESSMENT: "#E53935",
  PD:         "#8E24AA",
  OTHER:      "#546E7A",
}

/** YouTube video id from watch / youtu.be / shorts / embed URLs, else null. */
export function youTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null
    if (host !== "youtube.com" && host !== "m.youtube.com") return null
    if (u.pathname === "/watch") return u.searchParams.get("v")
    const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/)
    return m ? m[2] : null
  } catch {
    return null
  }
}

export function youTubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

/** Bare host for display, e.g. "docs.google.com". */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}
