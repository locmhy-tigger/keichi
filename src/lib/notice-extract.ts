import PizZip from "pizzip"

// ─────────────────────────────────────────────────────────────
// 通告匯入 — turn an existing notice document into notice-form fields.
//
// The model only ever PROPOSES a payload; it is handed back to the teacher to
// review and is written to the DB solely by their own save/submit. This keeps
// the project-wide rule that the LLM never writes to the database directly.
// ─────────────────────────────────────────────────────────────

/**
 * Plain text out of a .docx, using pizzip (already a dependency for document
 * generation) — a .docx is a zip whose word/document.xml holds the body.
 * Good enough for a notice; we only need the prose, not the formatting.
 */
export function docxToText(buf: Buffer): string {
  const zip = new PizZip(buf)
  const xml = zip.file("word/document.xml")?.asText() ?? ""
  if (!xml) return ""

  return xml
    // Paragraph and line breaks become real newlines...
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, "\t")
    // ...then drop every remaining tag.
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export const NOTICE_EXTRACT_PROMPT = `你是香港中學的行政助理。以下是一份已經寫好的活動通告（可能是 Word 文件的文字、PDF 或掃描件）。
請把內容整理成 JSON，以便填入學校的「活動文件生成器」表單。

只輸出 JSON，不要有任何解釋或 markdown 圍欄。JSON 結構如下：

{
  "activityName": "活動名稱",
  "noticeNum": "通告編號，例如 072/2025；找不到就空字串",
  "issueDate": "發出日期 YYYY-MM-DD；找不到就空字串",
  "teacher": "負責老師姓名（不要包括「老師」二字）",
  "contactTel": "聯絡電話；找不到就空字串",
  "tutorType": "school 或 external（有校外導師／機構就 external）",
  "orgName": "校外機構名稱；沒有就空字串",
  "bodyText": "通告正文（給家長的段落），保留原文語氣",
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "time": "活動時間，例如 15:30-17:00",
      "location": "地點",
      "arriveTime": "到達時間 HH:MM；沒有就空字串",
      "leaveTime": "離開時間 HH:MM；沒有就空字串"
    }
  ],
  "students": [
    { "className": "班級，例如 1A", "studentId": "學號，例如 01", "name": "學生姓名" }
  ],
  "dept": "負責科組；找不到就空字串"
}

規則：
1. 所有日期一律轉成 YYYY-MM-DD。中文日期（如「二零二五年九月三日」）也要轉換。
2. 如果通告列出多個活動日期，sessions 要逐個列出。
3. 如果文件內有學生名單（班級／學號／姓名），全部填入 students；沒有就給空陣列。
4. 找不到的欄位一律用空字串或空陣列，切勿自行虛構內容。
5. 只輸出 JSON。`

export type ExtractedNotice = {
  activityName?: string
  noticeNum?:    string
  issueDate?:    string
  teacher?:      string
  contactTel?:   string
  tutorType?:    "school" | "external"
  orgName?:      string
  bodyText?:     string
  sessions?:     { date?: string; time?: string; location?: string; arriveTime?: string; leaveTime?: string }[]
  students?:     { className?: string; studentId?: string; name?: string }[]
  dept?:         string
}

/** Tolerant parse — models sometimes wrap JSON in prose or a code fence. */
export function parseExtracted(raw: string): ExtractedNotice {
  let s = raw.replace(/```json\n?|```\n?/g, "").trim()
  if (!s.startsWith("{")) {
    const a = s.indexOf("{"), b = s.lastIndexOf("}")
    if (a >= 0 && b > a) s = s.slice(a, b + 1)
  }
  const parsed = JSON.parse(s) as ExtractedNotice

  // Never let a bad date reach the date inputs — they blank silently on a
  // malformed value, which looks like the import simply lost the field.
  const isYmd = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  if (!isYmd(parsed.issueDate)) parsed.issueDate = ""
  parsed.sessions = (parsed.sessions ?? []).filter((s) => isYmd(s?.date))
  parsed.students = (parsed.students ?? []).filter((s) => (s?.name ?? "").trim())

  return parsed
}
