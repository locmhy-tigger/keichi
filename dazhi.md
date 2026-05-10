# 基智若愚 ICHI — Platform Reference

**AI 大智若愚**是一個香港中學課堂教學與行政管理一體化平台，結合學生學習遊戲化（衝關地圖、SM-2 閃卡、積點）與老師行政工具（委員會管理、活動指派、行為記錄、行事曆）。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 框架 | Next.js 14 App Router + TypeScript |
| 認證 | NextAuth.js v5 + Google OAuth + PrismaAdapter |
| 資料庫 | PostgreSQL + Prisma ORM |
| 即時通訊 | Pusher Channels (HK cluster ap3) |
| AI 引擎 | Anthropic Claude API (Sonnet 出題 / Haiku 評分) |
| 部署 | Zeabur (HK-1 區域) |
| 樣式 | Tailwind CSS v3 + oklch 色彩系統 |
| 驗證 | Zod |

---

## 資料庫 Schema

### 核心 Enum

```prisma
enum Role              { STUDENT  TEACHER }
enum MissionType       { VIDEO  FORM  AI_QUIZ  PROMPT }
enum MissionStatus     { DRAFT  PUBLISHED  ARCHIVED }
enum MissionDifficulty { BASIC  ADVANCED  CHALLENGE }
enum SubmissionStatus  { PENDING  APPROVED  REJECTED }
enum PointReason       { ATTENDANCE  MISSION  FLASHCARD  TEACHER }
enum CommitteeType     { ADMIN  DISCIPLINE  IT  CURRICULUM }
enum TodoStatus        { OPEN  IN_PROGRESS  DONE }
enum AnnouncementTarget { ALL  ADMIN  DISCIPLINE  IT  CURRICULUM }
enum BehaviorType      { MISCONDUCT  MERIT }
enum ToolType          { LINK  EMBED  HTML  GOOGLE_SHEET }
enum AttendanceStatus  { PENDING  CONFIRMED  ATTENDED  ABSENT }
```

### 主要 Model

| Model | 說明 |
|-------|------|
| `User` | 用戶（STUDENT / TEACHER），Google SSO |
| `Class` | 班級，有唯一 6 字 classCode |
| `ClassEnrollment` | 學生加入班級的關係表 |
| `Mission` | 任務（VIDEO/FORM/AI_QUIZ/PROMPT） |
| `MissionSubmission` | 學生任務提交，含 AI 評分 |
| `FlashcardDeck` | 閃卡牌組 |
| `Flashcard` | 單張閃卡（front/back） |
| `FlashcardReview` | SM-2 複習狀態（ease/interval/nextReviewAt） |
| `PointTransaction` | 積點流水帳（classId, amount, reason） |
| `Todo` | 待辦事項，多人指派（junction: TodoAssignee） |
| `TodoAssignee` | Todo ↔ User 多對多 |
| `Announcement` | 公告（target: ALL/committee） |
| `CommitteeRole` | 委員會職務（isChair） |
| `BehaviorRecord` | 行為記錄（MISCONDUCT/MERIT） |
| `CalendarEvent` | 行事曆事件（startDate/endDate, allDay） |
| `CommitteeTool` | 委員會 DB 工具（LINK/EMBED/HTML/GOOGLE_SHEET） |
| `Activity` | 活動（startTime/endTime/location） |
| `ActivityAssignment` | 活動指派（status: AttendanceStatus） |

---

## API 路由一覽

### 認證
| Method | Route | 說明 |
|--------|-------|------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |
| POST | `/api/pusher/auth` | Pusher 私人頻道驗證 |

