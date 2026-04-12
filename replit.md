# E-Absensi — School Attendance System

## Overview
A school attendance management system built with React + TypeScript + Vite, using a local Replit PostgreSQL database with an Express + Drizzle ORM backend.

## Architecture
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js + Drizzle ORM + local Replit PostgreSQL
- **Auth**: Session-based auth with bcryptjs + express-session + connect-pg-simple
- **Routing**: React Router v6 (BrowserRouter)
- **Data fetching**: TanStack React Query v5
- **State**: React context (AuthProvider via `src/hooks/useAuth.tsx`)
- **Realtime**: Polling-based (TanStack Query cache invalidation) via `useRealtimeSubscription` no-op hook

## Key Files
- `shared/schema.ts` — Drizzle table definitions, enums, insert schemas, select types
- `server/db.ts` — pg Pool + Drizzle ORM instance (uses `DATABASE_URL`)
- `server/storage.ts` — IStorage-style storage object with all CRUD operations
- `server/routes.ts` — All API routes + requireAuth middleware
- `server/index.ts` — Express app, session middleware, Vite middleware (dev), seeding
- `src/lib/queryClient.ts` — TanStack Query client + `apiRequest` helper (all use `credentials: "include"`)
- `src/hooks/useAuth.tsx` — Session-based auth context (login/logout via `/api/auth/*`)

## Database Tables
- `profiles` — users (id, username, password_hash, name)
- `user_roles` — role assignments (user_id, role: "admin"|"guru")
- `classes` — school classes (id, name)
- `students` — students (id, name, nis, gender, class_id)
- `attendance_records` — daily attendance (student_id, class_id, date, status, validation_status, etc.)
- `attendance_settings` — per-day schedule (day_of_week, check_in_start/end, check_out_start/end, enabled)
- `holidays` — holiday date ranges (name, start_date, end_date)
- `guru_piket_assignments` — duty schedule (user_id, day_of_week)
- `web_config` — app appearance config (app_title, app_subtitle, logo_url, bg_url_1-4)

## API Routes
- `POST /api/auth/login` — login (creates session)
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — current session user
- `GET /api/web-config` — public (no auth needed)
- `GET/POST/PATCH/DELETE /api/classes` — class CRUD
- `GET/POST/PATCH/DELETE /api/students` — student CRUD + `/api/students/by-class/:classId` for batch delete
- `GET/POST/PATCH/DELETE /api/attendance` — attendance CRUD
- `GET/PATCH /api/attendance-settings` — schedule settings
- `GET/POST/DELETE /api/holidays` — holiday management
- `GET/POST/DELETE /api/guru-piket` — duty assignments
- `GET/POST/PATCH/DELETE /api/users` — user management (admin only)
- `GET /api/profiles` — all profiles
- `GET /api/dashboard/student-count`, `/api/dashboard/stats`, `/api/dashboard/yearly` — dashboard data

## Key Features
- Public attendance submission form (izin/sakit) — no login required
- Admin/teacher login with session-based auth (username + password)
- Role-based access: `admin` and `guru` roles
- Class and student management (single + batch)
- QR code scan for attendance check-in/check-out (buffered, then submitted)
- Attendance validation workflow (approve/reject izin/sakit)
- Monthly recap with proper Excel (.xlsx via ExcelJS server-side), PDF, and Word export; Excel matches school presensi sheet format (per-class, with NIS/gender/date columns, KET, totals, signature area)
- Google Drive link converter for logo/background images
- Configurable web appearance
- **Google Drive Backup** (admin only):
  - OAuth2 flow: `/api/auth/google` → callback → stores refresh token in `web_config`
  - Per-month PDF backup in Rekap Bulanan (export dropdown, admin only)
  - Full data backup JSON in Kelola & Reset Data (before reset)
  - Google Drive folder ID configurable in Konfigurasi WebApps
  - Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars

## Default Credentials (auto-seeded)
- Username: `admin`
- Password: `admin123`

## Running the App
- **Dev**: Workflow "Start application" runs `npx tsx server/index.ts` on port 5000
  - Express serves API routes at `/api/*`
  - Vite middleware serves frontend in dev mode
- **Build**: `npm run build` — builds frontend to `dist/`

## Environment Variables
- `DATABASE_URL` — Replit PostgreSQL connection string (auto-provided)
- `SESSION_SECRET` — optional; falls back to `"dev-secret-change-me"` if not set
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — legacy secrets (no longer used)
