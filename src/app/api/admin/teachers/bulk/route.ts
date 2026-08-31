import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { splitTags } from "@/lib/school-org"

// Bulk staff upsert (中文姓名 / 英文姓名 / 電郵 / 科組 / 委員會 / 時間表姓名).
// Keyed on email like the student importer, so re-pasting an updated sheet
// edits the same accounts. New accounts are created as TEACHER; an existing
// ADMIN keeps its role.

const schema = z.object({
  rows: z.array(z.object({
    id:            z.number(),
    nameZh:        z.string().trim().max(100).optional().default(""),
    nameEn:        z.string().trim().max(100).optional().default(""),
    email:         z.string().trim().max(200).optional().default(""),
    // 科組 and 委員會 arrive as one cell each so they survive an Excel paste;
    // splitTags turns 「中文、電腦」 into a list.
    departments:   z.string().trim().max(300).optional().default(""),
    committees:    z.string().trim().max(600).optional().default(""),
    timetableName: z.string().trim().max(50).optional().default(""),
  })).max(300),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { rows } = schema.parse(await req.json())

  const results: { id: number; ok: boolean; message: string }[] = []
  let created = 0
  let updated = 0

  for (const r of rows) {
    const email = r.email.toLowerCase()
    if (!email && !r.nameZh && !r.nameEn && !r.departments && !r.committees) continue

    if (!email) { results.push({ id: r.id, ok: false, message: "缺少電郵" }); continue }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ id: r.id, ok: false, message: "電郵格式不正確" }); continue
    }
    if (!r.nameZh && !r.nameEn) {
      results.push({ id: r.id, ok: false, message: "請填寫中文或英文姓名" }); continue
    }

    try {
      const departments = splitTags(r.departments).slice(0, 20)
      const committees  = splitTags(r.committees).slice(0, 40)

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })

      // Don't quietly promote a student account into staff.
      if (existing && existing.role === "STUDENT") {
        results.push({ id: r.id, ok: false, message: "此電郵屬學生帳戶，未更改" })
        continue
      }

      if (existing) {
        await prisma.user.update({
          where: { email },
          data: {
            ...(r.nameZh ? { name: r.nameZh } : {}),
            ...(r.nameEn ? { nameEn: r.nameEn } : {}),
            departments,
            committees,
            timetableName: r.timetableName || null,
          },
        })
        updated++
      } else {
        await prisma.user.create({
          data: {
            email,
            name:          r.nameZh || r.nameEn,
            nameEn:        r.nameEn || null,
            departments,
            committees,
            timetableName: r.timetableName || null,
            role:          "TEACHER",
          },
        })
        created++
      }

      results.push({ id: r.id, ok: true, message: existing ? "已更新" : "已新增" })
    } catch (err) {
      console.error("[teachers/bulk] row failed:", err)
      results.push({ id: r.id, ok: false, message: "儲存失敗" })
    }
  }

  return NextResponse.json({ created, updated, results })
}
