import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, canEditCommittee } from "@/lib/roles"

/**
 * 教師進修 is an 行政 module: a global admin or the 行政 chair may use it.
 * Returns the session when allowed, or null.
 */
export async function pdSession() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) return null
  const ok = await canEditCommittee(session.user.id, session.user.role, "ADMIN")
  return ok ? session : null
}
