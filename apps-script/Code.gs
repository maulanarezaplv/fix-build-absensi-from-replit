const SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_HERE";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("E-Absensi")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setupSheets() {
  const sheets = {
    Profiles: ["id", "username", "name", "password", "role"],
    Classes: ["id", "name"],
    Students: ["id", "name", "nis", "gender", "classId"],
    Attendance: ["id", "studentId", "classId", "date", "status", "notes"],
    Holidays: ["id", "name", "startDate", "endDate"],
    Config: ["key", "value"],
  };

  Object.entries(sheets).forEach(([name, headers]) => {
    const sheet = getSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  });

  return { ok: true };
}

function getAppConfig() {
  const sheet = getSheet("Config");
  const values = sheet.getDataRange().getValues();
  const data = {};
  for (let i = 1; i < values.length; i++) {
    const [key, value] = values[i];
    if (key) data[key] = value;
  }
  return {
    app_title: data.app_title || "E-ABSENSI",
    app_subtitle: data.app_subtitle || "Sistem Absensi Sekolah",
    logo_url: data.logo_url || "",
    school_name: data.school_name || "SMP Negeri 1 Kebakkramat",
    school_city: data.school_city || "",
  };
}

function getPublicData() {
  return {
    config: getAppConfig(),
    classes: getSheet("Classes").getDataRange().getValues().slice(1).map(r => ({
      id: r[0],
      name: r[1],
    })),
    holidays: getSheet("Holidays").getDataRange().getValues().slice(1).map(r => ({
      id: r[0],
      name: r[1],
      startDate: r[2],
      endDate: r[3],
    })),
  };
}

function saveAttendance(payload) {
  const sheet = getSheet("Attendance");
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    payload.studentId || "",
    payload.classId || "",
    payload.date || new Date().toISOString().slice(0, 10),
    payload.status || "hadir",
    payload.notes || "",
  ]);
  return { ok: true, id };
}
