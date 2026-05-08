"use client"

import { useEffect, useState } from "react"
import { CommitteeBadge } from "@/components/teacher/CommitteeBadge"

type CommitteeType = "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM"

type CommitteeRole = {
  committee: CommitteeType
  isChair:   boolean
}

type User = {
  id:             string
  name:           string | null
  email:          string | null
  image:          string | null
  role:           "TEACHER" | "STUDENT"
  createdAt:      string
  committeeRoles: CommitteeRole[]
}

const COMMITTEES: { value: CommitteeType; label: string }[] = [
  { value: "ADMIN",      label: "行政"     },
  { value: "DISCIPLINE", label: "訓育"     },
  { value: "IT",         label: "資訊科技" },
  { value: "CURRICULUM", label: "課程發展" },
]

function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const initials = user.name ? user.name.slice(0, 1) : "?"
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt={user.name ?? ""} className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-full shrink-0 flex items-center justify-center text-white font-medium"
      style={{ width: size, height: size, background: "var(--color-accent)", fontSize: size * 0.44 }}>
      {initials}
    </div>
  )
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/users")
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleRole(user: User) {
    const newRole = user.role === "TEACHER" ? "STUDENT" : "TEACHER"
    setSaving(user.id)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      const updated: User = await res.json()
      setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u))
    }
    setSaving(null)
  }

  async function addToCommittee(userId: string, committee: CommitteeType, isChair: boolean) {
    setSaving(`${userId}-${committee}`)
    const res = await fetch("/api/admin/committee-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, committee, isChair }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => {
        if (u.id !== userId) return u
        const existing = u.committeeRoles.filter((r) => r.committee !== committee)
        return { ...u, committeeRoles: [...existing, { committee, isChair }] }
      }))
    }
    setSaving(null)
  }

  async function removeFromCommittee(userId: string, committee: CommitteeType) {
    setSaving(`${userId}-${committee}`)
    const params = new URLSearchParams({ userId, committee })
    const res = await fetch(`/api/admin/committee-roles?${params}`, { method: "DELETE" })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => {
        if (u.id !== userId) return u
        return { ...u, committeeRoles: u.committeeRoles.filter((r) => r.committee !== committee) }
      }))
    }
    setSaving(null)
  }

  async function toggleChair(userId: string, committee: CommitteeType, currentIsChair: boolean) {
    await addToCommittee(userId, committee, !currentIsChair)
  }

  const teachers = users.filter((u) => u.role === "TEACHER")
  const students = users.filter((u) => u.role === "STUDENT")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-h1">用戶管理</h1>
        <p className="text-body mt-0.5" style={{ color: "var(--color-ink-500)" }}>
          管理教職員帳號及委員會成員
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
      ) : (
        <div className="space-y-8">

          {/* Teachers section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-h2">教職員</h2>
              <span
                className="text-caption px-2 py-0.5 rounded-pill font-medium"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
              >
                {teachers.length}
              </span>
            </div>

            <div className="space-y-3">
              {teachers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  saving={saving}
                  onToggleRole={toggleRole}
                  onAddCommittee={addToCommittee}
                  onRemoveCommittee={removeFromCommittee}
                  onToggleChair={toggleChair}
                />
              ))}
              {teachers.length === 0 && (
                <p className="text-body" style={{ color: "var(--color-ink-300)" }}>無</p>
              )}
            </div>
          </section>

          {/* Students section */}
          {students.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-h2">學生帳號</h2>
                <span
                  className="text-caption px-2 py-0.5 rounded-pill font-medium"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-ink-500)" }}
                >
                  {students.length}
                </span>
              </div>
              <div className="space-y-2">
                {students.map((user) => (
                  <div key={user.id} className="card px-4 py-3 flex items-center gap-3">
                    <Avatar user={user} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
                        {user.name ?? "—"}
                      </p>
                      <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={saving === user.id}
                      className="text-caption px-3 py-1.5 rounded-input border transition-colors"
                      style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}
                    >
                      升為教職員
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function UserRow({
  user, saving, onToggleRole, onAddCommittee, onRemoveCommittee, onToggleChair,
}: {
  user:               User
  saving:             string | null
  onToggleRole:       (u: User) => void
  onAddCommittee:     (userId: string, c: CommitteeType, isChair: boolean) => void
  onRemoveCommittee:  (userId: string, c: CommitteeType) => void
  onToggleChair:      (userId: string, c: CommitteeType, current: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  function getRole(c: CommitteeType): CommitteeRole | undefined {
    return user.committeeRoles.find((r) => r.committee === c)
  }

  return (
    <div className="card overflow-hidden">
      {/* User row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Avatar user={user} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
              {user.name ?? "—"}
            </p>
            {/* Committee badges */}
            <div className="flex gap-1 flex-wrap">
              {user.committeeRoles.map(({ committee, isChair }) => (
                <span key={committee} className="relative">
                  <CommitteeBadge committee={committee} />
                  {isChair && (
                    <span
                      className="ml-0.5 text-caption"
                      style={{ color: "var(--color-ink-500)" }}
                      title="主席"
                    >★</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>{user.email}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-caption px-3 py-1.5 rounded-input border transition-colors"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
          >
            委員會 {expanded ? "▲" : "▼"}
          </button>
          <button
            onClick={() => onToggleRole(user)}
            disabled={saving === user.id}
            className="text-caption px-3 py-1.5 rounded-input border transition-colors"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}
          >
            {saving === user.id ? "…" : "降為學生"}
          </button>
        </div>
      </div>

      {/* Committee management panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2"
          style={{ borderTop: "1px solid var(--color-border)" }}>
          {COMMITTEES.map(({ value: c, label }) => {
            const role      = getRole(c)
            const isMember  = !!role
            const key       = `${user.id}-${c}`
            const isSaving  = saving === key

            return (
              <div key={c} className="rounded-input p-3 flex flex-col gap-2"
                style={{ background: isMember ? "var(--color-accent-soft)" : "var(--color-surface-2)" }}>
                <div className="flex items-center justify-between">
                  <CommitteeBadge committee={c} />
                  {isMember && (
                    <button
                      onClick={() => onRemoveCommittee(user.id, c)}
                      disabled={isSaving}
                      className="text-caption leading-none"
                      style={{ color: "var(--color-ink-300)" }}
                      title="移除"
                    >×</button>
                  )}
                </div>

                {isMember ? (
                  <button
                    onClick={() => onToggleChair(user.id, c, role.isChair)}
                    disabled={isSaving}
                    className="text-caption py-1 rounded text-left transition-colors"
                    style={{ color: role.isChair ? "var(--color-accent)" : "var(--color-ink-500)" }}
                  >
                    {role.isChair ? "★ 主席" : "一般成員"}
                  </button>
                ) : (
                  <button
                    onClick={() => onAddCommittee(user.id, c, false)}
                    disabled={isSaving}
                    className="text-caption py-1 rounded transition-colors"
                    style={{ color: "var(--color-ink-500)" }}
                  >
                    {isSaving ? "…" : "+ 加入"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
