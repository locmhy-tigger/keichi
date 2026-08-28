import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pdSession } from "@/lib/pd-auth"
import { hkYmd } from "@/lib/hk-date"

// GET — propose 假期 rows from the 學校活動及假期 (SCHOOL) calendar.
//
// Deliberately returns *candidates* rather than writing them: a SCHOOL event
// is not necessarily a non-teaching day (陸運會 and 家長日 sit in the same
// category as 聖誕假期), so the admin reviews the list on the 設定 tab and
// saves it with everything else. Exam periods stay manual, per the spec.
export async function GET(req: NextRequest) {
  const session = await pdSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url  = new URL(req.url)
  const from = url.searchParams.get("from")
  const to   = url.searchParams.get("to")

  const events = await prisma.calendarEvent.findMany({
    where: {
      committee: "SCHOOL",
      ...(from ? { startDate: { gte: new Date(`${from}T00:00:00+08:00`) } } : {}),
      ...(to   ? { startDate: { lte: new Date(`${to}T23:59:59+08:00`) } }   : {}),
    },
    select: { id: true, title: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
    take: 300,
  })

  // A light hint only — the admin still decides. Anything reading as a break
  // or a suspension of lessons is pre-ticked; everything else comes unticked.
  const HOLIDAY_HINT = /假期|假日|停課|休業|不用上課|放假|holiday|break/i

  const candidates = events.map((e) => ({
    name:      e.title,
    type:      "HOLIDAY" as const,
    startDate: hkYmd(e.startDate),
    endDate:   hkYmd(e.endDate ?? e.startDate),
    freeFrom:  null,
    likely:    HOLIDAY_HINT.test(e.title),
  }))

  return NextResponse.json({ candidates })
}
