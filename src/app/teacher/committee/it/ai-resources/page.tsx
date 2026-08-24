"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  RESOURCE_CATEGORIES, CATEGORY_LABEL, CATEGORY_COLOR,
  youTubeId, youTubeThumb, hostOf, type ResourceCategory,
} from "@/lib/resource"

type Resource = {
  id:          string
  title:       string
  url:         string
  description: string | null
  category:    ResourceCategory
  tags:        string[]
  createdById: string | null
  createdAt:   string
  createdBy:   { id: string; name: string | null } | null
}

const emptyForm = () => ({
  title: "", url: "", description: "",
  category: "AI_TOOL" as ResourceCategory, tagsInput: "",
})

export default function AiResourcesPage() {
  const { data: session } = useSession()
  const userId  = (session?.user as { id?: string } | undefined)?.id
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN"

  const [items,   setItems]   = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [cat,     setCat]     = useState<ResourceCategory | "ALL">("ALL")
  const [search,  setSearch]  = useState("")

  const [editing, setEditing] = useState<Resource | "new" | null>(null)
  const [form,    setForm]    = useState(emptyForm())
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/teaching-resources")
      .then((r) => r.ok ? r.json() : { resources: [] })
      .then((d) => setItems(d.resources ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((r) => {
      const matchCat = cat === "ALL" || r.category === cat
      const matchQ = !q ||
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      return matchCat && matchQ
    })
  }, [items, cat, search])

  // Only the person who shared it (or an admin) may change it.
  const canManage = (r: Resource) => !!userId && (r.createdById === userId || isAdmin)

  function openAdd() { setErr(null); setForm(emptyForm()); setEditing("new") }
  function openEdit(r: Resource) {
    setErr(null)
    setForm({
      title: r.title, url: r.url, description: r.description ?? "",
      category: r.category, tagsInput: r.tags.join(", "),
    })
    setEditing(r)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    const body = {
      title:       form.title.trim(),
      url:         form.url.trim(),
      description: form.description.trim() || undefined,
      category:    form.category,
      tags:        form.tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
    }
    const isNew = editing === "new"
    const res = await fetch(isNew ? "/api/teaching-resources" : `/api/teaching-resources/${(editing as Resource).id}`, {
      method:  isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const saved: Resource = await res.json()
      setItems((prev) => isNew ? [saved, ...prev] : prev.map((r) => r.id === saved.id ? saved : r))
      setEditing(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setErr(d?.error ?? `儲存失敗 (${res.status})`)
    }
  }

  async function remove() {
    if (editing === "new" || !editing) return
    if (!confirm(`確定刪除「${editing.title}」？`)) return
    const res = await fetch(`/api/teaching-resources/${editing.id}`, { method: "DELETE" })
    if (res.ok) {
      setItems((prev) => prev.filter((r) => r.id !== (editing as Resource).id))
      setEditing(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setErr(d?.error ?? "刪除失敗")
    }
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher/committee/it" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 資訊科技</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">AI 教學資源</h1>
      </div>
      <p className="text-caption mb-5" style={{ color: "var(--color-ink-400)" }}>
        老師共享的教學資源庫：YouTube 影片、工具、文章等。任何老師都可以分享；只有分享者或管理員可以編輯及刪除。
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <button onClick={() => setCat("ALL")}
          className="px-3 py-1.5 text-caption font-medium rounded-pill border"
          style={{
            background:  cat === "ALL" ? "var(--color-ink-900)" : "var(--color-surface)",
            color:       cat === "ALL" ? "#fff" : "var(--color-ink-700)",
            borderColor: cat === "ALL" ? "transparent" : "var(--color-border)",
          }}>
          全部
        </button>
        {RESOURCE_CATEGORIES.map((c) => {
          const active = cat === c
          return (
            <button key={c} onClick={() => setCat(c)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium rounded-pill border"
              style={{
                background:  active ? CATEGORY_COLOR[c] : "var(--color-surface)",
                color:       active ? "#fff" : "var(--color-ink-700)",
                borderColor: active ? "transparent" : `${CATEGORY_COLOR[c]}40`,
              }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? "#fff" : CATEGORY_COLOR[c] }} />
              {CATEGORY_LABEL[c]}
            </button>
          )
        })}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋標題、說明或標籤…"
          className="ml-auto px-3 py-1.5 text-caption rounded-input border w-full sm:w-56"
          style={inputStyle} />
        <button onClick={openAdd}
          className="px-4 py-2 text-body font-medium rounded-input text-white shrink-0"
          style={{ background: "var(--color-it)" }}>
          ＋ 分享資源
        </button>
      </div>

      <p className="text-caption mb-3" style={{ color: "var(--color-ink-400)" }}>
        {filtered.length === items.length ? `共 ${items.length} 項資源` : `顯示 ${filtered.length} / ${items.length} 項`}
      </p>

      {loading ? (
        <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-h3 mb-1">🔎 {items.length === 0 ? "尚未有任何資源" : "沒有符合的資源"}</p>
          {items.length === 0 && (
            <button onClick={openAdd} className="mt-3 text-body font-medium" style={{ color: "var(--color-it)" }}>
              分享第一項資源 →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const yt = youTubeId(r.url)
            return (
              <div key={r.id} className="card overflow-hidden flex flex-col">
                {/* Video preview, or a coloured bar for plain links */}
                {yt ? (
                  playing === r.id ? (
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`}
                        title={r.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <button onClick={() => setPlaying(r.id)} className="relative block w-full" title="播放">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={youTubeThumb(yt)} alt="" className="w-full aspect-video object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
                          style={{ background: "rgba(0,0,0,0.6)" }}>▶</span>
                      </span>
                    </button>
                  )
                ) : (
                  <div className="h-1.5" style={{ background: CATEGORY_COLOR[r.category] }} />
                )}

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-pill text-white"
                      style={{ background: CATEGORY_COLOR[r.category] }}>
                      {CATEGORY_LABEL[r.category]}
                    </span>
                    {hostOf(r.url) && (
                      <span className="text-[11px]" style={{ color: "var(--color-ink-400)" }}>{hostOf(r.url)}</span>
                    )}
                  </div>

                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="text-h3 hover:underline" style={{ color: "var(--color-ink-900)" }}>
                    {r.title}
                  </a>

                  {r.description && (
                    <p className="text-caption line-clamp-3" style={{ color: "var(--color-ink-500)" }}>{r.description}</p>
                  )}

                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 text-[11px] rounded-pill"
                          style={{ background: "var(--color-surface-2)", color: "var(--color-ink-500)" }}>{t}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-3">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center px-3 py-1.5 text-caption font-medium rounded-input text-white"
                      style={{ background: "var(--color-it)" }}>
                      開啟連結 ↗
                    </a>
                    {canManage(r) && (
                      <button onClick={() => openEdit(r)} title="編輯"
                        className="px-2.5 py-1.5 text-caption rounded-input"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-700)" }}>✏️</button>
                    )}
                  </div>

                  <p className="text-[10px]" style={{ color: "var(--color-ink-300)" }}>
                    由 {r.createdBy?.name ?? "系統"} 分享 · {new Date(r.createdAt).toLocaleDateString("zh-HK")}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / edit */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <h2 className="text-h2">{editing === "new" ? "分享資源" : "編輯資源"}</h2>

            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>連結 *</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                required maxLength={2000} placeholder="https://www.youtube.com/watch?v=…"
                className={inputCls} style={inputStyle} />
              <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-400)" }}>
                YouTube 連結會自動顯示預覽及可直接播放。
              </p>
            </div>

            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>標題 *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                required maxLength={200} className={inputCls} style={inputStyle} />
            </div>

            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>分類</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ResourceCategory })}
                className={inputCls} style={inputStyle}>
                {RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>

            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>說明（選填）</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} maxLength={1000} className={inputCls}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>標籤（用逗號分隔）</label>
              <input value={form.tagsInput} onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                placeholder="ChatGPT, 課堂活動, 初中" className={inputCls} style={inputStyle} />
            </div>

            {err && <p className="text-caption" style={{ color: "var(--color-discipline)" }}>{err}</p>}

            <div className="flex items-center justify-between gap-3 pt-1">
              {editing !== "new" ? (
                <button type="button" onClick={remove}
                  className="px-3 py-2 text-caption font-medium rounded-input"
                  style={{ color: "var(--color-discipline)" }}>🗑️ 刪除</button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditing(null)}
                  className="px-4 py-2 text-body rounded-input" style={{ color: "var(--color-ink-500)" }}>取消</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-body font-medium rounded-input text-white"
                  style={{ background: "var(--color-it)", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "儲存中…" : "儲存"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