### 班級管理
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/classes` | 老師：自己的班；學生：加入的班 |
| POST | `/api/classes` | 老師建立班級，回傳含 classCode |
| GET | `/api/classes/[classId]` | 班級詳情 |
| POST | `/api/classes/join` | 學生用 classCode 加入班級 |
| GET | `/api/classes/[classId]/missions` | 任務列表（老師全部/學生只看 PUBLISHED） |
| POST | `/api/classes/[classId]/missions` | 老師建立任務 |
| GET | `/api/classes/[classId]/points` | 積點排行榜 |
| POST | `/api/classes/[classId]/points` | 發積點（老師任意/學生只限 FLASHCARD/ATTENDANCE） |

### 任務
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/missions/[missionId]` | 任務詳情 |
| PATCH | `/api/missions/[missionId]` | 更新任務（老師） |
| GET | `/api/missions/[missionId]/submissions` | 提交列表（老師，PENDING 優先） |
| POST | `/api/missions/[missionId]/submit` | 學生提交（AI 自動評分 PROMPT 類型） |
| PATCH | `/api/submissions/[subId]/review` | 批核（APPROVED/REJECTED + 積點廣播） |

### 閃卡
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/flashcard-decks` | 我的牌組 |
| POST | `/api/flashcard-decks` | 建立牌組 |
| GET | `/api/flashcard-decks/[deckId]/cards` | 牌組內所有卡片 |
| POST | `/api/flashcard-decks/[deckId]/cards` | 新增卡片 |
| GET | `/api/flashcard-decks/[deckId]/due` | 今日待複習卡片（SM-2） |
| POST | `/api/flashcard-decks/[deckId]/review` | 提交複習評分（更新 SM-2 狀態） |

### AI
| Method | Route | 說明 |
|--------|-------|------|
| POST | `/api/ai/generate-quiz` | Claude Sonnet 根據教材出題 |
| POST | `/api/ai/evaluate-prompt` | Claude Haiku 評分學生 Prompt |

### 待辦事項（多人指派）
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/todos` | `?committee=&status=&view=assigned` |
| POST | `/api/todos` | 建立（`assigneeIds: string[]`） |
| GET | `/api/todos/[id]` | 單項 |
| PATCH | `/api/todos/[id]` | 更新（含 `assigneeIds` 替換） |
| DELETE | `/api/todos/[id]` | 刪除（owner only） |

### 公告
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/announcements` | pinned 優先，`?target=` 過濾 |
| POST | `/api/announcements` | 建立 |
| PATCH | `/api/announcements/[id]` | 更新（owner only） |
| DELETE | `/api/announcements/[id]` | 刪除（owner only） |

### 用戶管理（管理員）
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/admin/users` | 所有用戶含委員會職務 |
| PATCH | `/api/admin/users` | 批量更新角色 |
| PATCH | `/api/admin/users/[id]` | 更新個別用戶 |
| POST | `/api/admin/committee-roles` | 加入委員會 |
| DELETE | `/api/admin/committee-roles` | 移除委員會（`?userId=&committee=`） |
| GET | `/api/admin/users/export` | 下載 CSV |
| POST | `/api/admin/users/import` | 匯入 CSV（multipart/form-data） |

### 行為記錄
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/behavior-records` | `?resolved=&className=&type=` |
| POST | `/api/behavior-records` | 建立記錄 |
| PATCH | `/api/behavior-records/[id]` | 更新（含 resolved） |
| DELETE | `/api/behavior-records/[id]` | 刪除（owner only） |

### 行事曆
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/calendar-events` | `?month=YYYY-MM` |
| POST | `/api/calendar-events` | 建立活動 |
| PATCH | `/api/calendar-events/[id]` | 更新 |
| DELETE | `/api/calendar-events/[id]` | 刪除（owner only） |

### 委員會工具
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/committee-tools` | `?committee=IT`（active 過濾） |
| POST | `/api/committee-tools` | 建立（委員會成員或 ADMIN） |
| GET | `/api/committee-tools/[id]` | 單工具 |
| PATCH | `/api/committee-tools/[id]` | 更新（同上權限） |
| DELETE | `/api/committee-tools/[id]` | 刪除 |

### 活動管理
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/activities` | 老師：自己建立的；學生：被指派的 |
| POST | `/api/activities` | 老師建立活動 |
| GET | `/api/activities/[id]` | 詳情（老師含全部指派；學生只看自己） |
| PATCH | `/api/activities/[id]` | 更新（creator only） |
| DELETE | `/api/activities/[id]` | 刪除（creator only） |
| POST | `/api/activities/[id]/assign` | 指派學生（自動衝突偵測） |
| PATCH | `/api/activities/[id]/assignments/[studentId]` | 更新出席狀態 |
| POST | `/api/activities/[id]/alert` | Pusher 推送提醒給 PENDING 學生 |

