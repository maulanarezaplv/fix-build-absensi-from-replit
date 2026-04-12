import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  profiles, userRoles, classes, students, attendanceRecords,
  attendanceSettings, holidays, guruPiketAssignments, webConfig,
  Profile, Class, Student, AttendanceRecord, AttendanceSetting,
  Holiday, GuruPiketAssignment, WebConfig, UserRole,
} from "../shared/schema";
import bcrypt from "bcryptjs";

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

function profileWithUserId(p: Profile) {
  return { ...p, user_id: p.id };
}

export const storage = {
  // ---- Auth ----
  async getUserByUsername(username: string) {
    const [p] = await db.select().from(profiles).where(eq(profiles.username, username));
    return p ? profileWithUserId(p) : undefined;
  },

  async verifyPassword(plain: string, hash: string) {
    if (!hash) return false;
    return bcrypt.compare(plain, hash);
  },

  async getUserRoles(userId: string): Promise<string[]> {
    const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map(r => r.role);
  },

  // ---- Web Config ----
  async getWebConfig() {
    const [row] = await db.select().from(webConfig).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      app_title: row.appTitle,
      app_subtitle: row.appSubtitle,
      logo_url: row.logoUrl,
      bg_url_1: row.bgUrl1,
      bg_url_2: row.bgUrl2,
      bg_url_3: row.bgUrl3,
      bg_url_4: row.bgUrl4,
      bg_images: row.bgImages,
      school_start_date: row.schoolStartDate,
      wa_provider: row.waProvider,
      wa_token: row.waToken,
      wa_target_number: row.waTargetNumber,
      wa_auto_send_enabled: row.waAutoSendEnabled,
      wa_auto_send_time: row.waAutoSendTime,
      wa_auto_send_scope: row.waAutoSendScope,
      wa_auto_sent_date: row.waAutoSentDate,
      google_refresh_token: row.googleRefreshToken,
      google_connected_email: row.googleConnectedEmail,
      google_drive_folder_id: row.googleDriveFolderId,
      gdrive_auto_backup_enabled: row.gdriveAutoBackupEnabled,
      gdrive_auto_backup_time: row.gdriveAutoBackupTime,
      gdrive_auto_backup_schedule: row.gdriveAutoBackupSchedule,
      gdrive_auto_backed_up_date: row.gdriveAutoBackedUpDate,
      school_city: row.schoolCity ?? null,
      updated_at: row.updatedAt,
    };
  },

  async updateWebConfig(id: string, data: Partial<{
    app_title: string; app_subtitle: string;
    logo_url: string | null; bg_url_1: string | null; bg_url_2: string | null;
    bg_url_3: string | null; bg_url_4: string | null; bg_images: string | null;
    school_start_date: string | null;
    wa_provider: string | null; wa_token: string | null; wa_target_number: string | null;
    wa_auto_send_enabled: boolean;
    wa_auto_send_time: string;
    wa_auto_send_scope: string | null;
    wa_auto_sent_date: string | null;
    google_refresh_token: string | null;
    google_connected_email: string | null;
    google_drive_folder_id: string | null;
    gdrive_auto_backup_enabled: boolean;
    gdrive_auto_backup_time: string;
    gdrive_auto_backup_schedule: string;
    gdrive_auto_backed_up_date: string | null;
    school_city: string | null;
  }>) {
    const updateData: any = {};
    if (data.app_title !== undefined) updateData.appTitle = data.app_title;
    if (data.app_subtitle !== undefined) updateData.appSubtitle = data.app_subtitle;
    if ("logo_url" in data) updateData.logoUrl = data.logo_url;
    if ("bg_url_1" in data) updateData.bgUrl1 = data.bg_url_1;
    if ("bg_url_2" in data) updateData.bgUrl2 = data.bg_url_2;
    if ("bg_url_3" in data) updateData.bgUrl3 = data.bg_url_3;
    if ("bg_url_4" in data) updateData.bgUrl4 = data.bg_url_4;
    if ("bg_images" in data) updateData.bgImages = data.bg_images;
    if ("school_start_date" in data) updateData.schoolStartDate = data.school_start_date;
    if ("wa_provider" in data) updateData.waProvider = data.wa_provider;
    if ("wa_token" in data) updateData.waToken = data.wa_token;
    if ("wa_target_number" in data) updateData.waTargetNumber = data.wa_target_number;
    if ("wa_auto_send_enabled" in data) updateData.waAutoSendEnabled = data.wa_auto_send_enabled;
    if ("wa_auto_send_time" in data) updateData.waAutoSendTime = data.wa_auto_send_time;
    if ("wa_auto_send_scope" in data) updateData.waAutoSendScope = data.wa_auto_send_scope;
    if ("wa_auto_sent_date" in data) updateData.waAutoSentDate = data.wa_auto_sent_date;
    if ("google_refresh_token" in data) updateData.googleRefreshToken = data.google_refresh_token;
    if ("google_connected_email" in data) updateData.googleConnectedEmail = data.google_connected_email;
    if ("google_drive_folder_id" in data) updateData.googleDriveFolderId = data.google_drive_folder_id;
    if ("gdrive_auto_backup_enabled" in data) updateData.gdriveAutoBackupEnabled = data.gdrive_auto_backup_enabled;
    if ("gdrive_auto_backup_time" in data) updateData.gdriveAutoBackupTime = data.gdrive_auto_backup_time;
    if ("gdrive_auto_backup_schedule" in data) updateData.gdriveAutoBackupSchedule = data.gdrive_auto_backup_schedule;
    if ("gdrive_auto_backed_up_date" in data) updateData.gdriveAutoBackedUpDate = data.gdrive_auto_backed_up_date;
    if ("school_city" in data) updateData.schoolCity = data.school_city;
    updateData.updatedAt = new Date();
    await db.update(webConfig).set(updateData).where(eq(webConfig.id, id));
    return this.getWebConfig();
  },

  // ---- Classes ----
  async getClasses() {
    const rows = await db.select().from(classes).orderBy(classes.name);
    return rows.map(r => ({ id: r.id, name: r.name, wa_group_id: r.waGroupId ?? null, wali_kelas: r.waliKelas ?? null, wali_kelas_nip: r.waliKelasNip ?? null, created_at: r.createdAt }));
  },

  async createClass(name: string) {
    const [row] = await db.insert(classes).values({ name }).returning();
    return { id: row.id, name: row.name, wa_group_id: row.waGroupId ?? null, wali_kelas: row.waliKelas ?? null, wali_kelas_nip: row.waliKelasNip ?? null, created_at: row.createdAt };
  },

  async createClasses(names: string[]) {
    const rows = await db.insert(classes).values(names.map(name => ({ name }))).returning();
    return rows.map(r => ({ id: r.id, name: r.name, wa_group_id: r.waGroupId ?? null, wali_kelas: r.waliKelas ?? null, wali_kelas_nip: r.waliKelasNip ?? null, created_at: r.createdAt }));
  },

  async updateClass(id: string, name: string, waGroupId?: string | null, waliKelas?: string | null, waliKelasNip?: string | null) {
    const updateData: any = { name };
    if (waGroupId !== undefined) updateData.waGroupId = waGroupId || null;
    if (waliKelas !== undefined) updateData.waliKelas = waliKelas || null;
    if (waliKelasNip !== undefined) updateData.waliKelasNip = waliKelasNip || null;
    const [row] = await db.update(classes).set(updateData).where(eq(classes.id, id)).returning();
    return { id: row.id, name: row.name, wa_group_id: row.waGroupId ?? null, wali_kelas: row.waliKelas ?? null, wali_kelas_nip: row.waliKelasNip ?? null, created_at: row.createdAt };
  },

  async deleteClass(id: string) {
    await db.delete(classes).where(eq(classes.id, id));
  },

  // ---- Students ----
  async getStudents(classIdFilter?: string, nisFilter?: string, idFilter?: string) {
    const baseQuery = db
      .select({
        id: students.id,
        name: students.name,
        nis: students.nis,
        gender: students.gender,
        class_id: students.classId,
        photo_url: students.photoUrl,
        created_at: students.createdAt,
        classes: { id: classes.id, name: classes.name },
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .orderBy(students.name);

    const conditions: any[] = [];
    if (classIdFilter) conditions.push(eq(students.classId, classIdFilter));
    if (nisFilter) conditions.push(eq(students.nis, nisFilter));
    if (idFilter) conditions.push(eq(students.id, idFilter));

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

    return rows.map(r => ({ ...r, classes: r.classes }));
  },

  async createStudents(records: Array<{ name: string; nis?: string | null; class_id: string }>) {
    const rows = await db.insert(students).values(
      records.map(r => ({ name: r.name, nis: r.nis ?? null, classId: r.class_id }))
    ).returning();
    return rows.map(r => ({ id: r.id, name: r.name, nis: r.nis, class_id: r.classId, created_at: r.createdAt }));
  },

  async updateStudent(id: string, data: { name?: string; nis?: string; gender?: string | null; photo_url?: string; class_id?: string }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.nis !== undefined) updateData.nis = data.nis;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.photo_url !== undefined) updateData.photoUrl = data.photo_url;
    if (data.class_id !== undefined) updateData.classId = data.class_id;
    const [row] = await db.update(students).set(updateData).where(eq(students.id, id)).returning();
    return { id: row.id, name: row.name, nis: row.nis, gender: row.gender, class_id: row.classId, photo_url: row.photoUrl };
  },

  async deleteStudent(id: string) {
    await db.delete(students).where(eq(students.id, id));
  },

  async deleteStudentsByClass(classId: string) {
    await db.delete(students).where(eq(students.classId, classId));
  },

  async getStudentCounts() {
    const rows = await db
      .select({ classId: students.classId, count: sql<number>`count(*)` })
      .from(students)
      .groupBy(students.classId);
    const counts: Record<string, number> = {};
    rows.forEach(r => { counts[r.classId] = Number(r.count); });
    return counts;
  },

  // ---- Attendance ----
  async getAttendance(filters: {
    date?: string;
    classId?: string;
    studentId?: string;
    startDate?: string;
    endDate?: string;
    status?: string[];
    validationStatus?: string;
  }) {
    const conditions: any[] = [];
    if (filters.date) conditions.push(eq(attendanceRecords.date, filters.date));
    if (filters.classId) conditions.push(eq(attendanceRecords.classId, filters.classId));
    if (filters.studentId) conditions.push(eq(attendanceRecords.studentId, filters.studentId));
    if (filters.startDate) conditions.push(gte(attendanceRecords.date, filters.startDate));
    if (filters.endDate) conditions.push(lte(attendanceRecords.date, filters.endDate));
    if (filters.status && filters.status.length > 0) conditions.push(inArray(attendanceRecords.status, filters.status as any));
    if (filters.validationStatus) conditions.push(eq(attendanceRecords.validationStatus, filters.validationStatus as any));

    const query = db
      .select({
        id: attendanceRecords.id,
        student_id: attendanceRecords.studentId,
        class_id: attendanceRecords.classId,
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        notes: attendanceRecords.notes,
        validation_status: attendanceRecords.validationStatus,
        validated_by: attendanceRecords.validatedBy,
        submitted_by: attendanceRecords.submittedBy,
        submitted_at: attendanceRecords.submittedAt,
        check_out_at: attendanceRecords.checkOutAt,
        students: { id: students.id, name: students.name, nis: students.nis },
        classes: { id: classes.id, name: classes.name },
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(classes, eq(attendanceRecords.classId, classes.id))
      .orderBy(attendanceRecords.submittedAt);

    return conditions.length > 0
      ? query.where(and(...conditions))
      : query;
  },

  async getAllAttendanceRecords(year?: number) {
    const query = db
      .select({
        id: attendanceRecords.id,
        student_id: attendanceRecords.studentId,
        class_id: attendanceRecords.classId,
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        notes: attendanceRecords.notes,
        submitted_at: attendanceRecords.submittedAt,
      })
      .from(attendanceRecords)
      .orderBy(attendanceRecords.date);
    if (year) {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      return query.where(and(gte(attendanceRecords.date, start), lte(attendanceRecords.date, end)));
    }
    return query;
  },

  async createAttendance(records: Array<{
    student_id: string; class_id: string; date: string; status: string;
    notes?: string; submitted_by?: string; validation_status?: string;
    check_in_at?: string;
  }>) {
    if (records.length === 0) return [];

    // 1. Deduplikasi dalam satu batch (student+tanggal yang sama)
    const seen = new Set<string>();
    const uniqueRecords = records.filter(r => {
      const key = `${r.student_id}:${r.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 2. Cek record yang sudah ada di database (cegah duplikat lintas akun)
    const dates = [...new Set(uniqueRecords.map(r => r.date))];
    const studentIds = [...new Set(uniqueRecords.map(r => r.student_id))];
    const existing = await db
      .select({ studentId: attendanceRecords.studentId, date: attendanceRecords.date })
      .from(attendanceRecords)
      .where(and(
        inArray(attendanceRecords.date, dates),
        inArray(attendanceRecords.studentId, studentIds),
      ));
    const existingKeys = new Set(existing.map(e => `${e.studentId}:${e.date}`));

    // 3. Hanya insert record yang belum ada
    const newRecords = uniqueRecords.filter(r => !existingKeys.has(`${r.student_id}:${r.date}`));
    if (newRecords.length === 0) return [];

    const rows = await db.insert(attendanceRecords).values(
      newRecords.map(r => ({
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status as any,
        notes: r.notes || null,
        submittedBy: r.submitted_by || null,
        validationStatus: (r.validation_status as any) || "pending",
        ...(r.check_in_at ? { submittedAt: new Date(r.check_in_at) } : {}),
      }))
    ).returning();
    return rows.map(r => ({ id: r.id, student_id: r.studentId, class_id: r.classId, date: r.date, status: r.status, notes: r.notes, validation_status: r.validationStatus }));
  },

  async updateAttendance(id: string, data: {
    status?: string; validation_status?: string; validated_by?: string | null;
    check_out_at?: string | null; notes?: string;
  }) {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.validation_status !== undefined) updateData.validationStatus = data.validation_status;
    if ("validated_by" in data) updateData.validatedBy = data.validated_by;
    if ("check_out_at" in data) updateData.checkOutAt = data.check_out_at ? new Date(data.check_out_at) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    const [row] = await db.update(attendanceRecords).set(updateData).where(eq(attendanceRecords.id, id)).returning();
    return { id: row.id, student_id: row.studentId, class_id: row.classId, date: row.date, status: row.status, validation_status: row.validationStatus, check_out_at: row.checkOutAt };
  },

  async deleteAttendance(id: string) {
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  },

  // ---- Attendance Settings ----
  async getAttendanceSettings() {
    const rows = await db.select().from(attendanceSettings);
    const dayOrder = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    return rows
      .sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek))
      .map(r => ({
        id: r.id,
        day_of_week: r.dayOfWeek,
        enabled: r.enabled,
        check_in_start: r.checkInStart,
        check_in_end: r.checkInEnd,
        check_out_start: r.checkOutStart,
        check_out_end: r.checkOutEnd,
      }));
  },

  async updateAttendanceSetting(id: string, data: {
    enabled?: boolean; check_in_start?: string; check_in_end?: string;
    check_out_start?: string; check_out_end?: string;
  }) {
    const updateData: any = {};
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.check_in_start !== undefined) updateData.checkInStart = data.check_in_start;
    if (data.check_in_end !== undefined) updateData.checkInEnd = data.check_in_end;
    if (data.check_out_start !== undefined) updateData.checkOutStart = data.check_out_start;
    if (data.check_out_end !== undefined) updateData.checkOutEnd = data.check_out_end;
    await db.update(attendanceSettings).set(updateData).where(eq(attendanceSettings.id, id));
    const [row] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.id, id));
    return { id: row.id, day_of_week: row.dayOfWeek, enabled: row.enabled, check_in_start: row.checkInStart, check_in_end: row.checkInEnd, check_out_start: row.checkOutStart, check_out_end: row.checkOutEnd };
  },

  // ---- Holidays ----
  async getHolidays() {
    const rows = await db.select().from(holidays).orderBy(sql`${holidays.startDate} DESC`);
    return rows.map(r => ({ id: r.id, start_date: r.startDate, end_date: r.endDate, description: r.description, created_at: r.createdAt }));
  },

  async createHoliday(data: { start_date: string; end_date: string; description: string }) {
    const [row] = await db.insert(holidays).values({
      startDate: data.start_date,
      endDate: data.end_date || data.start_date,
      description: data.description,
    }).returning();
    return { id: row.id, start_date: row.startDate, end_date: row.endDate, description: row.description, created_at: row.createdAt };
  },

  async deleteHoliday(id: string) {
    await db.delete(holidays).where(eq(holidays.id, id));
  },

  // ---- Guru Piket ----
  async getPiketAssignments(userId?: string) {
    const query = db.select().from(guruPiketAssignments).orderBy(guruPiketAssignments.dayOfWeek);
    const rows = userId
      ? await query.where(eq(guruPiketAssignments.userId, userId))
      : await query;
    return rows.map(r => ({ id: r.id, day_of_week: r.dayOfWeek, user_id: r.userId, user_name: r.userName, created_at: r.createdAt }));
  },

  async createPiketAssignments(records: Array<{ day_of_week: string; user_id: string; user_name: string }>) {
    const rows = await db.insert(guruPiketAssignments).values(
      records.map(r => ({ dayOfWeek: r.day_of_week, userId: r.user_id, userName: r.user_name }))
    ).returning();
    return rows.map(r => ({ id: r.id, day_of_week: r.dayOfWeek, user_id: r.userId, user_name: r.userName }));
  },

  async deletePiketAssignment(id: string) {
    await db.delete(guruPiketAssignments).where(eq(guruPiketAssignments.id, id));
  },

  // ---- Users ----
  async getUsers() {
    const profileRows = await db.select().from(profiles).orderBy(profiles.name);
    const roleRows = await db.select().from(userRoles);
    return profileRows.map(p => ({
      id: p.id,
      user_id: p.id,
      name: p.name,
      username: p.username,
      password: p.password,
      created_at: p.createdAt,
      roles: roleRows.filter(r => r.userId === p.id).map(r => r.role),
    }));
  },

  async createUser(data: { username: string; password: string; name: string; role: string }) {
    const passwordHash = await bcrypt.hash(data.password, 8);
    const [p] = await db.insert(profiles).values({
      username: data.username.trim().toLowerCase(),
      name: data.name,
      password: data.password,
      passwordHash,
    }).returning();

    await db.insert(userRoles).values({ userId: p.id, role: (data.role || "guru") as any });

    return { id: p.id, user_id: p.id, name: p.name, username: p.username, password: p.password, roles: [data.role] };
  },

  async updateUser(id: string, data: { name?: string; username?: string; password?: string; role?: string }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password !== undefined) {
      updateData.password = data.password || null;
      if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 8);
    }
    updateData.updatedAt = new Date();
    await db.update(profiles).set(updateData).where(eq(profiles.id, id));

    if (data.role !== undefined) {
      await db.delete(userRoles).where(eq(userRoles.userId, id));
      await db.insert(userRoles).values({ userId: id, role: data.role as any });
    }

    const [p] = await db.select().from(profiles).where(eq(profiles.id, id));
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, id));
    return { id: p.id, user_id: p.id, name: p.name, username: p.username, password: p.password, roles: roles.map(r => r.role) };
  },

  async deleteUser(userId: string) {
    await db.delete(profiles).where(eq(profiles.id, userId));
  },

  // ---- Profiles (for validation/sidebar) ----
  async getProfiles() {
    const rows = await db.select().from(profiles).orderBy(profiles.name);
    return rows.map(p => ({ id: p.id, user_id: p.id, name: p.name, username: p.username }));
  },

  // ---- Dashboard ----
  async getDashboardStats(date: string) {
    const [hadirAlpaCounts, izinSakitCounts] = await Promise.all([
      db.select({ status: attendanceRecords.status, count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.date, date), inArray(attendanceRecords.status, ["hadir", "alpa"])))
        .groupBy(attendanceRecords.status),
      db.select({ status: attendanceRecords.status, count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.date, date), inArray(attendanceRecords.status, ["izin", "sakit"]), eq(attendanceRecords.validationStatus, "approved")))
        .groupBy(attendanceRecords.status),
    ]);
    const stats = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    [...hadirAlpaCounts, ...izinSakitCounts].forEach(r => {
      stats[r.status as keyof typeof stats] = Number(r.count);
    });
    return stats;
  },

  async getYearlyStats(year: number) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const [hadirAlpaCounts, izinSakitCounts] = await Promise.all([
      db.select({ status: attendanceRecords.status, date: attendanceRecords.date, count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .where(and(gte(attendanceRecords.date, start), lte(attendanceRecords.date, end), inArray(attendanceRecords.status, ["hadir", "alpa"])))
        .groupBy(attendanceRecords.status, attendanceRecords.date),
      db.select({ status: attendanceRecords.status, date: attendanceRecords.date, count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .where(and(gte(attendanceRecords.date, start), lte(attendanceRecords.date, end), inArray(attendanceRecords.status, ["izin", "sakit"]), eq(attendanceRecords.validationStatus, "approved")))
        .groupBy(attendanceRecords.status, attendanceRecords.date),
    ]);
    const monthlyStats = MONTHS.map(name => ({ name, Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 }));
    [...hadirAlpaCounts, ...izinSakitCounts].forEach(r => {
      const month = new Date(r.date).getMonth();
      const key = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      (monthlyStats[month] as any)[key] += Number(r.count);
    });
    return monthlyStats;
  },

  async getStudentCount() {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(students);
    return Number(count);
  },

  // ---- Reset / Bulk Delete ----
  async deleteAllAttendance(year?: number) {
    if (year) {
      const start = `${year}-01-01`;
      const end   = `${year}-12-31`;
      const result = await db.delete(attendanceRecords)
        .where(and(gte(attendanceRecords.date, start), lte(attendanceRecords.date, end)));
      return result;
    }
    return db.delete(attendanceRecords);
  },

  async deleteAllStudents() {
    return db.delete(students);
  },

  async deleteAllGuruUsers() {
    const guruRoles = await db.select({ userId: userRoles.userId }).from(userRoles)
      .where(eq(userRoles.role, "guru"));
    if (guruRoles.length === 0) return;
    const ids = guruRoles.map(r => r.userId);
    await db.delete(userRoles).where(inArray(userRoles.userId, ids));
    await db.delete(profiles).where(inArray(profiles.id, ids));
  },

  async deleteAllHolidays() {
    return db.delete(holidays);
  },

  async deleteAllGuruPiket() {
    return db.delete(guruPiketAssignments);
  },

  async resetAllData() {
    await db.delete(attendanceRecords);
    await db.delete(students);
    // keep admin, only delete guru
    const guruRoles = await db.select({ userId: userRoles.userId }).from(userRoles)
      .where(eq(userRoles.role, "guru"));
    if (guruRoles.length > 0) {
      const ids = guruRoles.map(r => r.userId);
      await db.delete(userRoles).where(inArray(userRoles.userId, ids));
      await db.delete(profiles).where(inArray(profiles.id, ids));
    }
    await db.delete(holidays);
    await db.delete(guruPiketAssignments);
  },

  // ---- Seed ----
  async seedDefaults() {
    const [existingConfig] = await db.select().from(webConfig).limit(1);
    if (!existingConfig) {
      await db.insert(webConfig).values({ appTitle: "E-ABSENSI", appSubtitle: "Sistem Absensi Sekolah" });
    }

    const existingSettings = await db.select().from(attendanceSettings);
    if (existingSettings.length === 0) {
      await db.insert(attendanceSettings).values([
        { dayOfWeek: "Senin",   enabled: true,  checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
        { dayOfWeek: "Selasa",  enabled: true,  checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
        { dayOfWeek: "Rabu",    enabled: true,  checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
        { dayOfWeek: "Kamis",   enabled: true,  checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
        { dayOfWeek: "Jumat",   enabled: true,  checkInStart: "07:15", checkInEnd: "11:30", checkOutStart: "11:30", checkOutEnd: "13:00" },
        { dayOfWeek: "Sabtu",   enabled: false, checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
        { dayOfWeek: "Minggu",  enabled: false, checkInStart: "07:15", checkInEnd: "08:00", checkOutStart: "15:00", checkOutEnd: "17:00" },
      ]);
    }

    const [existingAdmin] = await db.select().from(profiles).limit(1);
    if (!existingAdmin) {
      const hash = await bcrypt.hash("admin123", 8);
      const [admin] = await db.insert(profiles).values({
        username: "admin",
        passwordHash: hash,
        name: "Administrator",
      }).returning();
      await db.insert(userRoles).values({ userId: admin.id, role: "admin" });
      console.log("Default admin user created: username=admin, password=admin123");
    }
  },
};
