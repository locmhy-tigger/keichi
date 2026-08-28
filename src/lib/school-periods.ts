// 預設節次時間 — transcribed from the school's printed timetable.
// Numbered lessons map onto AgentTimetable.period; named slots (早會/周會)
// carry a `label` that matches AgentTimetable.periodLabel instead.
export type PeriodSeed = {
  period: number | null
  label: string | null
  startTime: string
  endTime: string
}

export const DEFAULT_PERIODS: PeriodSeed[] = [
  { period: null, label: "早會", startTime: "08:00", endTime: "08:25" },
  { period: 1,  label: null, startTime: "08:25", endTime: "09:00" },
  { period: 2,  label: null, startTime: "09:00", endTime: "09:35" },
  { period: 3,  label: null, startTime: "09:50", endTime: "10:25" },
  { period: 4,  label: null, startTime: "10:25", endTime: "11:00" },
  { period: 5,  label: null, startTime: "11:15", endTime: "11:50" },
  { period: 6,  label: null, startTime: "11:50", endTime: "12:25" },
  { period: 7,  label: null, startTime: "13:35", endTime: "14:10" },
  { period: 8,  label: null, startTime: "14:10", endTime: "14:45" },
  { period: null, label: "周會", startTime: "14:10", endTime: "14:20" },
  { period: 9,  label: null, startTime: "14:50", endTime: "15:25" },
  { period: 10, label: null, startTime: "15:25", endTime: "16:00" },
]