### 用戶搜尋
| Method | Route | 說明 |
|--------|-------|------|
| GET | `/api/users` | `?q=姓名`（debounced 搜尋，多選指派用） |

---

## 頁面結構

### 老師端 (`/teacher/...`)

| 路由 | 說明 |
|------|------|
| `/teacher` | Dashboard（greeting, todo preview, MiniCalendar, committee grid） |
| `/teacher/todos` | 待辦事項（多人指派，chip select 搜尋） |
| `/teacher/announcements` | 公告管理 |
| `/teacher/calendar` | 行事曆（月視圖，iCal 匯入/匯出） |
| `/teacher/activities` | 活動管理列表 |
| `/teacher/activities/[id]` | 活動詳情（指派學生，衝突警告，出席狀態，Pusher 提醒） |
| `/teacher/missions` | 任務管理 |
| `/teacher/missions/new` | 新增任務（Step 1/2/3） |
| `/teacher/missions/[id]` | 任務詳情 |
| `/teacher/missions/[id]/submissions` | 批核頁（PENDING 優先，AI 評分） |
| `/teacher/points` | 積點與排行榜 |
| `/teacher/admin/users` | 用戶管理（CSV 匯入/匯出） |
| `/teacher/committee/[type]` | 委員會主頁（DB 工具 + 預設工具） |
| `/teacher/committee/[type]/tools/[toolId]` | 委員會工具查看器（LINK/EMBED/HTML/GOOGLE_SHEET） |
| `/teacher/committee/it/qr-code` | QR Code 生成器 |
| `/teacher/committee/it/timer` | 課堂計時器 |
| `/teacher/committee/it/random-picker` | 隨機點名器（localStorage 名單） |
| `/teacher/committee/it/heic-convert` | HEIC→JPG 轉換器 |
| `/teacher/committee/discipline/behavior` | 行為記錄系統 |

### 學生端 (`/student/...`)

| 路由 | 說明 |
|------|------|
| `/student` | Dashboard（積點/排名/待複習，即將到來的活動，Pusher 通知） |
| `/student/activities` | 我的活動（PENDING/CONFIRMED/過去 分頁） |
| `/student/calendar` | 活動行事曆（月視圖，只讀） |
| `/student/missions` | 衝關地圖（節點狀態：LOCKED/AVAILABLE/PENDING/DONE） |
| `/student/flashcards` | 閃卡牌組管理 |
| `/student/flashcards/[deckId]` | 牌組詳情 |
| `/student/flashcards/[deckId]/review` | 複習 Session（SM-2，翻轉動畫，四評分） |

---

## 組件一覽

### 老師端
| 組件 | 說明 |
|------|------|
| `TeacherSidebar` | 固定左側導覽（220px 桌面 / 抽屜手機），含活動管理 |
| `DashboardGreeting` | 時段問候 + 緊急 todo 數量 |
| `TodoPreview` | Dashboard todo 預覽列表 |
| `MiniCalendar` | 迷你月曆（todo/事件點） |
| `CommitteeToolsGrid` | 4 委員會快捷卡片 |
| `CommitteeBadge` | 委員會顏色標籤 |
| `CommitteeToolsManager` | DB 工具管理（新增/編輯/刪除，iframe 預覽） |

### 學生端
| 組件 | 說明 |
|------|------|
| `StudentSidebar` | 固定左側導覽（同 TeacherSidebar 設計） |

---

## Phase 2 新功能摘要

### CSV 用戶管理
- 格式：`email,name,role,committees,chairOf`（committees 以 `|` 分隔）
- 下載：`GET /api/admin/users/export` → `users.csv`
- 匯入：`POST /api/admin/users/import` → multipart，upsert by email，回傳 `{ created, updated, errors[] }`
- UI：用戶管理頁加入「下載 CSV」和「匯入 CSV」按鈕，顯示匯入結果卡

