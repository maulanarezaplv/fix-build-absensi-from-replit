import type { Express, Request, Response, RequestHandler } from "express";
import { storage } from "./storage";
import { buildWAPreview, sendWAMessage, getClassPrefix } from "./waHelper";
import { getAuthUrl, exchangeCodeForToken, uploadPdfToDrive, isGoogleConfigured } from "./googleDrive";
import { generateMonthlyRecapExcel, generateAllClassesExcel } from "./excelGenerator";

const _cache = new Map<string, { data: any; exp: number }>();
const _get = (k: string) => { const e = _cache.get(k); return (e && Date.now() < e.exp) ? e.data : null; };
const _set = (k: string, d: any, ttl = 60_000) => _cache.set(k, { data: d, exp: Date.now() + ttl });
const _del = (...keys: string[]) => keys.forEach(k => _cache.delete(k));

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    name: string;
    roles: string[];
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!req.session.roles?.includes("admin")) return res.status(403).json({ error: "Forbidden: Admin only" });
  next();
}

// ---- SSE (Server-Sent Events) for real-time updates ----
const sseClients = new Set<Response>();

function broadcastSSE(table: string) {
  const payload = `data: ${JSON.stringify({ table, ts: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

export function registerRoutes(app: Express, loginLimiter?: RequestHandler) {
  // ---- Auth ----
  const loginMiddleware = loginLimiter ? [loginLimiter] : [];
  app.post("/api/auth/login", ...loginMiddleware, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username dan password wajib diisi" });

      const user = await storage.getUserByUsername(username.trim());
      if (!user) return res.status(401).json({ error: "Username atau password salah" });

      const valid = await storage.verifyPassword(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Username atau password salah" });

      const roles = await storage.getUserRoles(user.id);
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.name = user.name;
      req.session.roles = roles;

      res.json({ id: user.id, username: user.username, name: user.name, roles });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json(null);
    try {
      const roles = await storage.getUserRoles(req.session.userId);
      res.json({ id: req.session.userId, username: req.session.username, name: req.session.name, roles });
    } catch {
      res.json(null);
    }
  });

  // ---- Web Config ----
  app.get("/api/web-config", async (_req, res) => {
    try {
      const cached = _get("web-config");
      if (cached) return res.json(cached);
      const config = await storage.getWebConfig();
      _set("web-config", config, 2 * 60_000);
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/web-config", requireAuth, async (req, res) => {
    try {
      const config = await storage.getWebConfig();
      if (!config) return res.status(404).json({ error: "Config not found" });
      const updated = await storage.updateWebConfig(config.id, req.body);
      _del("web-config");
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Classes ----
  app.get("/api/classes", async (_req, res) => {
    try {
      const cached = _get("classes");
      if (cached) return res.json(cached);
      const data = await storage.getClasses();
      _set("classes", data, 5 * 60_000);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/classes", requireAuth, async (req, res) => {
    try {
      const { name, names } = req.body;
      let result;
      if (names && Array.isArray(names)) {
        result = await storage.createClasses(names);
      } else if (name) {
        result = await storage.createClass(name);
      } else {
        return res.status(400).json({ error: "name or names required" });
      }
      _del("classes");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/classes/:id", requireAuth, async (req, res) => {
    try {
      const { name, wa_group_id, wali_kelas, wali_kelas_nip } = req.body;
      const result = await storage.updateClass(req.params.id, name, wa_group_id, wali_kelas, wali_kelas_nip);
      _del("classes");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/classes/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteClass(req.params.id);
      _del("classes");
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Students ----
  app.get("/api/students", async (req, res) => {
    try {
      const classId = req.query.class_id as string | undefined;
      const nis = req.query.nis as string | undefined;
      const id = req.query.id as string | undefined;
      res.json(await storage.getStudents(classId, nis, id));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/students/counts", requireAuth, async (_req, res) => {
    try {
      res.json(await storage.getStudentCounts());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/students", requireAuth, async (req, res) => {
    try {
      const { students: batch } = req.body;
      if (!Array.isArray(batch) || batch.length === 0) return res.status(400).json({ error: "students array required" });
      res.json(await storage.createStudents(batch));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/students/batch-nis", requireAuth, async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) return res.status(400).json({ error: "updates array required" });
      let saved = 0;
      const duplicates: string[] = [];
      for (const u of updates as Array<{ id: string; nis: string | null }>) {
        try {
          await storage.updateStudent(u.id, { nis: u.nis || null });
          saved++;
        } catch (e: any) {
          if ((e.code === "23505" || e.message?.includes("unique")) && u.nis) {
            duplicates.push(u.nis);
          }
        }
      }
      res.json({ ok: true, saved, duplicates });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/students/batch-photos", requireAuth, async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) return res.status(400).json({ error: "updates array required" });
      const results = await Promise.all(
        updates.map((u: { id: string; photo_url: string }) =>
          storage.updateStudent(u.id, { photo_url: u.photo_url })
        )
      );
      res.json({ ok: true, count: results.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/students/batch-gender", requireAuth, async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) return res.status(400).json({ error: "updates array required" });
      const results = await Promise.all(
        updates.map((u: { id: string; gender: string | null }) =>
          storage.updateStudent(u.id, { gender: u.gender || null })
        )
      );
      res.json({ ok: true, count: results.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/students/:id", requireAuth, async (req, res) => {
    try {
      res.json(await storage.updateStudent(req.params.id, req.body));
    } catch (e: any) {
      const isDuplicate = e.code === "23505" || e.message?.includes("unique");
      const nis = req.body?.nis;
      res.status(400).json({
        error: isDuplicate && nis
          ? `NIS ${nis} sudah digunakan oleh siswa lain`
          : e.message,
      });
    }
  });

  app.delete("/api/students/by-class/:classId", requireAuth, async (req, res) => {
    try {
      await storage.deleteStudentsByClass(req.params.classId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/students/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteStudent(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Fast QR Scan Lookup (student + today's attendance in one call) ----
  app.get("/api/scan-lookup", async (req, res) => {
    try {
      const q = req.query as any;
      const raw = (q.q as string || "").trim();
      const date = (q.date as string) || new Date().toISOString().split("T")[0];
      if (!raw) return res.status(400).json({ error: "q param required" });

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
      const [studentArr, attendanceArr] = await Promise.all([
        storage.getStudents(undefined, isUuid ? undefined : raw, isUuid ? raw : undefined),
        storage.getAttendance({ date }),
      ]);

      const student = studentArr?.[0] || null;
      if (!student) return res.json({ student: null, attendance: null });

      const attendance = (attendanceArr as any[]).find((a: any) => a.student_id === student.id) || null;
      res.json({ student, attendance });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Attendance ----
  // ---- Real-time SSE endpoint ----
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ table: "connected", ts: Date.now() })}\n\n`);
    req.on("close", () => sseClients.delete(res));
  });

  app.get("/api/attendance", async (req, res) => {
    try {
      const q = req.query as any;
      const filters: any = {};
      if (q.date) filters.date = q.date;
      if (q.class_id) filters.classId = q.class_id;
      if (q.student_id) filters.studentId = q.student_id;
      if (q.start_date) filters.startDate = q.start_date;
      if (q.end_date) filters.endDate = q.end_date;
      if (q.status) filters.status = Array.isArray(q.status) ? q.status : q.status.split(",");
      if (q.validation_status) filters.validationStatus = q.validation_status;
      res.json(await storage.getAttendance(filters));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const body = req.body;
      const records = Array.isArray(body) ? body : body.records || [body];
      if (req.session.userId) {
        records.forEach((r: any) => { if (!r.submitted_by) r.submitted_by = req.session.userId; });
      }
      const result = await storage.createAttendance(records);
      broadcastSSE("attendance_records");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    try {
      const result = await storage.updateAttendance(req.params.id, req.body);
      broadcastSSE("attendance_records");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    try {
      await storage.deleteAttendance(req.params.id);
      broadcastSSE("attendance_records");
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Attendance Settings ----
  app.get("/api/attendance-settings", async (_req, res) => {
    try {
      const cached = _get("attendance-settings");
      if (cached) return res.json(cached);
      const data = await storage.getAttendanceSettings();
      _set("attendance-settings", data, 10 * 60_000);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/attendance-settings/:id", requireAuth, async (req, res) => {
    try {
      const result = await storage.updateAttendanceSetting(req.params.id, req.body);
      _del("attendance-settings");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Holidays ----
  app.get("/api/holidays", async (_req, res) => {
    try {
      const cached = _get("holidays");
      if (cached) return res.json(cached);
      const data = await storage.getHolidays();
      _set("holidays", data, 10 * 60_000);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/holidays", requireAuth, async (req, res) => {
    try {
      const result = await storage.createHoliday(req.body);
      _del("holidays");
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/holidays/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteHoliday(req.params.id);
      _del("holidays");
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Guru Piket ----
  app.get("/api/guru-piket", requireAuth, async (req, res) => {
    try {
      const userId = req.query.user_id as string | undefined;
      res.json(await storage.getPiketAssignments(userId));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/guru-piket", requireAuth, async (req, res) => {
    try {
      const { records } = req.body;
      res.json(await storage.createPiketAssignments(records));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/guru-piket/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePiketAssignment(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Users ----
  app.get("/api/users", requireAuth, async (_req, res) => {
    try {
      res.json(await storage.getUsers());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const { username, password, name, role } = req.body;
      if (!username || !password || !name) return res.status(400).json({ error: "username, password, and name are required" });
      res.json(await storage.createUser({ username, password, name, role: role || "guru" }));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      res.json(await storage.updateUser(req.params.id, req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---- Profiles ----
  app.get("/api/profiles", requireAuth, async (_req, res) => {
    try {
      res.json(await storage.getProfiles());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Dashboard ----
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      res.json(await storage.getDashboardStats(date));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/dashboard/yearly", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      res.json(await storage.getYearlyStats(year));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/dashboard/student-count", requireAuth, async (_req, res) => {
    try {
      res.json(await storage.getStudentCount());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- WhatsApp Auto-Send Settings ----
  app.get("/api/whatsapp/auto-send", requireAuth, async (_req, res) => {
    try {
      const config = await storage.getWebConfig();
      res.json({
        enabled: config?.wa_auto_send_enabled ?? false,
        time: config?.wa_auto_send_time ?? "14:00",
        scope: config?.wa_auto_send_scope ?? "all",
        last_sent_date: config?.wa_auto_sent_date ?? null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/whatsapp/auto-send", requireAuth, async (req, res) => {
    try {
      const config = await storage.getWebConfig();
      if (!config) return res.status(404).json({ error: "Config not found" });
      const { enabled, time, scope } = req.body;
      // Explicitly coerce enabled to boolean to avoid truthy/falsy edge cases
      const enabledBool = enabled === true || enabled === "true";
      await storage.updateWebConfig(config.id, {
        wa_auto_send_enabled: enabledBool,
        wa_auto_send_time: time,
        wa_auto_send_scope: scope,
      });
      _del("web-config");
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- WhatsApp Kirim Sekarang (paksa, tanpa cek tanggal) ----
  app.post("/api/whatsapp/send-now", requireAuth, async (req, res) => {
    try {
      const config = await storage.getWebConfig();
      if (!config?.wa_token) return res.status(400).json({ error: "Token WhatsApp belum dikonfigurasi." });

      const provider = config.wa_provider || "fonnte";
      const token = config.wa_token;
      const globalTarget = config.wa_target_number || "";
      const scope = config.wa_auto_send_scope || "all";

      const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const todayStr = wibNow.toISOString().slice(0, 10);

      const allClasses = await storage.getClasses();
      let classesToProcess = allClasses;
      if (scope !== "all") {
        classesToProcess = allClasses.filter(c => getClassPrefix(c.name) === scope);
      }
      if (classesToProcess.length === 0) return res.status(400).json({ error: "Tidak ada kelas yang sesuai scope." });

      classesToProcess.sort((a, b) => a.name.localeCompare(b.name, "id"));
      const classIds = classesToProcess.map(c => c.id);
      const target = classesToProcess.length === 1
        ? (classesToProcess[0].wa_group_id || globalTarget)
        : globalTarget;
      if (!target) return res.status(400).json({ error: "Nomor target WhatsApp belum dikonfigurasi." });

      const { message } = await buildWAPreview(classIds, todayStr);
      if (!message) return res.status(400).json({ error: "Pesan kosong — tidak ada data absensi." });

      const { ok, data } = await sendWAMessage(token, provider, target, message);
      if (!ok) return res.status(500).json({ error: "Gagal mengirim ke WhatsApp", detail: data });

      // Tandai sebagai sudah terkirim hari ini
      await storage.updateWebConfig(config.id, { wa_auto_sent_date: todayStr });
      return res.json({ ok: true, sent_to: target, provider, classes: classIds.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- WhatsApp Send ----
  app.post("/api/whatsapp/send", requireAuth, async (req, res) => {
    try {
      const { class_id, class_ids, date } = req.body;
      const ids: string[] = class_ids ? (Array.isArray(class_ids) ? class_ids : class_ids.split(",")) : class_id ? [class_id] : [];
      if (ids.length === 0 || !date) return res.status(400).json({ error: "class_id(s) dan date wajib diisi" });

      const config = await storage.getWebConfig();
      if (!config?.wa_token) return res.status(400).json({ error: "Token WhatsApp belum dikonfigurasi." });

      const provider = config.wa_provider || "fonnte";
      const token = config.wa_token;
      const globalTarget = config.wa_target_number || "";

      const allClasses = await storage.getClasses();
      const classMap = new Map(allClasses.map(c => [c.id, c]));

      // Single or multi class: always build ONE combined message and send ONCE
      const cls = ids.length === 1 ? classMap.get(ids[0]) : null;
      const target = cls?.wa_group_id || globalTarget;
      if (!target) return res.status(400).json({ error: "Nomor target WhatsApp belum dikonfigurasi." });
      const { message } = await buildWAPreview(ids, date);
      const { ok, data } = await sendWAMessage(token, provider, target, message);
      if (!ok) return res.status(500).json({ error: "Gagal mengirim ke WhatsApp", detail: data });
      return res.json({ ok: true, sent: 1, sent_to: target, provider });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/whatsapp/preview", requireAuth, async (req, res) => {
    try {
      const rawIds = req.query.class_ids as string | undefined;
      const rawId = req.query.class_id as string | undefined;
      const date = req.query.date as string;
      const ids: string[] = rawIds ? rawIds.split(",") : rawId ? [rawId] : [];
      if (ids.length === 0 || !date) return res.status(400).json({ error: "class_id(s) dan date wajib" });

      const config = await storage.getWebConfig();
      const globalTarget = config?.wa_target_number || "";
      const allClasses = await storage.getClasses();
      const classMap = new Map(allClasses.map(c => [c.id, c]));

      const perClassTargets = ids.map(cid => ({
        classId: cid,
        className: classMap.get(cid)?.name || cid,
        waGroupId: classMap.get(cid)?.wa_group_id || globalTarget || null,
      }));

      const result = await buildWAPreview(ids, date);
      res.json({ ...result, perClassTargets });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Reset / Bulk Delete (admin only) ----
  app.delete("/api/reset/attendance", requireAdmin, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      await storage.deleteAllAttendance(year);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/reset/students", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllStudents();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/reset/users", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllGuruUsers();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/reset/holidays", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllHolidays();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/reset/guru-piket", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllGuruPiket();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/reset/all", requireAdmin, async (req, res) => {
    try {
      await storage.resetAllData();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Google Drive OAuth & Backup (admin only) ----
  app.get("/api/backup/google-status", requireAdmin, async (_req, res) => {
    try {
      const configured = isGoogleConfigured();
      const config = await storage.getWebConfig();
      res.json({
        configured,
        connected: !!(config?.google_refresh_token),
        email: config?.google_connected_email || null,
        folderId: config?.google_drive_folder_id || null,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/auth/google", requireAdmin, (req, res) => {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const base = `${proto}://${host}`;
    const url = getAuthUrl(base);
    if (!url) return res.status(400).json({ error: "GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET belum dikonfigurasi di .env" });
    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.redirect("/admin/config?google=error");
    try {
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const base = `${proto}://${host}`;
      const { email, refreshToken } = await exchangeCodeForToken(code, base);
      const config = await storage.getWebConfig();
      if (config) {
        await storage.updateWebConfig(config.id, {
          google_refresh_token: refreshToken,
          google_connected_email: email,
        });
      }
      res.redirect("/admin/config?google=success");
    } catch (e: any) {
      console.error("Google OAuth error:", e.message);
      res.redirect("/admin/config?google=error");
    }
  });

  app.delete("/api/auth/google/disconnect", requireAdmin, async (_req, res) => {
    try {
      const config = await storage.getWebConfig();
      if (config) {
        await storage.updateWebConfig(config.id, {
          google_refresh_token: null,
          google_connected_email: null,
        });
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/config/google-folder", requireAdmin, async (req, res) => {
    try {
      const { folderId } = req.body;
      const config = await storage.getWebConfig();
      if (!config) return res.status(404).json({ error: "Config not found" });
      await storage.updateWebConfig(config.id, { google_drive_folder_id: folderId || null });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/config/gdrive-auto-backup", requireAdmin, async (req, res) => {
    try {
      const { enabled, time, schedule } = req.body;
      const config = await storage.getWebConfig();
      if (!config) return res.status(404).json({ error: "Config not found" });
      await storage.updateWebConfig(config.id, {
        gdrive_auto_backup_enabled: !!enabled,
        gdrive_auto_backup_time: time || "23:00",
        gdrive_auto_backup_schedule: schedule || "monthly",
      });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/backup/drive", requireAdmin, async (req, res) => {
    try {
      const { pdfBase64, filename, folderId } = req.body;
      if (!pdfBase64 || !filename) return res.status(400).json({ error: "pdfBase64 dan filename wajib diisi" });
      const result = await uploadPdfToDrive(pdfBase64, filename, folderId);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/backup/drive/all-data", requireAdmin, async (req, res) => {
    try {
      const { year } = req.body;
      const allClasses = await storage.getClasses();
      const allStudents = await storage.getStudents();
      const allAttendance = await storage.getAllAttendanceRecords(year ? Number(year) : undefined);
      const payload = {
        exported_at: new Date().toISOString(),
        year: year || "semua",
        classes: allClasses,
        students: allStudents,
        attendance_records: allAttendance,
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const jsonBase64 = Buffer.from(jsonStr).toString("base64");
      const suffix = year ? `_${year}` : "";
      const filename = `backup_absensi${suffix}_${new Date().toISOString().slice(0, 10)}.json`;
      const cfg = await storage.getWebConfig();
      const result = await uploadPdfToDrive(jsonBase64, filename, cfg?.google_drive_folder_id);
      res.json({ ...result, filename, totalRecords: allAttendance.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/rekap/excel", requireAuth as RequestHandler, async (req: Request, res: Response) => {
    try {
      const classId = req.query.class_id as string;
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      if (!classId || isNaN(month) || isNaN(year)) {
        return res.status(400).json({ error: "Parameter class_id, month, year diperlukan" });
      }
      const [cfg, allClasses] = await Promise.all([storage.getWebConfig(), storage.getClasses()]);
      const cls = allClasses.find((c: any) => c.id === classId);
      const schoolCity = cfg?.school_city || "Kebakkramat";
      const waliKelas = (cls as any)?.wali_kelas || "";
      const waliKelasNip = (cls as any)?.wali_kelas_nip || "";
      const semesterOverride       = req.query.semester as string | undefined;
      const tahunPelajaranOverride = req.query.tahun_pelajaran as string | undefined;
      const buffer = await generateMonthlyRecapExcel(classId, year, month, schoolCity, waliKelas, waliKelasNip, semesterOverride, tahunPelajaranOverride);
      const className = cls?.name?.replace(/\s+/g, "_") || classId;
      const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const monthLabel = MONTHS_ID[month - 1] || month;
      const filename = `Presensi_${className}_${monthLabel}_${year}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/rekap/excel-all", requireAuth as RequestHandler, async (req: Request, res: Response) => {
    try {
      const month = parseInt(req.query.month as string);
      const year  = parseInt(req.query.year  as string);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ error: "Parameter month, year diperlukan" });
      }
      const cfg = await storage.getWebConfig();
      const schoolCity             = cfg?.school_city || "Kebakkramat";
      const semesterOverride       = req.query.semester as string | undefined;
      const tahunPelajaranOverride = req.query.tahun_pelajaran as string | undefined;
      const buffer = await generateAllClassesExcel(year, month, schoolCity, semesterOverride, tahunPelajaranOverride);
      const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const monthLabel = MONTHS_ID[month - 1] || month;
      const filename = `Presensi_Semua_Kelas_${monthLabel}_${year}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

}
