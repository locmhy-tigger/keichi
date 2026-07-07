import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notify"
import type { BehaviorType } from "@prisma/client"

// ─── Category metadata (single source of truth) ──────────────────────────────

export const BEHAVIOR_LABEL: Record<BehaviorType, string> = {
  MERIT:       "優點",
  DEMERIT:     "缺點",
  MINOR_FAULT: "小過",
  MAJOR_FAULT: "大過",
  LATE:        "遲到",
  ABSENT:      "缺席",
  MISCONDUCT:  "違規",
}

// Ordered list used for dashboards / selects (legacy MISCONDUCT last).
export const BEHAVIOR_ORDER: BehaviorType[] = [
  "MERIT", "DEMERIT", "MINOR_FAULT", "MAJOR_FAULT", "LATE", "ABSENT",
]

// Everything except a merit is a negative record (drives notify + thresholds).
export function isNegative(type: BehaviorType): boolean {
  return type !== "MERIT"
}

/** Normalize a class name for grouping / homeroom lookup. */
export function classKey(className: string): string {
  return className.trim().toUpperCase().replace(/\s+/g, "")
}

/** Map a Chinese category label (CSV import) to the enum. */
export function labelToType(label: string): BehaviorType | null {
  const t = label.trim()
  const map: Record<string, BehaviorType> = {
    "優點": "MERIT", "缺點": "DEMERIT", "小過": "MINOR_FAULT",
    "大過": "MAJOR_FAULT", "遲到": "LATE", "缺席": "ABSENT", "違規": "MISCONDUCT",
  }
  return map[t] ?? null
}

// ─── Homeroom lookup ─────────────────────────────────────────────────────────

export async function findHomeroom(className: string) {
  const key = classKey(className)
  // Try exact className first, then normalized-key match across rows.
  const exact = await prisma.homeroomClass.findUnique({ where: { className } })
  if (exact) return exact
  const all = await prisma.homeroomClass.findMany()
  return all.find((h) => classKey(h.className) === key) ?? null
}

// ─── Threshold auto-email ────────────────────────────────────────────────────

/**
 * After a negative record is added, check whether the student has reached the
 * configured threshold for that category and, if so, email the class teacher
 * exactly once per crossing (deduped via DisciplineAlertLog).
 */
export async function checkThresholdAndEmail(
  className: string,
  studentName: string,
  category: BehaviorType
): Promise<void> {
  try {
    if (!isNegative(category)) return

    const setting = await prisma.disciplineThreshold.findUnique({ where: { category } })
    if (!setting || !setting.enabled) return

    const count = await prisma.behaviorRecord.count({
      where: { className, studentName, type: category },
    })
    if (count < setting.threshold) return

    // Already alerted at/above this threshold?
    const existing = await prisma.disciplineAlertLog.findUnique({
      where: { className_studentName_category: { className, studentName, category } },
    })
    if (existing && existing.notifiedCount >= setting.threshold) return

    const homeroom = await findHomeroom(className)
    const label = BEHAVIOR_LABEL[category]

    // Record the alert first (so concurrent inserts don't double-send).
    await prisma.disciplineAlertLog.upsert({
      where:  { className_studentName_category: { className, studentName, category } },
      create: { className, studentName, category, notifiedCount: count },
      update: { notifiedCount: count, sentAt: new Date() },
    })

    if (homeroom?.teacherEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
      await sendEmail({
        to:      homeroom.teacherEmail,
        subject: `【訓育提示】${className} ${studentName} — ${label}已達 ${count} 次`,
        html: `
          <div style="font-family:sans-serif;line-height:1.6">
            <p>${homeroom.teacherName} 老師：</p>
            <p>貴班學生 <strong>${studentName}</strong>（${className}）的「<strong>${label}</strong>」紀錄已達 <strong>${count}</strong> 次，達到訓育組設定的提示門檻（${setting.threshold} 次），敬請跟進。</p>
            <p>請登入系統查看詳細紀錄：<a href="${appUrl}/teacher/committee/discipline/dashboard">訓育行為儀表板</a></p>
            <p style="color:#888;font-size:12px">此電郵由基智中學校務系統自動發送。</p>
          </div>`,
        text: `${homeroom.teacherName} 老師：\n貴班學生 ${studentName}（${className}）的「${label}」紀錄已達 ${count} 次，達到提示門檻（${setting.threshold} 次），敬請跟進。\n${appUrl}/teacher/committee/discipline/dashboard`,
      })
    }

    // In-app notify if the class teacher is a system user.
    if (homeroom?.teacherUserId) {
      await notify({
        userId: homeroom.teacherUserId,
        type:   "BEHAVIOR",
        title:  `訓育提示：${className} ${studentName}`,
        body:   `「${label}」已達 ${count} 次（門檻 ${setting.threshold}）`,
        link:   "/teacher/committee/discipline/dashboard",
      })
    }
  } catch (err) {
    console.error("checkThresholdAndEmail failed:", err)
  }
}
