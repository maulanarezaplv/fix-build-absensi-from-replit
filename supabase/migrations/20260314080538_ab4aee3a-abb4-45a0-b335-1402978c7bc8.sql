INSERT INTO public.attendance_settings (day_of_week, check_in_start, check_in_end, check_out_start, check_out_end, enabled)
VALUES
  ('Senin', '07:15', '08:00', '15:00', '17:00', true),
  ('Selasa', '07:15', '08:00', '15:00', '17:00', true),
  ('Rabu', '07:15', '08:00', '15:00', '17:00', true),
  ('Kamis', '07:15', '08:00', '15:00', '17:00', true),
  ('Jumat', '07:15', '08:00', '15:00', '17:00', true),
  ('Sabtu', '07:15', '08:00', '15:00', '17:00', false),
  ('Minggu', '07:15', '08:00', '15:00', '17:00', false)
ON CONFLICT DO NOTHING