### 多人指派待辦事項
- Schema：`TodoAssignee` junction table 取代 `assigneeId`
- API：`assigneeIds: string[]`，PATCH 時先 `deleteMany` 再重建
- UI：debounced chip multi-select（搜尋 `/api/users?q=`），最多 3 chip + "+N" overflow
- 「分配給我」分頁：`assignees: { some: { userId } }`

### iCal 行事曆匯入
- 頁面：`/teacher/calendar`，「匯入 .ics」按鈕
- 純前端解析 RFC 5545（無第三方庫），支援 `VALUE=DATE` 和 datetime 格式
- 逐事件 POST 至 `/api/calendar-events`，顯示「匯入完成：X 個活動已新增」

### DB 委員會工具
- 類型：LINK（內部跳轉）/ EMBED（iframe URL）/ HTML（srcdoc iframe）/ GOOGLE_SHEET（自動 /edit→/pubhtml）
- 權限：委員會成員 OR ADMIN 委員會成員可增刪改
- 工具查看器：`/teacher/committee/[type]/tools/[toolId]`

### 學生側邊欄
- `StudentSidebar` 取代舊版底部導覽
- 含：主頁、我的活動、行事曆、任務、閃卡、積點

### 活動管理系統
- 老師建立活動 → 搜尋並指派學生 → 自動衝突偵測（重疊時間段警告）
- 出席狀態追蹤：PENDING/CONFIRMED/ATTENDED/ABSENT
- Pusher 提醒：`private-user-{studentId}` 頻道 `activity-alert` 事件
- 學生頁：活動列表（分頁過濾）+ 月曆視圖（只讀）
- 學生 Dashboard：「即將到來的活動」widget + Pusher toast 通知

---

## Pusher 事件

| 頻道 | 事件 | 觸發者 | 接收者 |
|------|------|--------|--------|
| `class-{classId}` | `points-awarded` | 積點 API | 全班學生 |
| `class-{classId}` | `mission-approved` | 批核 API | 全班學生 |
| `class-{classId}` | `new-mission` | 任務發佈 | 全班學生 |
| `private-user-{userId}` | `activity-alert` | 老師點「發送提醒」 | 指定學生 |

---

## 設計系統

### 色彩（oklch CSS vars）
| CSS 變數 | 用途 |
|----------|------|
| `--color-bg-base` | 頁面底色（近白） |
| `--color-surface` | 卡片/側邊欄底色 |
| `--color-surface-2` | 輸入框/hover 底色 |
| `--color-border` | 邊框 |
| `--color-ink-900/700/500/400/300` | 文字階層 |
| `--color-accent` | 品牌藍紫 |
| `--color-accent-soft` | accent 淡底 |
| `--color-admin` | 行政（暖啡） |
| `--color-discipline` | 訓育（紅） |
| `--color-it` | 資訊科技（青藍） |
| `--color-curriculum` | 課程發展（森綠） |

### 排版類名
| 類名 | 大小/行高 |
|------|-----------|
| `text-h1` | 30/38 |
| `text-h2` | 22/30 |
| `text-h3` | 17/26 |
| `text-body` | 14/22 |
| `text-caption` | 11/16 |

### 布局
- 老師/學生側邊欄：固定 `w-[220px]`，main 用 `md:ml-[220px]` 偏移
- `.card`：`background surface`, `border`, `rounded-card`, `shadow-card`
- `.nav-item` / `.nav-item.active`：側邊欄連結狀態

---

