"use client"

import { useEffect, useState } from "react"
import { CommitteeBadge } from "@/components/teacher/CommitteeBadge"

type CommitteeType = "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM"
type TodoStatus    = "OPEN" | "IN_PROGRESS" | "DONE"

type Todo = {
  id:          string
  title:       string
  description: string | null
  committee:   CommitteeType
  status:      TodoStatus
  dueDate:     string | null
}

const COMMITTEE_FILTER: { label: string; value: CommitteeType | "ALL" }[] = [
  { label: "全部",     value: "ALL"        },
  { label: "行政",     value: "ADMIN"      },
  { label: "訓育",     value: "DISCIPLINE" },
  { label: "資訊科技", value: "IT"         },
  { label: "課程發展", value: "CURRICULUM" },
]

const STATUS_FILTER: { label: string; value: TodoStatus | "ALL" }[] = [
  { label: "全部",   value: "ALL"         },
  { label: "待處理", value: "OPEN"        },
  { label: "進行中", value: "IN_PROGRESS" },
  { label: "完成",   value: "DONE"        },
]

const BORDER: Record<CommitteeType, string> = {
  ADMIN:      "committee-border-admin",
  DISCIPLINE: "committee-border-discipline",
  IT:         "committee-border-it",
  CURRICULUM: "committee-border-curriculum",
}

const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  OPEN:        "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE:        "OPEN",
}

const BTN_LABEL: Record<TodoStatus, string> = {
  OPEN:        "開始",
  IN_PROGRESS: "完成",
  DONE:        "重開",
}

function formatDue(d: string | null): string {
  if (!d) return ""
  const date = new Date(d)
  return `${date.getMonth()+1}月${date.getDate()}日`
}

function isOverdue(d: string | null, status: TodoStatus): boolean {
  if (!d || status === "DONE") return false
  return new Date(d) < new Date()
}

export default function TodosPage() {
  const [todos,       setTodos]       = useState<Todo[]>([])
  const [loading,     setLoading]     = useState(true)
  const [committee,   setCommittee]   = useState<CommitteeType | "ALL">("ALL")
  const [status,      setStatus]      = useState<TodoStatus | "ALL">("ALL")
  const [showForm,    setShowForm]    = useState(false)

  // New todo form state
  const [title,       setTitle]       = useState("")
  const [desc,        setDesc]        = useState("")
  const [newCommittee,setNewCommittee]= useState<CommitteeType>("ADMIN")
  const [dueDate,     setDueDate]     = useState("")
  const [saving,      setSaving]      = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (committee !== "ALL") params.set("committee", committee)
    if (status    !== "ALL") params.set("status",    status)
    const res = await fetch(`/api/todos?${params}`)
    if (res.ok) setTodos(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [committee, status]) // eslint-disable-line

  async function advance(todo: Todo) {
    const next = NEXT_STATUS[todo.status]
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, status: next } : t))
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/todos/${id}`, { method: "DELETE" })
  }

  async function createTodo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/todos", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: desc || undefined,
        committee: newCommittee,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setTodos((prev) => [created, ...prev])
      setTitle(""); setDesc(""); setDueDate(""); setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1">待辦事項</h1>
          <p className="text-body mt-0.5" style={{ color: "var(--color-ink-500)" }}>
            個人任務管理
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-input text-body font-medium text-white transition-colors"
          style={{ background: "var(--color-accent)" }}
        >
          + 新增待辦
        </button>
      </div>

      {/* New todo form */}
      {showForm && (
        <form onSubmit={createTodo} className="card p-5 mb-6 space-y-4">
          <h3 className="text-h3">新增待辦事項</h3>
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>標題 *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="待辦事項標題"
              className="w-full px-3 py-2 text-body rounded-input border outline-none focus:ring-2"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-ink-900)",
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>委員會</label>
              <select
                value={newCommittee}
                onChange={(e) => setNewCommittee(e.target.value as CommitteeType)}
                className="w-full px-3 py-2 text-body rounded-input border"
                style={{
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink-900)",
                }}
              >
                <option value="ADMIN">行政</option>
                <option value="DISCIPLINE">訓育</option>
                <option value="IT">資訊科技</option>
                <option value="CURRICULUM">課程發展</option>
              </select>
            </div>
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-body rounded-input border"
                style={{
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink-900)",
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>備注</label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="（選填）"
              className="w-full px-3 py-2 text-body rounded-input border resize-none"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-ink-900)",
              }}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-body rounded-input border"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-ink-700)",
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-body font-medium rounded-input text-white"
              style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "儲存中…" : "儲存"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Committee filter */}
        <div className="flex gap-2 flex-wrap">
          {COMMITTEE_FILTER.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setCommittee(value)}
              className="px-3 py-1.5 rounded-pill text-caption font-medium transition-colors"
              style={{
                background: committee === value ? "var(--color-accent)" : "var(--color-surface)",
                color:      committee === value ? "white"               : "var(--color-ink-700)",
                border:     "1px solid var(--color-border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTER.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className="px-3 py-1.5 rounded-pill text-caption font-medium transition-colors"
              style={{
                background: status === value ? "var(--color-ink-900)" : "var(--color-surface)",
                color:      status === value ? "white"                : "var(--color-ink-700)",
                border:     "1px solid var(--color-border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      {loading ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>暫無待辦事項</div>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => {
            const overdue = isOverdue(todo.dueDate, todo.status)
            return (
              <li
                key={todo.id}
                className={`card ${BORDER[todo.committee]} pl-4 pr-4 py-3 flex items-start gap-3`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
                      {todo.title}
                    </span>
                    <CommitteeBadge committee={todo.committee} />
                  </div>
                  {todo.description && (
                    <p className="text-caption mt-0.5 truncate" style={{ color: "var(--color-ink-500)" }}>
                      {todo.description}
                    </p>
                  )}
                  {todo.dueDate && (
                    <p
                      className="text-caption mt-0.5"
                      style={{ color: overdue ? "var(--color-discipline)" : "var(--color-ink-500)" }}
                    >
                      {overdue ? "⚠ 逾期 · " : ""}{formatDue(todo.dueDate)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => advance(todo)}
                    className="text-caption font-medium px-2.5 py-1 rounded-input border transition-colors"
                    style={{
                      border: "1px solid var(--color-border)",
                      color: "var(--color-ink-700)",
                      background: "var(--color-surface-2)",
                    }}
                  >
                    {BTN_LABEL[todo.status]}
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-caption px-2 py-1 rounded-input transition-colors hover:bg-[var(--color-discipline-soft)]"
                    style={{ color: "var(--color-ink-300)" }}
                    title="刪除"
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
