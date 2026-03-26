"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type ClassInfo = { id: string; name: string; classCode: string; _count: { enrollments: number } }
type LeaderboardEntry = { rank: number; user: { id: string; name: string; image: string | null }; totalPoints: number }
type PendingCount = { classId: string; count: number }

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [activeClass, setActiveClass] = useState<ClassInfo | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [pendingCounts, setPendingCounts] = useState<PendingCount[]>([])
  const [creating, setCreating] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [awardStudentId, setAwardStudentId] = useState("")
  const [awardAmount, setAwardAmount] = useState(10)
  const [awardNote, setAwardNote] = useState("")
  const [awarding, setAwarding] = useState(false)

  const fetchClasses = async () => {
    const res = await fetch("/api/classes")
    if (res.ok) {
      const data: ClassInfo[] = await res.json()
      setClasses(data)
      if (data.length > 0 && !activeClass) setActiveClass(data[0])
    }
  }

  useEffect(() => { fetchClasses() }, [])

  useEffect(() => {
    if (!activeClass) return
    fetch(`/api/classes/${activeClass.id}/points`)
      .then((r) => r.json())
      .then((data: LeaderboardEntry[]) => setLeaderboard(data.slice(0, 10)))
  }, [activeClass])

  const createClass = async () => {
    if (!newClassName.trim()) return
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClassName }),
    })
    if (res.ok) {
      setNewClassName("")
      setCreating(false)
      fetchClasses()
    }
  }

  const awardPoints = async () => {
    if (!activeClass || !awardStudentId) return
    setAwarding(true)
    await fetch(`/api/classes/${activeClass.id}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: awardStudentId,
        amount: awardAmount,
        reason: "TEACHER",
        note: awardNote,
      }),
    })
    setAwardStudentId("")
    setAwardNote("")
    setAwarding(false)
    // Refresh leaderboard
    fetch(`/api/classes/${activeClass.id}/points`)
      .then((r) => r.json())
      .then((data: LeaderboardEntry[]) => setLeaderboard(data.slice(0, 10)))
  }

  const totalPending = pendingCounts.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">老師總覽</h2>
        <button onClick={() => setCreating(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-sm">
          建立班級
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-2xl p-4 border shadow-sm mb-4">
          <input
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="班級名稱（如：4A ICT）"
            className="w-full border rounded-xl px-3 py-2 text-sm mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={createClass} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm">建立</button>
            <button onClick={() => setCreating(false)} className="flex-1 border py-2 rounded-xl text-sm">取消</button>
          </div>
        </div>
      )}

      {/* Class selector */}
      {classes.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setActiveClass(cls)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                activeClass?.id === cls.id ? "bg-green-600 text-white" : "bg-white text-gray-600 border"
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {activeClass && (
        <>
          {/* Class info */}
          <div className="bg-white rounded-2xl p-4 border shadow-sm mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{activeClass.name}</h3>
                <p className="text-sm text-gray-500">{activeClass._count.enrollments} 位學生</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-1">班級代碼</div>
                <div className="font-mono font-bold text-lg tracking-widest text-green-600">
                  {activeClass.classCode}
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Link
              href="/teacher/missions"
              className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3"
            >
              <span className="text-2xl">📋</span>
              <div>
                <div className="text-sm font-medium">任務管理</div>
                {totalPending > 0 && (
                  <div className="text-xs text-orange-600">{totalPending} 待審批</div>
                )}
              </div>
            </Link>
            <Link
              href="/teacher/points"
              className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3"
            >
              <span className="text-2xl">⭐</span>
              <div>
                <div className="text-sm font-medium">發放積點</div>
                <div className="text-xs text-gray-500">即時廣播</div>
              </div>
            </Link>
          </div>

          {/* Quick award */}
          <div className="bg-white rounded-2xl p-4 border shadow-sm mb-4">
            <h3 className="font-semibold text-sm mb-3">快速發點</h3>
            <select
              value={awardStudentId}
              onChange={(e) => setAwardStudentId(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm mb-2"
            >
              <option value="">選擇學生</option>
              {leaderboard.map((e) => (
                <option key={e.user.id} value={e.user.id}>{e.user.name}</option>
              ))}
            </select>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                value={awardAmount}
                onChange={(e) => setAwardAmount(Number(e.target.value))}
                min={1}
                max={200}
                className="w-20 border rounded-xl px-3 py-2 text-sm"
              />
              <input
                value={awardNote}
                onChange={(e) => setAwardNote(e.target.value)}
                placeholder="備注（可選）"
                className="flex-1 border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={awardPoints}
              disabled={!awardStudentId || awarding}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              發放積點
            </button>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <h3 className="font-semibold text-sm mb-3">積點排行榜 Top 10</h3>
            {leaderboard.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暫無積點記錄</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div key={entry.user.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      entry.rank === 1 ? "bg-yellow-400 text-white" :
                      entry.rank === 2 ? "bg-gray-300 text-gray-700" :
                      entry.rank === 3 ? "bg-orange-300 text-white" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {entry.rank}
                    </span>
                    <span className="flex-1 text-sm">{entry.user.name}</span>
                    <span className="font-bold text-sm text-green-600">{entry.totalPoints}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
