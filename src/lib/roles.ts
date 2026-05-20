import type { Role } from "@prisma/client"

export function isTeacherOrAdmin(role: Role | undefined): boolean {
  return role === "TEACHER" || role === "ADMIN"
}

export function isAdmin(role: Role | undefined): boolean {
  return role === "ADMIN"
}
