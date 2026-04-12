// ====================================================================
// E-ABSENSI — Google Apps Script Backend
// Database: Google Spreadsheet
// Fitur: Login, Kelas, Siswa, Absensi, Validasi, Rekap, WA, dll.
// ====================================================================

var SS_ID   = "PASTE_SPREADSHEET_ID_HERE"; // <-- Ganti dengan ID Spreadsheet kamu
var SALT    = "e-absensi-salt-2024";
var SESSION_TTL = 28800; // 8 jam

// ====================================================================
// ENTRY POINT
// ====================================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("E-Absensi")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ====================================================================
// SPREADSHEET HELPERS
// ====================================================================

function _ss() {
  return SpreadsheetApp.openById(SS_ID);
}

function _sh(name) {
  var ss = _ss();
  var s  = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  return s;
}

function _ensureSheet(name, headers) {
  var s = _sh(name);
  if (s.getLastRow() === 0) s.appendRow(headers);
  return s;
}

function _rows(name) {
  var s = _sh(name);
  var n = s.getLastRow();
  if (n < 2) return [];
  var cols = s.getLastColumn();
  if (cols < 1) return [];
  return s.getRange(2, 1, n - 1, cols).getValues();
}

function _uuid() {
  return Utilities.getUuid();
}

function _parseDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Jakarta", "yyyy-MM-dd");
  return String(v).slice(0, 10);
}

// ====================================================================
// SETUP & SEED
// ====================================================================

function setupSheets() {
  var defs = {
    Profiles:           ["id","username","name","password_hash","role"],
    Classes:            ["id","name","wa_group_id","wali_kelas","wali_kelas_nip"],
    Students:           ["id","name","nis","gender","class_id","photo_url"],
    Attendance:         ["id","student_id","class_id","date","status","notes","validation_status","validated_by","submitted_by"],
    AttendanceSettings: ["id","day_of_week","check_in_start","check_in_end","check_out_start","check_out_end","enabled"],
    Holidays:           ["id","name","start_date","end_date"],
    GuruPiket:          ["id","user_id","day_of_week"],
    UserPasswords:      ["id","user_id","username","name","role","password_plain","password_hash"],
    Config:             ["key","value"],
  };
  Object.keys(defs).forEach(function(name) {
    _ensureSheet(name, defs[name]);
  });
  _seedDefaults();
  return { ok: true, message: "Setup selesai. Akun default: admin / admin123" };
}

function _seedDefaults() {
  var profiles = _rows("Profiles");
  var adminExists = profiles.some(function(r) { return r[1] === "admin"; });
  if (!adminExists) {
    _sh("Profiles").appendRow([_uuid(), "admin", "Administrator", "admin123", "admin"]);
    _ensureSheet("UserPasswords", ["id","user_id","username","name","role","password_plain","password_hash"]);
    _sh("UserPasswords").appendRow([_uuid(), "admin", "admin", "Administrator", "admin", "admin123", _hashPwd("admin123")]);
  }

  var settings = _rows("AttendanceSettings");
  if (settings.length === 0) {
    ["Senin","Selasa","Rabu","Kamis","Jumat"].forEach(function(day) {
      _sh("AttendanceSettings").appendRow([_uuid(), day, "06:00", "07:30", "13:00", "14:30", true]);
    });
    ["Sabtu","Minggu"].forEach(function(day) {
      _sh("AttendanceSettings").appendRow([_uuid(), day, "06:00", "07:30", "13:00", "14:30", false]);
    });
  }

  var cfg = _getConfigMap();
  if (!cfg.app_title) {
    _setConfigKey("app_title",           "E-ABSENSI");
    _setConfigKey("app_subtitle",        "Sistem Absensi Sekolah");
    _setConfigKey("school_name",         "SMP Negeri 1 Kebakkramat");
    _setConfigKey("school_city",         "Kebakkramat");
    _setConfigKey("logo_url",            "");
    _setConfigKey("bg_url_1",            "");
    _setConfigKey("bg_url_2",            "");
    _setConfigKey("bg_url_3",            "");
    _setConfigKey("bg_url_4",            "");
    _setConfigKey("wa_provider",         "fonnte");
    _setConfigKey("wa_token",            "");
    _setConfigKey("wa_target_number",    "");
    _setConfigKey("wa_auto_send_enabled","false");
    _setConfigKey("wa_auto_send_time",   "14:00");
    _setConfigKey("wa_auto_send_scope",  "all");
  }
}

