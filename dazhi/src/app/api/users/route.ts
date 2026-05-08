import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — list all TEACHER users (for assignee pickers)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id:    true,
      name:  true,
      email: true,
      image: true,
      committeeRoles: {
        select: { committee: true, isChair: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}
