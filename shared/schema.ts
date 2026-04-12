import { pgTable, pgEnum, uuid, text, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const appRoleEnum = pgEnum("app_role", ["admin", "guru"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["hadir", "izin", "sakit", "alpa"]);
export const validationStatusEnum = pgEnum("validation_status", ["pending", "approved", "rejected"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  password: text("password"),
  passwordHash: text("password_hash").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role: appRoleEnum("role").notNull(),
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  waGroupId: text("wa_group_id"),
  waliKelas: text("wali_kelas"),
  waliKelasNip: text("wali_kelas_nip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const students = pgTable("students", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nis: text("nis").unique(),
  gender: text("gender"),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: attendanceStatusEnum("status").notNull(),
  notes: text("notes"),
  validationStatus: validationStatusEnum("validation_status").notNull().default("pending"),
  validatedBy: uuid("validated_by").references(() => profiles.id),
  submittedBy: uuid("submitted_by").references(() => profiles.id),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  checkOutAt: timestamp("check_out_at"),
});

export const attendanceSettings = pgTable("attendance_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dayOfWeek: text("day_of_week").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  checkInStart: text("check_in_start").notNull().default("07:15"),
  checkInEnd: text("check_in_end").notNull().default("08:00"),
  checkOutStart: text("check_out_start").notNull().default("15:00"),
  checkOutEnd: text("check_out_end").notNull().default("17:00"),
});

export const holidays = pgTable("holidays", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guruPiketAssignments = pgTable("guru_piket_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dayOfWeek: text("day_of_week").notNull(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webConfig = pgTable("web_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  appTitle: text("app_title").notNull().default("E-ABSENSI"),
  appSubtitle: text("app_subtitle").notNull().default("Sistem Absensi Sekolah"),
  logoUrl: text("logo_url"),
  bgUrl1: text("bg_url_1"),
  bgUrl2: text("bg_url_2"),
  bgUrl3: text("bg_url_3"),
  bgUrl4: text("bg_url_4"),
  bgImages: text("bg_images"),
  schoolStartDate: text("school_start_date"),
  waProvider: text("wa_provider").default("fonnte"),
  waToken: text("wa_token"),
  waTargetNumber: text("wa_target_number"),
  waAutoSendEnabled: boolean("wa_auto_send_enabled").notNull().default(false),
  waAutoSendTime: text("wa_auto_send_time").notNull().default("14:00"),
  waAutoSendScope: text("wa_auto_send_scope").default("all"),
  waAutoSentDate: text("wa_auto_sent_date"),
  googleRefreshToken: text("google_refresh_token"),
  googleConnectedEmail: text("google_connected_email"),
  googleDriveFolderId: text("google_drive_folder_id"),
  gdriveAutoBackupEnabled: boolean("gdrive_auto_backup_enabled").notNull().default(false),
  gdriveAutoBackupTime: text("gdrive_auto_backup_time").notNull().default("23:00"),
  gdriveAutoBackupSchedule: text("gdrive_auto_backup_schedule").notNull().default("monthly"),
  gdriveAutoBackedUpDate: text("gdrive_auto_backed_up_date"),
  schoolCity: text("school_city"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true, submittedAt: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true, createdAt: true });
export const insertGuruPiketSchema = createInsertSchema(guruPiketAssignments).omit({ id: true, createdAt: true });

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type AttendanceSetting = typeof attendanceSettings.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type GuruPiketAssignment = typeof guruPiketAssignments.$inferSelect;
export type WebConfig = typeof webConfig.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