// ====================================================================
// AUTH / SESSION
// ====================================================================

function _hashPwd(pwd) {
  try {
    var sig = Utilities.computeHmacSha256Signature(pwd, SALT);
    return sig.reduce(function(a, b) {
      return a + ("0" + (b & 0xff).toString(16)).slice(-2);
    }, "");
  } catch(e) {
    return pwd;
  }
}

function _syncUserPasswordRow(userId, username, name, role, password) {
  var s = _ensureSheet("UserPasswords", ["id","user_id","username","name","role","password_plain","password_hash"]);
  var rows = s.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] === userId) {
      s.getRange(i+1, 3).setValue(username);
      s.getRange(i+1, 4).setValue(name);
      s.getRange(i+1, 5).setValue(role);
      s.getRange(i+1, 6).setValue(password);
      s.getRange(i+1, 7).setValue(_hashPwd(password));
      return;
    }
  }
  s.appendRow([_uuid(), userId, username, name, role, password, _hashPwd(password)]);
}

function _getSession(token) {
  if (!token) return null;
  try {
    var raw = CacheService.getScriptCache().get("sess_" + token);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function _requireAuth(token) {
  var sess = _getSession(token);
  if (!sess) throw new Error("Sesi tidak valid. Silakan login kembali.");
  return sess;
}

function _requireAdmin(token) {
  var sess = _requireAuth(token);
  if (sess.role !== "admin") throw new Error("Hanya admin yang dapat melakukan ini.");
  return sess;
}

function login(username, password) {
  try {
    var rows = _rows("Profiles");
    var row  = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][1] === username.trim()) { row = rows[i]; break; }
    }
    if (!row) return { ok: false, error: "Username atau password salah" };
    if (_hashPwd(password) !== row[3]) return { ok: false, error: "Username atau password salah" };
    var token = _uuid();
    var sess  = { userId: row[0], username: row[1], name: row[2], role: row[4] };
    CacheService.getScriptCache().put("sess_" + token, JSON.stringify(sess), SESSION_TTL);
    return { ok: true, token: token, userId: sess.userId, username: sess.username, name: sess.name, role: sess.role };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function logout(token) {
  try { CacheService.getScriptCache().remove("sess_" + token); } catch(e) {}
  return { ok: true };
}

function checkSession(token) {
  var sess = _getSession(token);
  if (!sess) return null;
  return sess;
}

// ====================================================================
// WEB CONFIG
// ====================================================================

function _getConfigMap() {
  var rows = _rows("Config");
  var m = {};
  rows.forEach(function(r) {
    if (r[0]) m[String(r[0])] = (r[1] === true ? "true" : r[1] === false ? "false" : String(r[1] === null || r[1] === undefined ? "" : r[1]));
  });
  return m;
}

function _setConfigKey(key, value) {
  var s    = _sh("Config");
  var rows = s.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) { s.getRange(i + 1, 2).setValue(value); return; }
  }
  s.appendRow([key, value]);
}

