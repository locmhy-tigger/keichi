import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { sendEmail, isEmailConfigured } from "@/lib/email"
import { findHomeroom, BEHAVIOR_LABEL } from "@/lib/discipline"
import type { BehaviorType } from "@prisma/client"
import { z } from "zod"

const schema = z.object({
  className:   z.string().min(1),
  studentName: z.string().min(1),
  note:        z.string().max(1000).optional(),
})

// POST — manually email a student's class teacher (班主任) for follow-up,
// with a summary of the student's behavior records.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "系統尚未設定電郵服務（RESEND_API_KEY / MAIL_FROM）" }, { status: 503 })
  }

  const { className, studentName, note } = schema.parse(await req.json())

  const homeroom = await findHomeroom(className)
  if (!homeroom?.teacherEmail) {
    return NextResponse.json({ error: `班別「${className}」尚未設定班主任電郵，請先到訓育設定填寫。` }, { status: 400 })
  }

  // Summarize this student's records by category.
  const records = await prisma.behaviorRecord.findMany({
    where:   { className, studentName },
    orderBy: { date: "desc" },
    take:    50,
  })

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {})
  const summary = Object.entries(counts)
    .map(([t, n]) => `${BEHAVIOR_LABEL[t as BehaviorType]} ${n} 次`)
    .join("、") || "暫無紀錄"

  const recentRows = records.slice(0, 10).map((r) =>
    `<tr><td style="padding:4px 8px;border:1px solid #ddd">${new Date(r.date).toLocaleDateString("zh-HK")}</td><td style="padding:4px 8px;border:1px solid #ddd">${BEHAVIOR_LABEL[r.type]}</td><td style="padding:4px 8px;border:1px solid #ddd">${r.description}</td></tr>`
  ).join("")

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const senderNm = session.user.name ?? "訓育組"

  const result = await sendEmail({
    to:      homeroom.teacherEmail,
    subject: `【訓育跟進】${className} ${studentName} 行為紀錄`,
    html: `
      <div style="font-family:sans-serif;line-height:1.6">
        <p>${homeroom.teacherName} 老師：</p>
        <p>訓育組請你跟進貴班學生 <strong>${studentName}</strong>（${className}）的行為表現。</p>
        <p><strong>紀錄摘要：</strong>${summary}</p>
        ${note ? `<p><strong>訓育組備註：</strong>${note}</p>` : ""}
        ${recentRows ? `<table style="border-collapse:collapse;margin-top:8px"><thead><tr><th style="padding:4px 8px;border:1px solid #ddd">日期</th><th style="padding:4px 8px;border:1px solid #ddd">類別</th><th style="padding:4px 8px;border:1px solid #ddd">描述</th></tr></thead><tbody>${recentRows}</tbody></table>` : ""}
        <p style="margin-top:12px"><a href="${appUrl}/teacher/committee/discipline/dashboard">開啟訓育行為儀表板</a></p>
        <p style="color:#888;font-size:12px">由 ${senderNm} 透過基智中學校務系統發送。</p>
      </div>`,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "電郵發送失敗，請稍後再試。", detail: result.error }, { status: 502 })
  }

  // In-app notify too, if the class teacher is a system user.
  if (homeroom.teacherUserId) {
    await prisma.notification.create({
      data: {
        userId: homeroom.teacherUserId,
        type:   "BEHAVIOR",
        title:  `訓育跟進：${className} ${studentName}`,
        body:   summary,
        link:   "/teacher/committee/discipline/dashboard",
      },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, sentTo: homeroom.teacherEmail })
}
