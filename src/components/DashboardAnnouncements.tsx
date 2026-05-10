"use client"

import { useEffect, useState } from "react"

type Announcement = {
  id: string
  title: string
  body: string
  createdAt: string
}

export function DashboardAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/announcements").then(r => r.json()).then(data => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      // Filter for today's announcements
      const filtered = data.filter((a: any) => new Date(a.createdAt) >= today)
      setAnnouncements(filtered)
      setLoading(false)
    })
  }, [])

  if (loading || announcements.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">📢</span>
        <h3 className="font-semibold text-amber-900">今日公告</h3>
      </div>
      <div className="space-y-3">
        {announcements.map(ann => (
          <div key={ann.id} className="border-l-2 border-amber-300 pl-3">
            <h4 className="text-sm font-bold text-amber-900">{ann.title}</h4>
            <p className="text-xs text-amber-800 line-clamp-2">{ann.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
