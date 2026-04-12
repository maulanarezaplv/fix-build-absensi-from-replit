
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'guru');

-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('hadir', 'izin', 'sakit', 'alpa');

-- Create enum for validation status
CREATE TYPE public.validation_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nis TEXT NOT NULL UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view students for public form" ON public.students FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  notes TEXT,
  validation_status validation_status NOT NULL DEFAULT 'pending',
  validated_by UUID REFERENCES auth.users(id),
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view attendance" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attendance" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert attendance (public form)" ON public.attendance_records FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins can manage attendance" ON public.attendance_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Guru can update attendance" ON public.attendance_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'guru'));

-- Create attendance_settings table
CREATE TABLE public.attendance_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  check_in_start TEXT NOT NULL DEFAULT '07:15',
  check_in_end TEXT NOT NULL DEFAULT '08:00',
  check_out_start TEXT NOT NULL DEFAULT '15:00',
  check_out_end TEXT NOT NULL DEFAULT '17:00'
);

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view attendance settings" ON public.attendance_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage attendance settings" ON public.attendance_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create guru_piket_assignments table
CREATE TABLE public.guru_piket_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.guru_piket_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view piket" ON public.guru_piket_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage piket" ON public.guru_piket_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create web_config table
CREATE TABLE public.web_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_title TEXT NOT NULL DEFAULT 'E-ABSENSI',
  app_subtitle TEXT NOT NULL DEFAULT 'Sistem Absensi Sekolah',
  logo_url TEXT,
  bg_url_1 TEXT,
  bg_url_2 TEXT,
  bg_url_3 TEXT,
  bg_url_4 TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.web_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view web config" ON public.web_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage web config" ON public.web_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_web_config_updated_at BEFORE UPDATE ON public.web_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'), COALESCE(NEW.raw_user_meta_data->>'username', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow anon to view classes for public form
CREATE POLICY "Anyone can view classes for public form" ON public.classes FOR SELECT TO anon USING (true);

-- Seed default attendance settings
INSERT INTO public.attendance_settings (day_of_week, enabled, check_in_start, check_in_end, check_out_start, check_out_end) VALUES
  ('Senin', true, '07:15', '08:00', '15:00', '17:00'),
  ('Selasa', true, '07:15', '08:00', '15:00', '17:00'),
  ('Rabu', true, '07:15', '08:00', '15:00', '17:00'),
  ('Kamis', true, '07:15', '08:00', '15:00', '17:00'),
  ('Jumat', true, '07:15', '11:30', '11:30', '13:00'),
  ('Sabtu', false, '07:15', '08:00', '15:00', '17:00'),
  ('Minggu', false, '07:15', '08:00', '15:00', '17:00');

-- Seed default web config
INSERT INTO public.web_config (app_title, app_subtitle) VALUES ('E-ABSENSI', 'Sistem Absensi Sekolah');
