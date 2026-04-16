-- ============================================================
-- Add all missing columns that the application code references
-- but were not included in the original migration.
-- Using IF NOT EXISTS to be idempotent / safe to re-run.
-- ============================================================

-- ── web_config: extra columns ──────────────────────────────
ALTER TABLE public.web_config
  ADD COLUMN IF NOT EXISTS bg_images TEXT,
  ADD COLUMN IF NOT EXISTS school_start_date TEXT,
  ADD COLUMN IF NOT EXISTS school_city TEXT,
  ADD COLUMN IF NOT EXISTS wa_provider TEXT DEFAULT 'fonnte',
  ADD COLUMN IF NOT EXISTS wa_token TEXT,
  ADD COLUMN IF NOT EXISTS wa_target_number TEXT,
  ADD COLUMN IF NOT EXISTS wa_auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_auto_send_time TEXT NOT NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS wa_auto_send_scope TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS wa_auto_sent_date TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_connected_email TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS gdrive_auto_backup_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdrive_auto_backup_time TEXT NOT NULL DEFAULT '23:00',
  ADD COLUMN IF NOT EXISTS gdrive_auto_backup_schedule TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS gdrive_auto_backed_up_date TEXT;

-- ── classes: wali kelas & WA group columns ─────────────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS wali_kelas TEXT,
  ADD COLUMN IF NOT EXISTS wali_kelas_nip TEXT,
  ADD COLUMN IF NOT EXISTS wa_group_id TEXT;

-- ── students: photo & gender columns ──────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT;

-- ── students.nis: relax NOT NULL constraint if it was strict ─
-- The original migration created nis as NOT NULL UNIQUE but
-- schema.ts has it as optional unique. Relax it so bulk imports
-- with no NIS don't fail.
ALTER TABLE public.students
  ALTER COLUMN nis DROP NOT NULL;

-- ── profiles: make sure user_id column exists ─────────────
-- (already created in original migration, this is a no-op guard)
-- Nothing to add here.
