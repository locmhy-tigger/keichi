"use client"

import { useEffect, useState } from "react"

// 搶答計分牌: big tallies with ＋／－, per group or per team you name.
//
// Scores live in localStorage keyed by `storageKey`, so a refresh or an
// accidental tab switch mid-lesson doesn't wipe the game. Turning tallies into
// 積點 belongs with the Phase 2 performance records, which can be undone —
// this board deliberately writes nothing to the database.

export type Team = { id: string; name: string; color?: string }

export function Scoreboard({
  teams: seeded,
  storageKey,
  big = false,
}: {
  /** Initial teams, e.g. the seating chart's groups. */
  teams: Team[]
  storageKey: string
  big?: boolean
}) {
  const [teams,  setTeams]  = useState<Team[]>(seeded)
  const [scores, setScores] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as { teams?: Team[]; scores?: Record<string, number> }
        if (saved.teams?.length) setTeams(saved.teams)
        if (saved.scores) setScores(saved.scores)
        return
      }
    } catch { /* ignore */ }
    setTeams(seeded)
    // Seeding only on first load / key change; later group edits shouldn't
    // reset a game in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ teams, scores })) } catch { /* ignore */ }
  }, [storageKey, teams, scores])

  const bump = (id: string, d: number) => setScores((s) => ({ ...s, [id]: (s[id] ?? 0) + d }))
  const addTeam = () => {
    const n = teams.length + 1
    setTeams((t) => [...t, { id: `t${Date.now()}`, name: `第${n}隊` }])
  }
  const rename = (id: string, name: string) => setTeams((t) => t.map((x) => x.id === id ? { ...x, name } : x))
  const remove = (id: string) => setTeams((t) => t.filter((x) => x.id !== id))

  const top = Math.max(0, ...teams.map((t) => scores[t.id] ?? 0))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={addTeam} className="px-3 py-1.5 text-caption rounded-input border"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>＋ 新增隊伍</button>
        <button onClick={() => setTeams(seeded)} disabled={seeded.length === 0}
          className="px-3 py-1.5 text-caption rounded-input border"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)", opacity: seeded.length ? 1 : 0.5 }}>
          用座位表分組
        </button>
        <button onClick={() => { if (confirm("確定清零所有分數？")) setScores({}) }}
          className="px-3 py-1.5 text-caption rounded-input border ml-auto"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-discipline)" }}>分數清零</button>
      </div>

      {teams.length === 0 ? (
        <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>
          未有隊伍。可以先在座位表分組，或按「新增隊伍」。
        </p>
      ) : (
        <div className={`grid gap-3 ${big ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-3"}`}>
          {teams.map((t) => {
            const v = scores[t.id] ?? 0
            const leading = v > 0 && v === top
            return (
              <div key={t.id} className="rounded-card p-3 text-center"
                style={{
                  background: t.color ? `#${t.color}` : "var(--color-surface)",
                  border: `2px solid ${leading ? "var(--color-accent)" : "var(--color-border)"}`,
                  color: "#1f2937",
                }}>
                <div className="flex items-center gap-1">
                  <input value={t.name} onChange={(e) => rename(t.id, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-center font-semibold outline-none"
                    style={{ fontSize: big ? 28 : 15 }} />
                  <button onClick={() => remove(t.id)} className="text-caption" style={{ color: "#6b7280" }} title="移除">✕</button>
                </div>
                <div className="font-bold tabular-nums leading-none my-2" style={{ fontSize: big ? 120 : 52 }}>
                  {v}{leading && <span style={{ fontSize: big ? 40 : 20 }}> 👑</span>}
                </div>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => bump(t.id, -1)} className="flex-1 rounded-input font-bold py-2"
                    style={{ background: "rgb(0 0 0 / 0.08)", fontSize: big ? 32 : 20 }}>－</button>
                  <button onClick={() => bump(t.id, 1)} className="flex-1 rounded-input font-bold py-2 text-white"
                    style={{ background: "var(--color-accent)", fontSize: big ? 32 : 20 }}>＋</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
