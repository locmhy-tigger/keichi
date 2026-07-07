import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"

// GET — classes with their student rosters. Teacher-readable; used by the
// behavior-record form (class dropdown + student multi-select) and dashboard.
export async function GET() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const classes = await prisma.homeroomClass.findMany({
    orderBy: { className: "asc" },
    select: {
      id:           true,
      className:    true,
      teacherName:  true,
      teacherEmail: true,
      students: {
        orderBy: [{ classNumber: "asc" }, { studentName: "asc" }],
        select:  { studentName: true, classNumber: true },
      },
    },
  })

  return NextResponse.json({ classes })
}
