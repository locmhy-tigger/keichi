import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { toCsv, csvResponse } from "@/lib/csv"

// GET — export the current teacher's behavior records as CSV.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") as "MISCONDUCT" | "MERIT" | null

  const records = await prisma.behaviorRecord.findMany({
    where: { authorId: session.user.id, ...(type ? { type } : {}) },
    orderBy: { date: "desc" },
  })

  const csv = toCsv(
    ["日期", "班別", "學生", "類別", "描述", "跟進行動", "已處理"],
    records.map((r) => [
      new Date(r.date).toLocaleDateString("zh-HK"),
      r.className,
      r.studentName,
      r.type === "MERIT" ? "優點" : "違規",
      r.description,
      r.action ?? "",
      r.resolved ? "是" : "否",
    ])
  )

  return csvResponse(csv, "behavior-records.csv")
}
