# 基智若愚 ICHI — EduPortal Admin Platform
## Today's Build Summary (2026-05-08)

Branch: `claude/eduportal-admin-platform-r9iBw`

---

## Features Completed

### 1. Teacher Admin Portal — Sidebar & Layout
- New fixed left sidebar (`TeacherSidebar.tsx`, 220px desktop / hamburger drawer mobile)
- Navigation sections: 主頁, 待辦事項, 公告, 行事曆, 任務管理, 積點 · 各組 (4 committees) · 管理
- User footer with avatar, name, and sign-out button
- Teacher layout converted to Server Component with `md:ml-[220px]` main content offset

### 2. Logo Placeholder
- `public/logo-placeholder.svg` — neutral 64×64 rounded-rect SVG ("LOGO" label)
- Login card: 64×64 logo above the "基智若愚 ICHI" heading
- Sidebar desktop: 32×32 logo beside brand text
- Sidebar mobile top bar: 24×24 logo between hamburger and brand text
- **To swap in the real logo:** replace `dazhi/public/logo-placeholder.svg` (same filename keeps all three placements updated automatically)

### 3. Daily Bilingual Bible Quote on Dashboard
- `DashboardGreeting.tsx` — 15 positive-attitude Bible verses in Traditional Chinese + English, rotated by Hong Kong day-of-year
- Styled as an accent-coloured left-border card below the greeting line
- Deterministic (server-rendered, no client JS) — all teachers see the same verse each day
- Verses include: Philippians 4:13, Proverbs 3:5–6, Isaiah 40:31, John 14:27, Psalm 23:4, and 10 others

### 4. IT Committee Tools (all client-only, zero DB)
| Route | Tool |
|---|---|
| `/teacher/committee/it/qr-code` | QR Code 生成器 — live canvas via `qrcode` npm, PNG download, size picker |
| `/teacher/committee/it/timer` | 課堂計時器 — countdown, green→amber→red, Web Audio beep, fullscreen |
| `/teacher/committee/it/random-picker` | 隨機點名器 — spin animation, localStorage name persistence, exclude-picked toggle |
| `/teacher/committee/it/heic-convert` | HEIC → JPG 轉換器 — drag-drop batch, `heic2any` WebAssembly, thumbnail preview |

### 5. Discipline Committee — Behavior Record System (DB-backed)
- **Prisma model:** `BehaviorRecord` (id, date, className, studentName, type, description, action, resolved, authorId)
- **Enum:** `BehaviorType { MISCONDUCT MERIT }`
- **API:** `GET/POST /api/behavior-records` · `PATCH/DELETE /api/behavior-records/[id]`
- **Page:** `/teacher/committee/discipline/behavior` — filter by resolved/type/class, toggle resolved, delete

### 6. School-wide Calendar (DB-backed)
- **Prisma model:** `CalendarEvent` (id, title, startDate, endDate, allDay, description, committee, authorId)
- **API:** `GET/POST /api/calendar-events` · `PATCH/DELETE /api/calendar-events/[id]`
- **Page:** `/teacher/calendar` — 7×6 month grid, committee-colour coded dots, create/edit/delete modal, iCal `.ics` export
- **Dashboard MiniCalendar:** updated to accept `calendarEvents` prop and render committee-coloured dots alongside todo dots
- **Sidebar:** 行事曆 added to MAIN_NAV

### 7. Committee Tool Cards Wired Up
- `committee/[type]/page.tsx` — active tools wrapped in `<Link>`, inactive tools shown with `opacity-60 cursor-not-allowed`
- IT: QR Code, Timer, Random Picker, HEIC Convert all linked
- Discipline: Behavior Record linked

---

## Packages Added
```
qrcode          ^1.5.4   # QR Code canvas rendering
@types/qrcode   ^1.5.6   # TypeScript types for qrcode
heic2any        ^0.0.4   # Client-side HEIC→JPG via WebAssembly
```

---

## Files Created / Modified

| File | Action |
|---|---|
| `dazhi/public/logo-placeholder.svg` | Created |
| `dazhi/prisma/schema.prisma` | Added BehaviorRecord, CalendarEvent, BehaviorType enum, User relations |
| `dazhi/package.json` | Added qrcode, @types/qrcode, heic2any |
| `dazhi/src/app/(auth)/login/page.tsx` | Added logo image |
| `dazhi/src/components/teacher/TeacherSidebar.tsx` | Added logo images (desktop + mobile); added 行事曆 nav item |
| `dazhi/src/components/teacher/DashboardGreeting.tsx` | Added daily bilingual Bible quote card |
| `dazhi/src/components/teacher/MiniCalendar.tsx` | Added calendarEvents prop and committee-coloured dots |
| `dazhi/src/app/teacher/page.tsx` | Fetches current-month calendar events, passes to MiniCalendar |
| `dazhi/src/app/teacher/calendar/page.tsx` | Created — full calendar page |
| `dazhi/src/app/teacher/committee/[type]/page.tsx` | Wired tool hrefs, Link vs disabled div |
| `dazhi/src/app/teacher/committee/it/qr-code/page.tsx` | Created |
| `dazhi/src/app/teacher/committee/it/timer/page.tsx` | Created |
| `dazhi/src/app/teacher/committee/it/random-picker/page.tsx` | Created |
| `dazhi/src/app/teacher/committee/it/heic-convert/page.tsx` | Created; ESLint fixes applied |
| `dazhi/src/app/teacher/committee/discipline/behavior/page.tsx` | Created |
| `dazhi/src/app/api/behavior-records/route.ts` | Created |
| `dazhi/src/app/api/behavior-records/[id]/route.ts` | Created |
| `dazhi/src/app/api/calendar-events/route.ts` | Created |
| `dazhi/src/app/api/calendar-events/[id]/route.ts` | Created |

---

## ESLint Fix Applied
`heic-convert/page.tsx`:
- `catch {}` → `catch (_err) {}` (required binding in TS-ESLint strict mode)
- `key={i}` (array index) → `key={item.url}` (stable unique ObjectURL key)

---

## DB Migration Required on Deploy
```bash
pnpm exec prisma generate
pnpm exec prisma db push
```
Two new tables: `BehaviorRecord`, `CalendarEvent`

---

## To Replace the Logo
1. Place your logo file in `dazhi/public/` (e.g. `logo.png`)
2. In `login/page.tsx`, `TeacherSidebar.tsx` update `src="/logo-placeholder.svg"` → `src="/logo.png"`
   — or simply overwrite `logo-placeholder.svg` with your SVG to update all three locations at once.
