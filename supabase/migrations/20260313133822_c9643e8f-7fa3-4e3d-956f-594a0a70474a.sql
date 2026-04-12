-- Allow anon to check existing attendance records (for duplicate prevention)
CREATE POLICY "Anon can view attendance records for duplicate check"
ON public.attendance_records
FOR SELECT
TO anon
USING (true);

-- Allow anon to read profiles for username verification during login
CREATE POLICY "Anon can view profiles for login"
ON public.profiles
FOR SELECT
TO anon
USING (true);