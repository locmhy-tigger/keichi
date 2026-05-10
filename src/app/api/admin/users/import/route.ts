import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type CommitteeType = "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM"
type Role = "TEACHER" | "STUDENT"

const VALID_COMMITTEES = new Set<CommitteeType>(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"])
const VALID_ROLES      = new Set<Role>(["TEACHER", "STUDENT"])

function parseCommittees(raw: string): CommitteeType[] {
  if (!raw.trim()) return []
  return raw.split("|").map((s) => s.trim()).filter((s): s is CommitteeType => VALID_COMMITTEES.has(s as CommitteeType))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const text = await file.text()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have header + at least one row" }, { status: 400 })
  }

  // Skip header row
  const dataLines = lines.slice(1)

  let created = 0
  let updated = 0
  const errors: { row: number; email: string; reason: string }[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i]
    const parts = row.split(",")
    if (parts.length < 3) {
      errors.push({ row: i + 2, email: parts[0] ?? "", reason: "Too few columns (expected: email,name,role,committees,chairOf)" })
      continue
    }

    const [email, name, roleRaw, committeesRaw = "", chairOfRaw = ""] = parts
    const trimmedEmail = email.trim()
    const trimmedName  = name.trim()
    const role         = roleRaw.trim() as Role

    if (!trimmedEmail) {
      errors.push({ row: i + 2, email: trimmedEmail, reason: "Email is required" })
      continue
    }

    if (!VALID_ROLES.has(role)) {
      errors.push({ row: i + 2, email: trimmedEmail, reason: `Invalid role "${roleRaw}" — must be TEACHER or STUDENT` })
      continue
    }

    const committees = parseCommittees(committeesRaw)
    const chairOf    = parseCommittees(chairOfRaw)

    try {
      const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } })

      if (existing) {
        await prisma.user.update({
          where: { email: trimmedEmail },
          data: {
            name: trimmedName || existing.name,
            role,
          },
        })

        // Replace committee memberships
        await prisma.committeeRole.deleteMany({ where: { userId: existing.id } })
        if (committees.length > 0) {
          await prisma.committeeRole.createMany({
            data: committees.map((c) => ({
              userId:    existing.id,
              committee: c,
              isChair:   chairOf.includes(c),
            })),
          })
        }
        updated++
      } else {
        const newUser = await prisma.user.create({
          data: {
            email: trimmedEmail,
            name:  trimmedName || null,
            role,
          },
        })

        if (committees.length > 0) {
          await prisma.committeeRole.createMany({
            data: committees.map((c) => ({
              userId:    newUser.id,
              committee: c,
              isChair:   chairOf.includes(c),
            })),
          })
        }
        created++
      }
    } catch (_err) {
      errors.push({ row: i + 2, email: trimmedEmail, reason: "Database error — check for duplicate entries" })
    }
  }

  return NextResponse.json({ created, updated, errors })
}
