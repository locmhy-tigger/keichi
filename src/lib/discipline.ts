import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notify"
import { BEHAVIOR_LABEL, BEHAVIOR_ORDER, isNegativeType } from "@/lib/behavior-types"
import type { BehaviorType } from "@prisma/client"

// Re-export shared constants so existing importers keep working.
export { BEHAVIOR_LABEL, BEHAVIOR_ORDER }

// Everything except a merit is a negative record (drives notify + thresholds).
export function isNegative(type: BehaviorType): boolean {
  return isNegativeType(type)
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

// ─── Class-level alert ───────────────────────────────────────────────────────

const CLASS_ALERT_THRESHOLD_KEY = "classAlertThreshold"
const CLASS_ALERT_ENABLED_KEY   = "classAlertEnabled"

export async function getClassAlertSetting(): Promise<{ threshold: number; enabled: boolean }> {
  const rows = await prisma.schoolSetting.findMany({
    where: { key: { in: [CLASS_ALERT_THRESHOLD_KEY, CLASS_ALERT_ENABLED_KEY] } },
  })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    threshold: Number(map.get(CLASS_ALERT_THRESHOLD_KEY) ?? 20),
    enabled:   map.get(CLASS_ALERT_ENABLED_KEY) === "true",
  }
}

export async function setClassAlertSetting(threshold: number, enabled: boolean): Promise<void> {
  await prisma.$transaction([
    prisma.schoolSetting.upsert({
      where: { key: CLASS_ALERT_THRESHOLD_KEY },
      create: { key: CLASS_ALERT_THRESHOLD_KEY, value: String(threshold) },
      update: { value: String(threshold) },
    }),
    prisma.schoolSetting.upsert({
      where: { key: CLASS_ALERT_ENABLED_KEY },
      create: { key: CLASS_ALERT_ENABLED_KEY, value: String(enabled) },
      update: { value: String(enabled) },
    }),
  ])
}

/** Count a class's negative (non-merit) behavior records. */
export function negativeCountWhere(className: string) {
  return { className, type: { not: "MERIT" as BehaviorType } }
}

/**
 * After negative records are added for a class, email the 班主任 once when the
 * class's total misbehaviour count crosses the configured class threshold.
 */
export async function checkClassAlert(className: string): Promise<void> {
  try {
    const { threshold, enabled } = await getClassAlertSetting()
    if (!enabled) return

    const count = await prisma.behaviorRecord.count({ where: negativeCountWhere(className) })
    if (count < threshold) return

    const existing = await prisma.disciplineClassAlertLog.findUnique({ where: { className } })
    if (existing && existing.notifiedCount >= threshold) return

    await prisma.disciplineClassAlertLog.upsert({
      where:  { className },
      create: { className, notifiedCount: count },
      update: { notifiedCount: count, sentAt: new Date() },
    })

    const homeroom = await findHomeroom(className)
    if (homeroom?.teacherEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
      await sendEmail({
        to:      homeroom.teacherEmail,
        subject: `【訓育班級警示】${className} 違規紀錄已達 ${count} 宗`,
        html: `
          <div style="font-family:sans-serif;line-height:1.6">
            <p>${homeroom.teacherName} 老師：</p>
            <p>貴班（<strong>${className}</strong>）的違規類紀錄總數已達 <strong>${count}</strong> 宗，達到訓育組設定的班級警示門檻（${threshold} 宗），敬請留意班級紀律情況並跟進。</p>
            <p><a href="${appUrl}/teacher/committee/discipline/dashboard">開啟訓育行為儀表板</a></p>
            <p style="color:#888;font-size:12px">此電郵由基智中學校務系統自動發送。</p>
          </div>`,
        text: `${homeroom.teacherName} 老師：\n貴班（${className}）的違規類紀錄總數已達 ${count} 宗，達到班級警示門檻（${threshold} 宗），敬請跟進。\n${appUrl}/teacher/committee/discipline/dashboard`,
      })
    }
    if (homeroom?.teacherUserId) {
      await notify({
        userId: homeroom.teacherUserId,
        type:   "BEHAVIOR",
        title:  `班級警示：${className}`,
        body:   `違規紀錄已達 ${count} 宗（門檻 ${threshold}）`,
        link:   "/teacher/committee/discipline/dashboard",
      })
    }
  } catch (err) {
    console.error("checkClassAlert failed:", err)
  }
}
