import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { completeLLM } from "@/lib/llm"
import { aiRateLimit } from "@/lib/rate-limit"
import { docxToText, parseExtracted, NOTICE_EXTRACT_PROMPT } from "@/lib/notice-extract"
import Anthropic from "@anthropic-ai/sdk"

// POST — upload an existing notice; get back a proposed form payload.
// Nothing is saved: the teacher reviews the filled form and saves/submits
// themselves, keeping the rule that the LLM never writes to the DB directly.

const MAX_BYTES = 20 * 1024 * 1024

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const VISION_MIME: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", gif: "image/gif",
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const limited = await aiRateLimit(session.user.id, session.user.role, "notice-extract")
  if (limited) return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "未收到檔案" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "檔案過大（上限 20MB）" }, { status: 413 })
  }

  const ext   = (file.name.split(".").pop() || "").toLowerCase()
  const ct    = (file.type || "").toLowerCase()
  const bytes = Buffer.from(await file.arrayBuffer())

  try {
    // ── Text-extractable formats: run through the switchable LLM so the
    //    admin's provider choice (Anthropic / OpenRouter / local) is honoured.
    let text = ""
    if (ext === "docx" || ct === DOCX) {
      text = docxToText(bytes)
      if (!text.trim()) {
        return NextResponse.json({ error: "無法讀取此 Word 文件的內容，請另存為 .docx 或改用 PDF。" }, { status: 400 })
      }
    } else if (ext === "txt" || ct.startsWith("text/")) {
      text = bytes.toString("utf-8")
    }

    if (text) {
      const raw = await completeLLM("claude", [
        { role: "user", content: `${NOTICE_EXTRACT_PROMPT}\n\n---\n\n${text.slice(0, 24000)}` },
      ], { maxTokens: 4000 })
      return NextResponse.json({ payload: parseExtracted(raw), source: "text" })
    }

    // ── PDFs and scans need vision, which the OpenAI-compatible path in
    //    llm.ts doesn't cover — so this branch is Anthropic-only, mirroring
    //    the existing quotation OCR tool.
    const mediaType = VISION_MIME[ext] || (ct.startsWith("image/") || ct === "application/pdf" ? ct : "")
    if (!mediaType) {
      return NextResponse.json({ error: "不支援此檔案格式，請上載 .docx、PDF 或圖片。" }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "PDF／圖片匯入需要 Anthropic 金鑰。請改用 .docx，或請管理員設定 ANTHROPIC_API_KEY。" },
        { status: 503 },
      )
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const b64 = bytes.toString("base64")
    type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    const block: Anthropic.ContentBlockParam =
      mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
        : { type: "image",    source: { type: "base64", media_type: mediaType as ImageMime, data: b64 } }

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: [block, { type: "text", text: NOTICE_EXTRACT_PROMPT }] }],
    })
    const textBlock = message.content.find((c): c is Anthropic.TextBlock => c.type === "text")
    return NextResponse.json({ payload: parseExtracted(textBlock?.text ?? ""), source: "vision" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[notice/extract] error:", msg)
    return NextResponse.json({ error: `識別失敗：${msg}` }, { status: 500 })
  }
}
