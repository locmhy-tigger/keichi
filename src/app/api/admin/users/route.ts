import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

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
          classNumber: true,
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
    const { email, name, role, password, committees, classCode, classNumber } = await req.json()

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: role || "STUDENT",
        password: hashedPassword,
        committeeRoles: committees && committees.length > 0 ? {
          create: committees.map((c: any) => ({
            committee: c.committee || c,
            isChair: c.isChair || false
          }))
        } : undefined
      }
    })

    if (classCode && role === "STUDENT") {
      const codes = Array.isArray(classCode) ? classCode : [classCode]
      const nums  = Array.isArray(classNumber) ? classNumber : [classNumber]
      const classes = await prisma.class.findMany({
        where: { classCode: { in: codes } }
      })
      
      if (classes.length > 0) {
        await prisma.classEnrollment.createMany({
          data: classes.map((cls, idx) => ({
            classId: cls.id,
            studentId: user.id,
            classNumber: nums[idx] || null
          }))
        })
      }
    }

    return NextResponse.json(user)
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 })
    }
    console.error("User creation error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
