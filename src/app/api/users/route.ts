import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — list staff accounts with optional ?q= search and ?take= limit.
//
// ADMIN accounts are included: an admin is still a teacher on the timetable,
// and leaving them out made them unpickable in 教師進修.
//
// The default take of 20 suits a type-ahead that re-queries the server on
// every keystroke (待辦事項). A caller that loads the list once and filters it
// in the browser must ask for a real limit — otherwise it silently shows only
// the first 20 staff, which is what happened on the 教師進修 picker.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isTeacherOrAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const params = new URL(req.url).searchParams
  const q      = params.get("q")?.trim()
  const take   = Math.min(Math.max(parseInt(params.get("take") ?? "20", 10) || 20, 1), 500)

  const users = await prisma.user.findMany({
    where: {
      role: { in: ["TEACHER", "ADMIN"] },
      // Names may be stored in Chinese or English, and some accounts only have
      // the email — search all three so nobody is unreachable.
      ...(q ? {
        OR: [
          { name:   { contains: q, mode: "insensitive" as const } },
          { nameEn: { contains: q, mode: "insensitive" as const } },
          { email:  { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    select: {
      id:    true,
      name:  true,
      nameEn: true,
      email: true,
      image: true,
      committeeRoles: { select: { committee: true, isChair: true } },
    },
    orderBy: { name: "asc" },
    take,
  })

  return NextResponse.json(users)
}
