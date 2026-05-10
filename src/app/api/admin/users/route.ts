import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — list all users with committee memberships and class enrollments
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
      enrollments: {
        select: {
          class: { select: { id: true, name: true, classCode: true } }
        }
      }
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(users)
}

// POST — create a single user
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { email, name, role, classCode } = await req.json()

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: role || "STUDENT",
      }
    })

    if (classCode && role === "STUDENT") {
      const cls = await prisma.class.findUnique({ where: { classCode } })
      if (cls) {
        await prisma.classEnrollment.create({
          data: {
            classId: cls.id,
            studentId: user.id
          }
        })
      }
    }

    return NextResponse.json(user)
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
