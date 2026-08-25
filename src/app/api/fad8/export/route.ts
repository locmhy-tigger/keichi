import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import ExcelJS from "exceljs"

// One flat sheet: a row per (student × activity), which is what a year-end
// FAD8 return needs. The per-activity FAD8.xlsx template stays where it is —
// that one is for a single activity's paperwork.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const qs  = new URLSearchParams()
  for (const k of ["from", "to"]) { const v = url.searchParams.get(k); if (v) qs.set(k, v) }

  // Reuse the compile endpoint so both views can never disagree.
  const res = await fetch(`${url.origin}/api/fad8/compile?${qs}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  })
  if (!res.ok) return NextResponse.json({ error: "彙編失敗" }, { status: 500 })
  const data = await res.json() as {
    period: { label: string; from: string; to: string }
    students: { className: string; classNumber: string; name: string
                entries: { activity: string; category: string; achievement: string; dates: string[]; dept: string }[] }[]
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("FAD8 年度彙編")

  ws.addRow([`FAD8 學生學習紀錄年度彙編　${data.period.label}`])
  ws.getRow(1).font = { bold: true, size: 14 }
  ws.addRow([`期間：${data.period.from} 至 ${data.period.to}`])
  ws.addRow([])

  const header = ["班別", "學號", "姓名", "活動名稱", "活動類別", "獎項／表現", "日期", "負責科組"]
  const hRow = ws.addRow(header)
  hRow.font = { bold: true }
  hRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } }
    c.font = { bold: true, color: { argb: "FFFFFFFF" } }
  })

  for (const s of data.students) {
    for (const e of s.entries) {
      ws.addRow([
        s.className, s.classNumber, s.name,
        e.activity, e.category, e.achievement,
        e.dates.join("、"), e.dept,
      ])
    }
  }

  ws.columns = [
    { width: 8 }, { width: 8 }, { width: 16 }, { width: 34 },
    { width: 20 }, { width: 20 }, { width: 28 }, { width: 14 },
  ]

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="FAD8_${data.period.label}.xlsx"`,
    },
  })
}
