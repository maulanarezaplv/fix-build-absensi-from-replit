
-- Fix permissive INSERT policies
DROP POLICY "Authenticated users can insert attendance" ON public.attendance_records;
DROP POLICY "Anon can insert attendance (public form)" ON public.attendance_records;

-- More restrictive: authenticated users can insert with their own submitted_by
CREATE POLICY "Authenticated users can insert attendance" ON public.attendance_records 
  FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid() OR submitted_by IS NULL);

-- Anon can only insert izin/sakit (public form)
CREATE POLICY "Anon can insert attendance (public form)" ON public.attendance_records 
  FOR INSERT TO anon WITH CHECK (status IN ('izin', 'sakit') AND submitted_by IS NULL);
