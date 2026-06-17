# Zeabur Deploy Guide — AI 大智若愚

## One-time Setup

### 1. Push repo to GitHub
```bash
git push origin main
```

### 2. Create Zeabur project
1. Go to [zeabur.com](https://zeabur.com) → New Project → select **HK-1** region
2. Add service → **Git** → select this repo
3. Add service → **PostgreSQL** (same project, same region)

### 3. Link database
In the Next.js service → Variables, add:
```
DATABASE_URL          # copy from PostgreSQL service → Connection → Internal URL
DATABASE_URL_UNPOOLED # copy from PostgreSQL service → Connection → Direct URL
```

### 4. Set all environment variables
Copy every line from `.env.example` and fill in real values in Zeabur → Variables:

| Variable | Where to get it |
|----------|----------------|
| `AUTH_SECRET` | Run `openssl rand -base64 32` |
| `AUTH_URL` | Your Zeabur domain, e.g. `https://keichi.zeabur.app` |
| `AUTH_GOOGLE_ID` | Google Cloud Console → Credentials → OAuth 2.0 |
| `AUTH_GOOGLE_SECRET` | Same as above |
| `PUSHER_APP_ID` | Pusher Dashboard → App Keys |
| `PUSHER_SECRET` | Pusher Dashboard → App Keys |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher Dashboard → App Keys |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `ap3` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |

### 5. Update Google OAuth redirect URI
In Google Cloud Console → Credentials → your OAuth client:
- Add Authorized redirect URI: `https://YOUR_APP.zeabur.app/api/auth/callback/google`

### 6. Run database migrations
After first deploy, open Zeabur → Service → Terminal (or use local with prod DATABASE_URL):
```bash
pnpm db:push
pnpm db:seed
```

> `db:push` applies schema changes.  
> `db:seed` creates demo accounts + default agent templates.

---

## Ongoing Deployments

Zeabur auto-deploys on every push to `main`.

After schema changes (new Prisma models), run:
```bash
pnpm db:push
```

---

## Demo Accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.hk` | `admin123` | Admin |
| `teacher@demo.hk` | `teacher123` | Teacher |
| `student@demo.hk` | `student123` | Student |

---

## Agent System Checklist

After deploy, an admin must:

1. **Upload timetable CSV** → `/teacher/admin/agents` → Timetable tab  
   (Required for Andy's scheduling tools to work)

2. **Review default templates** → `/teacher/admin/agents` → Templates tab  
   (14 default templates are seeded; customise as needed)

3. **Test Keida** → Click the Keida FAB (bottom-right) → send "你好"  
   Should return the greeting without calling the API

4. **Test agent team** → Ask "幫我出一份數學測驗" → should route to Ethan (A03)

---

## Environment — Local Dev

```bash
cp .env.example .env.local
# fill in values, then:
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```
