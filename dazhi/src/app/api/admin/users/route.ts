import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — list all users with committee memberships (admin management)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    select: {
      id:            true,
      name:          true,
      email:         true,
      image:         true,
      role:          true,
      createdAt:     true,
      committeeRoles: {
        select: { committee: true, isChair: true },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(users)
}
