import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { extractQuotationFromImage } from "@/lib/claude"

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB upload limit (matches original tool)

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "未收到檔案" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "檔案過大（上限 20MB）" }, { status: 413 })
  }

  // Resolve media type: trust content-type if allowed, else guess by extension,
  // else default to image/jpeg (matches the original tool's fallback).
  const ct = (file.type || "").toLowerCase()
  let mediaType = ALLOWED.has(ct) ? ct : ""
  if (!mediaType) {
    const ext = (file.name.split(".").pop() || "").toLowerCase()
    mediaType = MIME_BY_EXT[ext] || "image/jpeg"
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  try {
    const result = await extractQuotationFromImage(bytes, mediaType)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[quotation/ocr] error:", msg)
    return NextResponse.json({ error: `識別失敗：${msg}` }, { status: 500 })
  }
}
