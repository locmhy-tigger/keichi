import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Demo accounts
  const teacherPw = await bcrypt.hash("teacher123", 10)
  const adminPw   = await bcrypt.hash("admin123",   10)
  const studentPw = await bcrypt.hash("student123", 10)

  const teacher = await prisma.user.upsert({
    where:  { email: "teacher@demo.hk" },
    update: { password: teacherPw },
    create: { email: "teacher@demo.hk", name: "示範老師", role: "TEACHER", password: teacherPw, emailVerified: new Date() },
  })

  const admin = await prisma.user.upsert({
    where:  { email: "admin@demo.hk" },
    update: { password: adminPw },
    create: { email: "admin@demo.hk", name: "管理員陳老師", role: "TEACHER", password: adminPw, emailVerified: new Date() },
  })

  await prisma.user.upsert({
    where:  { email: "student@demo.hk" },
    update: { password: studentPw },
    create: { email: "student@demo.hk", name: "示範學生", role: "STUDENT", password: studentPw, emailVerified: new Date() },
  })

  // Demo class
  const cls = await prisma.class.upsert({
    where:  { classCode: "DEMO01" },
    update: {},
    create: { name: "4A ICT", classCode: "DEMO01", teacherId: teacher.id },
  })

  // Legacy seed class
  await prisma.class.upsert({
    where:  { classCode: "TEST01" },
    update: {},
    create: { name: "示範班", classCode: "TEST01", teacherId: teacher.id },
  })

  // Sample mission
  const existing = await prisma.mission.findFirst({ where: { classId: cls.id } })
  if (!existing) {
    await prisma.mission.create({
      data: {
        classId: cls.id,
        title: "認識 Prompt Engineering",
        type: "PROMPT",
        status: "PUBLISHED",
        content: {
          scenario: "你是一位老師，請設計一個 Prompt 讓 AI 幫你為學生解釋光合作用。",
          rubric: "指令需包含：目標對象（中學生）、輸出格式（條列式）、長度限制（100字內）。",
          level: "FREE",
        },
        difficulty: "BASIC",
        pointsReward: 100,
      },
    })
  }

  // Sample todos for demo teacher
  await prisma.todo.createMany({
    data: [
      {
        title: "準備下週行政會議議程",
        committee: "ADMIN",
        status: "OPEN",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdById: admin.id,
      },
      {
        title: "跟進上月欠交功課名單",
        committee: "DISCIPLINE",
        status: "IN_PROGRESS",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        createdById: admin.id,
      },
      {
        title: "更新電腦室使用時間表",
        committee: "IT",
        status: "OPEN",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: teacher.id,
      },
    ],
    skipDuplicates: true,
  })

  console.log("Seed completed: demo accounts + class + todos created.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
