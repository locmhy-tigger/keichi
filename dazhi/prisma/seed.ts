import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  // Create test teacher
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@school.edu.hk" },
    update: {},
    create: { email: "teacher@school.edu.hk", name: "示範老師", role: "TEACHER" },
  })

  // Create test class
  const cls = await prisma.class.upsert({
    where: { classCode: "TEST01" },
    update: {},
    create: { name: "4A ICT", classCode: "TEST01", teacherId: teacher.id },
  })

  // Create sample mission
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

  console.log("Seed completed.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