## 環境變數

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="ap3"
ANTHROPIC_API_KEY="sk-ant-..."
NEXT_PUBLIC_APP_URL="https://..."
```

---

## 資料庫遷移

每次 schema 變更後執行：

```bash
cd dazhi
pnpm exec prisma generate
pnpm exec prisma db push
```

生產環境用 `prisma migrate deploy`（需要 migration 歷史）。

---

## 完整文件結構

```
dazhi/
├── prisma/schema.prisma
├── src/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── prisma.ts
│   │   ├── pusher.ts
│   │   ├── pusher-client.ts
│   │   ├── claude.ts
│   │   ├── sm2.ts
│   │   └── class-code.ts
│   ├── types/
│   │   ├── mission.ts
│   │   └── next-auth.d.ts
│   ├── components/
│   │   ├── teacher/
│   │   │   ├── TeacherSidebar.tsx
│   │   │   ├── DashboardGreeting.tsx
│   │   │   ├── TodoPreview.tsx
│   │   │   ├── MiniCalendar.tsx
│   │   │   ├── CommitteeToolsGrid.tsx
│   │   │   ├── CommitteeBadge.tsx
│   │   │   └── CommitteeToolsManager.tsx
│   │   └── student/
│   │       └── StudentSidebar.tsx
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── (auth)/login/page.tsx
│       ├── api/
│       │   ├── auth/[...nextauth]/route.ts
│       │   ├── pusher/auth/route.ts
│       │   ├── classes/route.ts + join/route.ts + [classId]/{route,missions,points}.ts
│       │   ├── missions/[missionId]/{route,submit,submissions}.ts
│       │   ├── submissions/[subId]/review/route.ts
│       │   ├── flashcard-decks/{route,[deckId]/{cards,due,review}}.ts
│       │   ├── ai/{generate-quiz,evaluate-prompt}/route.ts
│       │   ├── todos/{route,[id]/route}.ts
│       │   ├── announcements/{route,[id]/route}.ts
│       │   ├── users/route.ts
│       │   ├── admin/users/{route,[id]/route,export/route,import/route}.ts
│       │   ├── admin/committee-roles/route.ts
│       │   ├── behavior-records/{route,[id]/route}.ts
│       │   ├── calendar-events/{route,[id]/route}.ts
│       │   ├── committee-tools/{route,[id]/route}.ts
│       │   └── activities/{route,[id]/{route,assign,assignments/[studentId],alert}}.ts
│       ├── teacher/
│       │   ├── layout.tsx + page.tsx
│       │   ├── todos/page.tsx
│       │   ├── announcements/page.tsx
│       │   ├── calendar/page.tsx
│       │   ├── activities/{page,[id]/page}.tsx
│       │   ├── missions/{page,new/page,[missionId]/{page,submissions/page}}.tsx
│       │   ├── points/page.tsx
│       │   ├── admin/users/page.tsx
│       │   └── committee/
│       │       ├── [type]/{page,tools/[toolId]/page}.tsx
│       │       ├── it/{qr-code,timer,random-picker,heic-convert}/page.tsx
│       │       └── discipline/behavior/page.tsx
│       └── student/
│           ├── layout.tsx + page.tsx
│           ├── activities/page.tsx
│           ├── calendar/page.tsx
│           ├── missions/page.tsx
│           └── flashcards/{page,[deckId]/{page,review/page}}.tsx
```

---

## 驗證清單

- [ ] `pnpm exec tsc --noEmit` — 零錯誤
- [ ] `pnpm build` — 成功
- [ ] 老師 Google 登入 → `/teacher` Dashboard，側邊欄含「活動管理」
- [ ] 學生 Google 登入 → `/student` Dashboard，StudentSidebar 顯示
- [ ] 老師建立活動 → 搜尋學生 → 衝突偵測 → 指派 → 出席狀態更新
- [ ] 老師點「發送提醒」→ 學生 Dashboard 收到 Pusher toast
- [ ] 學生活動列表分頁過濾、月曆視圖顯示活動點
- [ ] 老師建立 Todo → 多人 chip 指派 → 「分配給我」分頁
- [ ] 用戶管理 CSV 下載 → 修改 → 重新匯入 → 顯示更新數
- [ ] IT 委員會工具：QR Code / 計時器 / 隨機點名器 / HEIC 轉換
- [ ] 行事曆：建立事件 / iCal 匯入 / iCal 匯出
- [ ] 行為記錄：新增 / 過濾 / 標記已解決
- [ ] 委員會 DB 工具：新增 EMBED 類型 → iframe 顯示

---

*版本：Phase 2 完成 | 日期：2026-05-09 | Next.js 14 · PostgreSQL · Claude API · Pusher · Zeabur*
