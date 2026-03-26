"use client"

import { useEffect, useState } from "react"

type ClassInfo = { id: string; name: string }
type LeaderboardEntry = { rank: number; user: { id: string; name: string; image: string | null }; totalPoints: number }

export default function TeacherPointsPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [activeClass, setActiveClass] = useState<ClassInfo | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [amount, setAmount] = useState(10)
  const [note, setNote] = useState("")
  const [awarding, setAwarding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchLeaderboard = async (classId: string) => {
    const res = await fetch(`/api/classes/${classId}/points`)
    if (res.ok) setLeaderboard(await res.json())
  }

  useEffect(() => {
    fetch("/api/classes").then((r) => r.json()).then((data: ClassInfo[]) => {
      setClasses(data)
      if (data.length > 0) setActiveClass(data[0])
    })
  }, [])

  useEffect(() => {
    if (activeClass) fetchLeaderboard(activeClass.id)
  }, [activeClass])

  const award = async () => {
    if (!activeClass || !selectedUserId || amount < 1) return
    setAwarding(true)
    const res = await fetch(`/api/classes/${activeClass.id}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, amount, reason: "TEACHER", note }),
    })
    if (res.ok) {
      showToast(`成功發放 ${amount} 積點！`)
      setNote("")
      fetchLeaderboard(activeClass.id)
    }
    setAwarding(false)
  }

  const rankStyle = (rank: number) => {
    if (rank === 1) return "bg-yellow-400 text-white"
    if (rank === 2) return "bg-gray-300 text-gray-700"
    if (rank === 3) return "bg-orange-300 text-white"
    return "bg-gray-100 text-gray-500"
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}

      <h2 className="font-bold text-lg mb-4">積點管理</h2>

      {classes.length > 1 && (
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
          {/* Award widget */}
          <div className="bg-white rounded-2xl p-4 border shadow-sm mb-4">
            <h3 className="font-semibold text-sm mb-3">發放積點</h3>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm mb-2"
            >
              <option value="">選擇學生</option>
              {leaderboard.map((e) => (
                <option key={e.user.id} value={e.user.id}>
                  {e.user.name}（{e.totalPoints} 分）
                </option>
              ))}
            </select>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">積點數量</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={1}
                  max={200}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">備注</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="（可選）"
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={award}
              disabled={!selectedUserId || awarding}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              立即發放
            </button>
          </div>

          {/* Full leaderboard */}
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <h3 className="font-semibold text-sm mb-3">全班排行榜</h3>
            {leaderboard.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">暫無積點記錄</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.user.id}
                    className={`flex items-center gap-3 p-2 rounded-xl ${
                      selectedUserId === entry.user.id ? "bg-green-50" : ""
                    }`}
                    onClick={() => setSelectedUserId(entry.user.id)}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankStyle(entry.rank)}`}>
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
