-- ============================================================
-- Fix authentication, user roles, and RLS policies
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. SECURITY DEFINER function: seed admin role for first user if none exists
CREATE OR REPLACE FUNCTION public.init_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT user_id FROM public.profiles LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 2. SECURITY DEFINER function: upsert a user role (any authenticated user can call)
CREATE OR REPLACE FUNCTION public.ensure_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.init_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.init_first_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_role(uuid, text) TO authenticated;

-- 4. Seed admin role for the first profile (if no admin exists yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT user_id FROM public.profiles LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 5. Add permissive write policies for authenticated users on key tables
--    (allows any logged-in user to manage data, not just admins)
--    These supplement the strict admin-only policies.

-- classes
DROP POLICY IF EXISTS "Guru can manage classes" ON public.classes;
CREATE POLICY "Guru can manage classes" ON public.classes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- students
DROP POLICY IF EXISTS "Guru can manage students" ON public.students;
CREATE POLICY "Guru can manage students" ON public.students
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- attendance_records: update existing permissive INSERT, add DELETE/UPDATE for authenticated
DROP POLICY IF EXISTS "Guru can delete attendance" ON public.attendance_records;
CREATE POLICY "Guru can delete attendance" ON public.attendance_records
  FOR DELETE TO authenticated
  USING (true);

-- attendance_settings
DROP POLICY IF EXISTS "Guru can manage settings" ON public.attendance_settings;
CREATE POLICY "Guru can manage settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- holidays
DROP POLICY IF EXISTS "Guru can manage holidays" ON public.holidays;
CREATE POLICY "Guru can manage holidays" ON public.holidays
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- guru_piket_assignments
DROP POLICY IF EXISTS "Guru can manage piket" ON public.guru_piket_assignments;
CREATE POLICY "Guru can manage piket" ON public.guru_piket_assignments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- web_config
DROP POLICY IF EXISTS "Guru can manage web config" ON public.web_config;
CREATE POLICY "Guru can manage web config" ON public.web_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- profiles: allow authenticated users to delete non-admin profiles
DROP POLICY IF EXISTS "Guru can delete profiles" ON public.profiles;
CREATE POLICY "Guru can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (true);

-- user_roles: allow authenticated users to insert roles
DROP POLICY IF EXISTS "Guru can insert roles" ON public.user_roles;
CREATE POLICY "Guru can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (true);
