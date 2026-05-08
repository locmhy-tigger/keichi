import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { DashboardGreeting } from "@/components/teacher/DashboardGreeting"
import { TodoPreview } from "@/components/teacher/TodoPreview"
import { MiniCalendar } from "@/components/teacher/MiniCalendar"
import { CommitteeToolsGrid } from "@/components/teacher/CommitteeToolsGrid"

export default async function TeacherDashboard() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const now      = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const upcomingTodos = await prisma.todo.findMany({
    where: {
      createdById: session.user.id,
      status: { not: "DONE" },
    },
    orderBy: [{ dueDate: "asc" }],
    take: 10,
  })

  const overdueTodos = upcomingTodos.filter(
    (t) => t.dueDate && t.dueDate < now
  )
  const todayTodos = upcomingTodos.filter(
    (t) => t.dueDate && t.dueDate <= nextWeek
  )

  const serializedTodos = upcomingTodos.map((t) => ({
    id:          t.id,
    title:       t.title,
    committee:   t.committee as "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM",
    status:      t.status    as "OPEN" | "IN_PROGRESS" | "DONE",
    dueDate:     t.dueDate?.toISOString() ?? null,
    description: t.description,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <DashboardGreeting
        name={session.user.name}
        urgentCount={overdueTodos.length}
        todayCount={todayTodos.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <TodoPreview initialTodos={serializedTodos} />
        <MiniCalendar todos={serializedTodos} />
      </div>

      <CommitteeToolsGrid />
    </div>
  )
}
