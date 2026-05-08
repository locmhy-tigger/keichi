"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "next-auth/react"

type User = {
  name?: string | null
  email?: string | null
  image?: string | null
}

const MAIN_NAV = [
  { href: "/teacher",               label: "主頁",     icon: HomeIcon     },
  { href: "/teacher/todos",         label: "待辦事項", icon: CheckIcon    },
  { href: "/teacher/announcements", label: "公告",     icon: MegaphoneIcon},
  { href: "/teacher/missions",      label: "任務管理", icon: ClipboardIcon},
  { href: "/teacher/points",        label: "積點",     icon: StarIcon     },
]

const COMMITTEE_NAV = [
  { href: "/teacher/committee/admin",      label: "行政",     icon: BriefcaseIcon, color: "var(--color-admin)"      },
  { href: "/teacher/committee/discipline", label: "訓育",     icon: ShieldIcon,    color: "var(--color-discipline)" },
  { href: "/teacher/committee/it",         label: "資訊科技", icon: MonitorIcon,   color: "var(--color-it)"         },
  { href: "/teacher/committee/curriculum", label: "課程發展", icon: BookIcon,      color: "var(--color-curriculum)" },
]

const ADMIN_NAV = [
  { href: "/teacher/admin/users", label: "用戶管理", icon: UsersIcon },
]

export function TeacherSidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === "/teacher") return pathname === "/teacher"
    return pathname.startsWith(href)
  }

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const sidebarContent = (
    <aside
      className="flex flex-col h-full"
      style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex items-end gap-2">
        <span className="text-xl font-semibold tracking-tight" style={{ color: "var(--color-ink-900)" }}>
          基智若愚
        </span>
        <span className="text-xs font-semibold mb-0.5" style={{ color: "var(--color-accent)", letterSpacing: "0.08em" }}>
          ICHI
        </span>
      </div>

      {/* Main nav */}
      <nav className="px-3 flex-1 overflow-y-auto">
        <p className="px-3 mb-1 text-caption" style={{ color: "var(--color-ink-300)" }}>
          導覽 · MENU
        </p>
        <ul className="space-y-0.5">
          {MAIN_NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-item ${isActive(href) ? "active" : ""}`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Committees */}
        <p className="px-3 mt-5 mb-1 text-caption" style={{ color: "var(--color-ink-300)" }}>
          各組 · COMMITTEES
        </p>
        <ul className="space-y-0.5">
          {COMMITTEE_NAV.map(({ href, label, icon: Icon, color }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-item ${isActive(href) ? "active" : ""}`}
              >
                <Icon color={isActive(href) ? "var(--color-accent)" : color} />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Admin */}
        <p className="px-3 mt-5 mb-1 text-caption" style={{ color: "var(--color-ink-300)" }}>
          管理 · ADMIN
        </p>
        <ul className="space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-item ${isActive(href) ? "active" : ""}`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? ""}
            className="w-8 h-8 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium truncate" style={{ color: "var(--color-ink-900)" }}>
            {user.name ?? user.email ?? "老師"}
          </p>
          <p className="text-caption truncate" style={{ color: "var(--color-ink-500)" }}>
            登入身份
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="登出"
          className="shrink-0 p-1 rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
          style={{ color: "var(--color-ink-500)" }}
        >
          <LogOutIcon />
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — fixed */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-[220px] z-30">
        {sidebarContent}
      </div>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center px-4 gap-3"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-md"
          style={{ color: "var(--color-ink-700)" }}
          aria-label="開啟選單"
        >
          <MenuIcon />
        </button>
        <span className="font-semibold text-base" style={{ color: "var(--color-ink-900)" }}>
          基智若愚
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
          ICHI
        </span>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-[220px] h-full z-50">
            {sidebarContent}
          </div>
          {/* Close button in drawer */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 left-[228px] p-1.5 rounded-md bg-white z-50"
            aria-label="關閉選單"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </>
  )
}

/* ── Inline SVG icons (no external dependency) ── */

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function BriefcaseIcon({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function ShieldIcon({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function MonitorIcon({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function BookIcon({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