function getWebConfig() {
  try {
    var m = _getConfigMap();
    return {
      app_title:            m.app_title            || "E-ABSENSI",
      app_subtitle:         m.app_subtitle          || "Sistem Absensi Sekolah",
      logo_url:             m.logo_url              || "",
      bg_url_1:             m.bg_url_1              || "",
      bg_url_2:             m.bg_url_2              || "",
      bg_url_3:             m.bg_url_3              || "",
      bg_url_4:             m.bg_url_4              || "",
      school_name:          m.school_name           || "SMP Negeri 1 Kebakkramat",
      school_city:          m.school_city           || "Kebakkramat",
      wa_provider:          m.wa_provider           || "fonnte",
      wa_token:             m.wa_token              || "",
      wa_target_number:     m.wa_target_number      || "",
      wa_auto_send_enabled: m.wa_auto_send_enabled  === "true",
      wa_auto_send_time:    m.wa_auto_send_time     || "14:00",
      wa_auto_send_scope:   m.wa_auto_send_scope    || "all",
    };
  } catch(e) {
    return { app_title: "E-ABSENSI", app_subtitle: "Sistem Absensi Sekolah", error: e.message };
  }
}

function updateWebConfig(token, data) {
  try {
    _requireAuth(token);
    var allowed = ["app_title","app_subtitle","logo_url","bg_url_1","bg_url_2","bg_url_3","bg_url_4",
                   "school_name","school_city","wa_provider","wa_token","wa_target_number",
                   "wa_auto_send_enabled","wa_auto_send_time","wa_auto_send_scope"];
    allowed.forEach(function(k) {
      if (data[k] !== undefined && data[k] !== null) _setConfigKey(k, String(data[k]));
    });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// CLASSES
// ====================================================================

function getClasses() {
  try {
    return _rows("Classes").filter(function(r){ return r[0]; }).map(function(r) {
      return { id: r[0], name: r[1], wa_group_id: r[2]||"", wali_kelas: r[3]||"", wali_kelas_nip: r[4]||"" };
    }).sort(function(a,b){ return a.name.localeCompare(b.name,"id"); });
  } catch(e) { return []; }
}

function createClass(token, name) {
  try {
    _requireAuth(token);
    if (!name || !name.trim()) throw new Error("Nama kelas diperlukan");
    var id = _uuid();
    _sh("Classes").appendRow([id, name.trim(), "", "", ""]);
    return { ok: true, id: id, name: name.trim() };
  } catch(e) { return { ok: false, error: e.message }; }
}

function createClasses(token, names) {
  try {
    _requireAuth(token);
    var results = [];
    names.forEach(function(name) {
      if (name && name.trim()) {
        var id = _uuid();
        _sh("Classes").appendRow([id, name.trim(), "", "", ""]);
        results.push({ id: id, name: name.trim() });
      }
    });
    return { ok: true, results: results };
  } catch(e) { return { ok: false, error: e.message }; }
}

function updateClass(token, id, data) {
  try {
    _requireAuth(token);
    var s    = _sh("Classes");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (data.name         !== undefined) s.getRange(i+1,2).setValue(data.name);
        if (data.wa_group_id  !== undefined) s.getRange(i+1,3).setValue(data.wa_group_id  || "");
        if (data.wali_kelas   !== undefined) s.getRange(i+1,4).setValue(data.wali_kelas   || "");
        if (data.wali_kelas_nip !== undefined) s.getRange(i+1,5).setValue(data.wali_kelas_nip || "");
        return { ok: true };
      }
    }
    throw new Error("Kelas tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteClass(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("Classes");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) { s.deleteRow(i+1); return { ok: true }; }
    }
    throw new Error("Kelas tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// STUDENTS
// ====================================================================

function getStudents(classId, nis, id) {
  try {
    var rows = _rows("Students").filter(function(r){ return r[0]; });
    if (classId) rows = rows.filter(function(r){ return r[4] === classId; });
    if (nis)     rows = rows.filter(function(r){ return r[2] === nis; });
    if (id)      rows = rows.filter(function(r){ return r[0] === id; });
    return rows.map(function(r) {
      return { id: r[0], name: r[1], nis: r[2]||"", gender: r[3]||"", class_id: r[4], photo_url: r[5]||"" };
    }).sort(function(a,b){ return a.name.localeCompare(b.name,"id"); });
  } catch(e) { return []; }
}

function createStudents(token, students) {
  try {
    _requireAuth(token);
    var s       = _sh("Students");
    var results = [];
    students.forEach(function(st) {
      var id = _uuid();
      s.appendRow([id, st.name||"", st.nis||"", st.gender||"", st.class_id||"", st.photo_url||""]);
      results.push({ id: id, name: st.name, nis: st.nis, gender: st.gender, class_id: st.class_id });
    });
    return { ok: true, results: results };
  } catch(e) { return { ok: false, error: e.message }; }
}

function updateStudent(token, id, data) {
  try {
    _requireAuth(token);
    var s    = _sh("Students");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (data.name      !== undefined) s.getRange(i+1,2).setValue(data.name);
        if (data.nis       !== undefined) s.getRange(i+1,3).setValue(data.nis       || "");
        if (data.gender    !== undefined) s.getRange(i+1,4).setValue(data.gender    || "");
        if (data.class_id  !== undefined) s.getRange(i+1,5).setValue(data.class_id  || "");
        if (data.photo_url !== undefined) s.getRange(i+1,6).setValue(data.photo_url || "");
        return { ok: true };
      }
    }
    throw new Error("Siswa tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteStudent(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("Students");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) { s.deleteRow(i+1); return { ok: true }; }
    }
    throw new Error("Siswa tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteStudentsByClass(token, classId) {
  try {
    _requireAuth(token);
    var s    = _sh("Students");
    var rows = s.getDataRange().getValues();
    var toDelete = [];
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][4] === classId) toDelete.push(i + 1);
    }
    toDelete.forEach(function(r){ s.deleteRow(r); });
    return { ok: true, deleted: toDelete.length };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// ATTENDANCE
// ====================================================================

function getAttendance(filters) {
  try {
    filters = filters || {};
    var rows = _rows("Attendance").filter(function(r){ return r[0]; });
    if (filters.date)             rows = rows.filter(function(r){ return _parseDate(r[3]) === filters.date; });
    if (filters.classId)          rows = rows.filter(function(r){ return r[2] === filters.classId; });
    if (filters.studentId)        rows = rows.filter(function(r){ return r[1] === filters.studentId; });
    if (filters.startDate)        rows = rows.filter(function(r){ return _parseDate(r[3]) >= filters.startDate; });
    if (filters.endDate)          rows = rows.filter(function(r){ return _parseDate(r[3]) <= filters.endDate; });
    if (filters.validationStatus) rows = rows.filter(function(r){ return r[6] === filters.validationStatus; });
    if (filters.status && filters.status.length) {
      var statuses = Array.isArray(filters.status) ? filters.status : String(filters.status).split(",");
      rows = rows.filter(function(r){ return statuses.indexOf(r[4]) !== -1; });
    }
    return rows.map(function(r) {
      return {
        id: r[0], student_id: r[1], class_id: r[2], date: _parseDate(r[3]),
        status: r[4], notes: r[5]||"", validation_status: r[6]||"",
        validated_by: r[7]||"", submitted_by: r[8]||""
      };
    });
  } catch(e) { return []; }
}

function createAttendance(records, token) {
  try {
    if (!Array.isArray(records)) records = [records];
    var s           = _sh("Attendance");
    var submittedBy = token ? ((_getSession(token) || {}).userId || "") : "";
    var results     = [];
    records.forEach(function(rec) {
      var id  = _uuid();
      var vs  = (rec.status === "hadir") ? "approved" : (rec.validation_status || "pending");
      s.appendRow([id, rec.student_id||"", rec.class_id||"",
        rec.date || _parseDate(new Date()), rec.status||"hadir",
        rec.notes||"", vs, rec.validated_by||"", submittedBy]);
      results.push({ id: id, student_id: rec.student_id, class_id: rec.class_id,
        date: rec.date, status: rec.status, notes: rec.notes, validation_status: vs });
    });
    return { ok: true, results: results };
  } catch(e) { return { ok: false, error: e.message }; }
}

function updateAttendance(token, id, data) {
  try {
    _requireAuth(token);
    var s    = _sh("Attendance");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (data.status            !== undefined) s.getRange(i+1,5).setValue(data.status);
        if (data.notes             !== undefined) s.getRange(i+1,6).setValue(data.notes || "");
        if (data.validation_status !== undefined) s.getRange(i+1,7).setValue(data.validation_status);
        if (data.validated_by      !== undefined) s.getRange(i+1,8).setValue(data.validated_by || "");
        return { ok: true };
      }
    }
    throw new Error("Data absensi tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteAttendance(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("Attendance");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) { s.deleteRow(i+1); return { ok: true }; }
    }
    throw new Error("Data tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function scanLookup(q, date) {
  try {
    if (!q) return { student: null, attendance: null };
    date = date || _parseDate(new Date());
    var isUuid   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    var stuRows  = _rows("Students").filter(function(r){ return r[0]; });
    var stuRow   = isUuid ? stuRows.filter(function(r){ return r[0]===q; })[0]
                          : stuRows.filter(function(r){ return r[2]===q; })[0];
    if (!stuRow) return { student: null, attendance: null };
    var student  = { id: stuRow[0], name: stuRow[1], nis: stuRow[2], gender: stuRow[3], class_id: stuRow[4] };
    var attRows  = _rows("Attendance");
    var attRow   = attRows.filter(function(r){ return r[1]===student.id && _parseDate(r[3])===date; })[0];
    var attendance = attRow ? {
      id: attRow[0], student_id: attRow[1], class_id: attRow[2],
      date: _parseDate(attRow[3]), status: attRow[4], notes: attRow[5], validation_status: attRow[6]
    } : null;
    return { student: student, attendance: attendance };
  } catch(e) { return { student: null, attendance: null, error: e.message }; }
}

// ====================================================================
// ATTENDANCE SETTINGS
// ====================================================================

function getAttendanceSettings() {
  try {
    return _rows("AttendanceSettings").filter(function(r){ return r[0]; }).map(function(r) {
      return {
        id: r[0], day_of_week: r[1], check_in_start: r[2], check_in_end: r[3],
        check_out_start: r[4], check_out_end: r[5],
        enabled: r[6] === true || r[6] === "true" || r[6] === "TRUE" || r[6] === "BENAR"
      };
    });
  } catch(e) { return []; }
}

function updateAttendanceSetting(token, id, data) {
  try {
    _requireAuth(token);
    var s    = _sh("AttendanceSettings");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (data.check_in_start  !== undefined) s.getRange(i+1,3).setValue(data.check_in_start);
        if (data.check_in_end    !== undefined) s.getRange(i+1,4).setValue(data.check_in_end);
        if (data.check_out_start !== undefined) s.getRange(i+1,5).setValue(data.check_out_start);
        if (data.check_out_end   !== undefined) s.getRange(i+1,6).setValue(data.check_out_end);
        if (data.enabled         !== undefined) s.getRange(i+1,7).setValue(data.enabled);
        return { ok: true };
      }
    }
    throw new Error("Setting tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// HOLIDAYS
// ====================================================================

function getHolidays() {
  try {
    return _rows("Holidays").filter(function(r){ return r[0]; }).map(function(r) {
      return { id: r[0], name: r[1], start_date: _parseDate(r[2]), end_date: _parseDate(r[3]) };
    }).sort(function(a,b){ return a.start_date.localeCompare(b.start_date); });
  } catch(e) { return []; }
}

function createHoliday(token, data) {
  try {
    _requireAuth(token);
    if (!data.name || !data.start_date || !data.end_date)
      throw new Error("Nama, tanggal mulai, dan tanggal selesai diperlukan");
    var id = _uuid();
    _sh("Holidays").appendRow([id, data.name, data.start_date, data.end_date]);
    return { ok: true, id: id };
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteHoliday(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("Holidays");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) { s.deleteRow(i+1); return { ok: true }; }
    }
    throw new Error("Tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// GURU PIKET
// ====================================================================

function getPiketAssignments(token) {
  try {
    _requireAuth(token);
    return _rows("GuruPiket").filter(function(r){ return r[0]; }).map(function(r) {
      return { id: r[0], user_id: r[1], day_of_week: r[2] };
    });
  } catch(e) { return []; }
}

function createPiketAssignments(token, records) {
  try {
    _requireAuth(token);
    var s       = _sh("GuruPiket");
    var results = [];
    records.forEach(function(rec) {
      var id = _uuid();
      s.appendRow([id, rec.user_id, rec.day_of_week]);
      results.push({ id: id, user_id: rec.user_id, day_of_week: rec.day_of_week });
    });
    return { ok: true, results: results };
  } catch(e) { return { ok: false, error: e.message }; }
}

function deletePiketAssignment(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("GuruPiket");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) { s.deleteRow(i+1); return { ok: true }; }
    }
    throw new Error("Tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// USERS
// ====================================================================

function getUsers(token) {
  try {
    _requireAuth(token);
    return _rows("Profiles").filter(function(r){ return r[0]; }).map(function(r) {
      return { id: r[0], username: r[1], name: r[2], password: r[3] || "", role: r[4] };
    });
  } catch(e) { return []; }
}

function getProfiles(token) {
  return getUsers(token);
}

function createUser(token, data) {
  try {
    _requireAuth(token);
    if (!data.username || !data.password || !data.name)
      throw new Error("Username, password, dan nama diperlukan");
    var existing = _rows("Profiles").filter(function(r){ return r[1] === data.username.trim(); })[0];
    if (existing) throw new Error("Username sudah digunakan");
    var id = _uuid();
    var username = data.username.trim();
    var name = data.name.trim();
    var password = String(data.password);
    var role = data.role || "guru";
    _sh("Profiles").appendRow([id, username, name, password, role]);
    _syncUserPasswordRow(id, username, name, role, password);
    return { ok: true, id: id, username: username, name: name, role: role, password: password };
  } catch(e) { return { ok: false, error: e.message }; }
}

function updateUser(token, id, data) {
  try {
    _requireAuth(token);
    var s    = _sh("Profiles");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (data.name)     s.getRange(i+1,3).setValue(data.name);
        if (data.password) s.getRange(i+1,4).setValue(data.password);
        if (data.role)     s.getRange(i+1,5).setValue(data.role);
        var currentUsername = rows[i][1];
        _syncUserPasswordRow(id, currentUsername, data.name || rows[i][2], data.role || rows[i][4], data.password || rows[i][3] || "");
        return { ok: true };
      }
    }
    throw new Error("User tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteUser(token, id) {
  try {
    _requireAuth(token);
    var s    = _sh("Profiles");
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (rows[i][4] === "admin") throw new Error("Akun admin tidak dapat dihapus");
        s.deleteRow(i+1);
        return { ok: true };
      }
    }
    throw new Error("User tidak ditemukan");
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// DASHBOARD
// ====================================================================

function getDashboardStats(token, date) {
  try {
    _requireAuth(token);
    date = date || _parseDate(new Date());
    var attRows = _rows("Attendance").filter(function(r){ return r[0] && _parseDate(r[3]) === date; });
    var hadir   = attRows.filter(function(r){ return r[4]==="hadir"; }).length;
    var izin    = attRows.filter(function(r){ return r[4]==="izin";  }).length;
    var sakit   = attRows.filter(function(r){ return r[4]==="sakit"; }).length;
    var alpa    = attRows.filter(function(r){ return r[4]==="alpa";  }).length;
    var pending = attRows.filter(function(r){ return (r[4]==="izin"||r[4]==="sakit") && r[6]==="pending"; }).length;
    var totalStudents = _rows("Students").filter(function(r){ return r[0]; }).length;
    return { date: date, total_students: totalStudents, hadir: hadir, izin: izin, sakit: sakit, alpa: alpa, pending_validation: pending };
  } catch(e) { return { error: e.message }; }
}

function getYearlyStats(token, year) {
  try {
    _requireAuth(token);
    year = year || new Date().getFullYear();
    var yearStr = String(year);
    var rows    = _rows("Attendance").filter(function(r){
      if (!r[0]) return false;
      var d = _parseDate(r[3]);
      return d && d.slice(0,4) === yearStr;
    });
    var monthly = {};
    for (var m = 1; m <= 12; m++) {
      var mStr   = m < 10 ? "0"+m : ""+m;
      var mRows  = rows.filter(function(r){ return _parseDate(r[3]).slice(5,7) === mStr; });
      monthly[m] = {
        hadir: mRows.filter(function(r){ return r[4]==="hadir"; }).length,
        izin:  mRows.filter(function(r){ return r[4]==="izin";  }).length,
        sakit: mRows.filter(function(r){ return r[4]==="sakit"; }).length,
        alpa:  mRows.filter(function(r){ return r[4]==="alpa";  }).length,
      };
    }
    return { year: year, monthly: monthly };
  } catch(e) { return { error: e.message }; }
}

function getStudentCount(token) {
  try {
    _requireAuth(token);
    return { count: _rows("Students").filter(function(r){ return r[0]; }).length };
  } catch(e) { return { count: 0 }; }
}

// ====================================================================
// REKAP BULANAN
// ====================================================================

function getRekapBulanan(token, classId, year, month) {
  try {
    _requireAuth(token);
    var monthStr = month < 10 ? "0"+month : ""+month;
    var prefix   = year + "-" + monthStr;
    var students = getStudents(classId, null, null);
    var daysInMonth = new Date(year, month, 0).getDate();
    var attRows  = _rows("Attendance").filter(function(r){
      return r[0] && r[2] === classId && _parseDate(r[3]).indexOf(prefix) === 0;
    });
    var data = students.map(function(st) {
      var stAtt  = attRows.filter(function(r){ return r[1] === st.id; });
      var byDate = {};
      stAtt.forEach(function(r){
        var day  = parseInt(_parseDate(r[3]).slice(8,10));
        byDate[day] = r[4];
      });
      var hadir = 0, izin = 0, sakit = 0, alpa = 0;
      Object.keys(byDate).forEach(function(d){
        var s = byDate[d];
        if (s==="hadir") hadir++;
        else if (s==="izin") izin++;
        else if (s==="sakit") sakit++;
        else if (s==="alpa") alpa++;
      });
      return { student: st, attendance: byDate, hadir: hadir, izin: izin, sakit: sakit, alpa: alpa };
    });
    return { ok: true, data: data, daysInMonth: daysInMonth };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// WHATSAPP
// ====================================================================

function buildWAMessage(token, classIds, date) {
  try {
    _requireAuth(token);
    if (!Array.isArray(classIds)) classIds = [classIds];
    date = date || _parseDate(new Date());
    var classes  = getClasses();
    var attRows  = _rows("Attendance").filter(function(r){ return r[0] && _parseDate(r[3]) === date; });
    var MONTHS   = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    var dateObj  = new Date(date + "T00:00:00");
    var dateStr  = dateObj.getDate() + " " + MONTHS[dateObj.getMonth()] + " " + dateObj.getFullYear();
    var DAYS     = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    var dayName  = DAYS[dateObj.getDay()];
    var message  = "📋 *LAPORAN ABSENSI*\n📅 " + dayName + ", " + dateStr + "\n\n";
    var targets  = classes.filter(function(c){ return classIds.indexOf(c.id) !== -1; });
    targets.forEach(function(cls) {
      var attKelas = attRows.filter(function(r){ return r[2] === cls.id; });
      var hadir    = attKelas.filter(function(r){ return r[4]==="hadir"; }).length;
      var izin     = attKelas.filter(function(r){ return r[4]==="izin";  }).length;
      var sakit    = attKelas.filter(function(r){ return r[4]==="sakit"; }).length;
      var alpa     = attKelas.filter(function(r){ return r[4]==="alpa";  }).length;
      message += "*" + cls.name + "*\n";
      message += "✅ Hadir: " + hadir + "\n";
      message += "📋 Izin : " + izin  + "\n";
      message += "🤒 Sakit: " + sakit + "\n";
      message += "❌ Alpa : " + alpa  + "\n\n";
    });
    return { ok: true, message: message };
  } catch(e) { return { ok: false, error: e.message }; }
}

function sendWhatsApp(token, classIds, date) {
  try {
    _requireAuth(token);
    var cfg = _getConfigMap();
    if (!cfg.wa_token) throw new Error("Token WhatsApp belum dikonfigurasi di Konfigurasi Web");
    if (!cfg.wa_target_number) throw new Error("Nomor target WhatsApp belum dikonfigurasi");
    var res     = buildWAMessage(token, classIds, date);
    if (!res.ok) throw new Error(res.error);
    var message  = res.message;
    var provider = cfg.wa_provider || "fonnte";
    var target   = cfg.wa_target_number;
    var resp;
    if (provider === "fonnte") {
      resp = UrlFetchApp.fetch("https://api.fonnte.com/send", {
        method: "post",
        headers: { "Authorization": cfg.wa_token, "Content-Type": "application/json" },
        payload: JSON.stringify({ target: target, message: message, countryCode: "62" }),
        muteHttpExceptions: true,
      });
    } else {
      throw new Error("Provider WhatsApp tidak dikenal: " + provider);
    }
    var code = resp.getResponseCode();
    if (code !== 200 && code !== 201) throw new Error("Gagal mengirim WA (HTTP " + code + ")");
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// RESET DATA
// ====================================================================

function resetAttendance(token, year) {
  try {
    _requireAdmin(token);
    var s    = _sh("Attendance");
    var rows = s.getDataRange().getValues();
    var del  = [];
    for (var i = rows.length - 1; i >= 1; i--) {
      var d = _parseDate(rows[i][3]);
      if (!year || d.slice(0,4) === String(year)) del.push(i+1);
    }
    del.forEach(function(r){ s.deleteRow(r); });
    return { ok: true, deleted: del.length };
  } catch(e) { return { ok: false, error: e.message }; }
}

function resetStudents(token) {
  try {
    _requireAdmin(token);
    var s = _sh("Students");
    var n = s.getLastRow();
    if (n > 1) s.deleteRows(2, n-1);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function resetHolidays(token) {
  try {
    _requireAdmin(token);
    var s = _sh("Holidays");
    var n = s.getLastRow();
    if (n > 1) s.deleteRows(2, n-1);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function resetGuruPiket(token) {
  try {
    _requireAdmin(token);
    var s = _sh("GuruPiket");
    var n = s.getLastRow();
    if (n > 1) s.deleteRows(2, n-1);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function resetUsers(token) {
  try {
    _requireAdmin(token);
    var s    = _sh("Profiles");
    var rows = s.getDataRange().getValues();
    var del  = [];
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][4] !== "admin") del.push(i+1);
    }
    del.forEach(function(r){ s.deleteRow(r); });
    return { ok: true, deleted: del.length };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ====================================================================
// PUBLIC DATA (no auth)
// ====================================================================

function getPublicData() {
  try {
    return {
      config:   getWebConfig(),
      classes:  getClasses(),
      holidays: getHolidays(),
      settings: getAttendanceSettings(),
    };
  } catch(e) {
    return { config: { app_title:"E-ABSENSI", app_subtitle:"Sistem Absensi Sekolah" }, classes:[], holidays:[], settings:[] };
  }
}

function getExistingAttendance(studentId, date) {
  try {
    return _rows("Attendance").filter(function(r){
      return r[0] && r[1] === studentId && _parseDate(r[3]) === date;
    }).map(function(r){
      return { id:r[0], student_id:r[1], class_id:r[2], date:_parseDate(r[3]), status:r[4], notes:r[5]||"", validation_status:r[6]||"" };
    });
  } catch(e) { return []; }
}
