import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CommitteeBadge } from "@/components/teacher/CommitteeBadge"
import { CommitteeToolsManager } from "@/components/teacher/CommitteeToolsManager"
import Link from "next/link"

type Slug = "admin" | "discipline" | "it" | "curriculum"
type CommitteeType = "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM"

export async function generateStaticParams() {
  return [
    { type: "admin" },
    { type: "discipline" },
    { type: "it" },
    { type: "curriculum" },
  ]
}

const SLUG_TO_ENUM: Record<Slug, CommitteeType> = {
  admin:      "ADMIN",
  discipline: "DISCIPLINE",
  it:         "IT",
  curriculum: "CURRICULUM",
}

type CommitteeConfig = {
  label:       string
  description: string
  colorVar:    string
  tools: { label: string; description: string; href?: string }[]
  icon: React.ReactNode
}

const CONFIGS: Record<CommitteeType, CommitteeConfig> = {
  ADMIN: {
    label:       "行政委員",
    description: "管理學校日常行政事務，包括採購申請及活動文件管理。",
    colorVar:    "admin",
    tools: [
      { label: "採購申請",   description: "填寫及追蹤採購申請表" },
      { label: "活動文件",   description: "管理活動策劃及報告文件" },
      { label: "費用結算",   description: "班費及活動費用記錄"   },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-admin)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  DISCIPLINE: {
    label:       "訓育委員",
    description: "記錄及跟進學生行為事項，維持校內紀律。",
    colorVar:    "discipline",
    tools: [
      { label: "行為記錄",   description: "記錄學生違規及跟進情況", href: "/teacher/committee/discipline/behavior" },
      { label: "警告記錄",   description: "發出及管理學生警告"     },
      { label: "欠交功課",   description: "追蹤欠交功課記錄"       },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-discipline)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  IT: {
    label:       "資訊委員",
    description: "提供資訊科技工具支援，協助課堂互動活動。",
    colorVar:    "it",
    tools: [
      { label: "QR Code 生成器", description: "快速生成 QR Code 供課堂使用", href: "/teacher/committee/it/qr-code"       },
      { label: "課堂計時器",     description: "計時器助你掌握課堂節奏",      href: "/teacher/committee/it/timer"          },
      { label: "隨機點名器",     description: "隨機抽選學生，支援記錄名單",   href: "/teacher/committee/it/random-picker"  },
      { label: "HEIC 轉 JPG",   description: "本地轉換 iPhone 相片格式",     href: "/teacher/committee/it/heic-convert"   },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-it)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  CURRICULUM: {
    label:       "課程委員",
    description: "協調課程規劃及教具管理，確保教學資源充足。",
    colorVar:    "curriculum",
    tools: [
      { label: "欠帶教具記錄", description: "追蹤學生欠帶教具情況" },
      { label: "課程文件",     description: "管理課程大綱及教案"   },
      { label: "教材申請",     description: "申請及登記教學材料"   },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-curriculum)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
}

export default async function CommitteePage({ params }: { params: { type: string } }) {
  const slug = params.type as Slug
  const committeeType = SLUG_TO_ENUM[slug]
  if (!committeeType) notFound()

  const session = await auth()
  if (!session?.user) return null

  const config = CONFIGS[committeeType]

  // Fetch DB tools + todos + user's committee membership
  const [dbTools, todos, userRole] = await Promise.all([
    prisma.committeeTool.findMany({
      where: { committee: committeeType },
      orderBy: { order: "asc" },
    }),
    prisma.todo.findMany({
      where: {
        committee:   committeeType,
        createdById: session.user.id,
        status:      { not: "DONE" },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
    prisma.committeeRole.findFirst({
      where: {
        userId:    session.user.id,
        OR: [{ committee: committeeType }, { committee: "ADMIN" }],
      },
    }),
  ])

  const canEditTools = !!userRole

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Committee header card */}
      <div
        className="card p-6"
        style={{ borderTop: `3px solid var(--color-${config.colorVar})` }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-[12px] flex items-center justify-center shrink-0"
            style={{ background: `var(--color-${config.colorVar}-soft)` }}
          >
            {config.icon}
          </div>
          <div>
            <h1 className="text-h1">{config.label}</h1>
            <p className="text-body mt-1" style={{ color: "var(--color-ink-500)" }}>
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* DB-backed tools */}
      <div>
        <h2 className="text-h2 mb-4">工具</h2>
        <CommitteeToolsManager
          initialTools={dbTools.map((t) => ({
            id: t.id, label: t.label, description: t.description,
            type: t.type as "LINK" | "EMBED" | "HTML" | "GOOGLE_SHEET",
            content: t.content, order: t.order, active: t.active,
          }))}
          committee={committeeType}
          slug={slug}
          canEdit={canEditTools}
          colorVar={config.colorVar}
        />

        {/* Hardcoded static tools */}
        <h3 className="text-h3 mb-3" style={{ color: "var(--color-ink-700)" }}>預設工具</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.tools.map((tool) => {
            const inner = (
              <>
                <h3 className="text-h3 mb-1">{tool.label}</h3>
                <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
                  {tool.description}
                </p>
                <p
                  className="text-caption mt-3 font-medium"
                  style={{ color: tool.href ? `var(--color-${config.colorVar})` : "var(--color-ink-300)" }}
                >
                  {tool.href ? "開啟 →" : "即將推出"}
                </p>
              </>
            )
            return tool.href ? (
              <Link
                key={tool.label}
                href={tool.href}
                className="card p-5 hover:shadow-card-md transition-shadow block"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={tool.label}
                className="card p-5 opacity-60 cursor-not-allowed"
              >
                {inner}
              </div>
            )
          })}
        </div>
      </div>

      {/* This committee's todos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2">本組待辦事項</h2>
          <Link
            href={`/teacher/todos?committee=${committeeType}`}
            className="text-caption font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            查看全部 →
          </Link>
        </div>
        {todos.length === 0 ? (
          <div
            className="card p-6 text-center text-body"
            style={{ color: "var(--color-ink-300)" }}
          >
            暫無待辦事項
          </div>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="card pl-4 pr-4 py-3 flex items-center gap-3"
                style={{ borderLeft: `3px solid var(--color-${config.colorVar})` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
                    {todo.title}
                  </p>
                  {todo.dueDate && (
                    <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
                      {new Date(todo.dueDate).getMonth()+1}月{new Date(todo.dueDate).getDate()}日
                    </p>
                  )}
                </div>
                <CommitteeBadge committee={committeeType} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
