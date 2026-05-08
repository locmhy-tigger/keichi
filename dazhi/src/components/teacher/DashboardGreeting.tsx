function getGreeting(): string {
  const hour = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" })
  ).getHours()
  if (hour < 12) return "早上好"
  if (hour < 18) return "下午好"
  return "晚上好"
}

type Props = {
  name?: string | null
  urgentCount: number
  todayCount: number
}

export function DashboardGreeting({ name, urgentCount, todayCount }: Props) {
  const greeting = getGreeting()
  const firstName = name?.split(" ")[0] ?? "老師"

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="text-caption mb-1" style={{ color: "var(--color-ink-500)" }}>
          歡迎回來
        </p>
        <h1 className="text-h1">
          {greeting}，{firstName}
          {urgentCount > 0 && (
            <span className="ml-3 text-h2 font-semibold" style={{ color: "var(--color-discipline)" }}>
              · {urgentCount} 項待辦緊急
            </span>
          )}
        </h1>
        <p className="mt-1 text-body" style={{ color: "var(--color-ink-500)" }}>
          {urgentCount === 0
            ? "今天一切正常，繼續加油！"
            : `今天共 ${todayCount} 項安排 · ${urgentCount} 項逾期需處理`}
        </p>
      </div>
    </div>
  )
}
