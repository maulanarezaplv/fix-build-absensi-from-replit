import { storage } from "./storage";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export async function buildWAPreview(classIds: string[], date: string) {
  const dt = new Date(date + "T00:00:00");
  const dateStr = `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  const statusLabel: Record<string, string> = { izin: "Izin", sakit: "Sakit", alpa: "Alpa" };

  const allClassesList = await storage.getClasses();
  const classNameMap = new Map(allClassesList.map((c: any) => [c.id, c.name]));

  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = wibNow.toISOString().slice(0, 10);
  const nowTimeWIB = wibNow.toISOString().slice(11, 16);
  const cfg = await storage.getWebConfig();
  const schoolStartDate = cfg?.school_start_date || null;

  if (schoolStartDate && date < schoolStartDate) {
    return { message: "", classLabel: "", totalStudents: 0, absentCount: 0, dateStr };
  }

  let checkInClosed = date < todayStr;
  if (!checkInClosed && date === todayStr) {
    const dayName = DAYS[dt.getDay()];
    const settings = await storage.getAttendanceSettings();
    const setting = settings.find((s: any) => s.day_of_week === dayName);
    if (setting?.check_in_end) {
      checkInClosed = nowTimeWIB > setting.check_in_end;
    } else {
      checkInClosed = true;
    }
  }

  async function getAbsentList(cid: string) {
    const [allStudents, allRecords, approvedRecords] = await Promise.all([
      storage.getStudents(cid),
      storage.getAttendance({ date, classId: cid }),
      storage.getAttendance({ date, classId: cid, status: ["izin", "sakit"], validationStatus: "approved" }),
    ]);

    const alpaRecords = allRecords.filter((r: any) => r.status === "alpa");
    const studentsWithAnyRecord = new Set(allRecords.map((r: any) => r.student_id));

    const virtualAlpaStudents = checkInClosed
      ? allStudents.filter((s: any) => !studentsWithAnyRecord.has(s.id))
      : [];

    const absentList: Array<{ name: string; status: string }> = [
      ...approvedRecords.map((r: any) => ({ name: r.students?.name || "—", status: statusLabel[r.status] || r.status })),
      ...alpaRecords.map((r: any) => ({ name: r.students?.name || "—", status: "Alpa" })),
      ...virtualAlpaStudents.map((s: any) => ({ name: s.name, status: "Alpa" })),
    ];
    absentList.sort((a, b) => a.name.localeCompare(b.name, "id"));

    return { allStudents, absentList };
  }

  if (classIds.length === 1) {
    const cid = classIds[0];
    const { allStudents, absentList } = await getAbsentList(cid);
    const className = classNameMap.get(cid) || allStudents[0]?.classes?.name || cid;
    let message = `📌 *Rekap Kehadiran Siswa*\nKelas: ${className}\nTanggal: ${dateStr}\n\n`;
    if (absentList.length === 0) {
      message += `✅ Semua siswa hadir.\n`;
    } else {
      message += `❌ *Siswa TIDAK HADIR:*\n`;
      absentList.forEach((s, i) => {
        message += `${i + 1}. ${s.name} - _*${s.status}*_\n`;
      });
    }
    message += `\n_Orang tua siswa yang tidak hadir karena alpa diharapkan mengonfirmasi ke wali kelas._`;
    return { message, classLabel: className, totalStudents: allStudents.length, absentCount: absentList.length, dateStr };
  }

  const classDataList = await Promise.all(classIds.map(async cid => {
    const { allStudents, absentList } = await getAbsentList(cid);
    const className = classNameMap.get(cid) || allStudents[0]?.classes?.name || cid;
    return { className, absentList, totalStudents: allStudents.length };
  }));
  classDataList.sort((a, b) => a.className.localeCompare(b.className));

  const classNames = classDataList.map(c => c.className).join(", ");
  const totalStudents = classDataList.reduce((s, c) => s + c.totalStudents, 0);
  const absentCount = classDataList.reduce((s, c) => s + c.absentList.length, 0);
  const absentClasses = classDataList.filter(c => c.absentList.length > 0);

  let message = `📌 *Rekap Kehadiran Siswa*\nKelas: ${classNames}\nTanggal: ${dateStr}\n`;
  if (absentClasses.length === 0) {
    message += `\n✅ Semua siswa hadir.\n`;
  } else {
    absentClasses.forEach(({ className, absentList }) => {
      message += `\n📚 *${className}:*\n`;
      absentList.forEach((s, i) => {
        message += `${i + 1}. ${s.name} - _*${s.status}*_\n`;
      });
    });
  }
  message += `\n_Orang tua siswa yang tidak hadir karena alpa diharapkan mengonfirmasi ke wali kelas._`;
  return { message, classLabel: classNames, totalStudents, absentCount, dateStr };
}

export async function sendWAMessage(token: string, provider: string, target: string, message: string) {
  let apiRes: Response;
  if (provider === "fonnte") {
    apiRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ target, message, countryCode: "62" }),
    });
  } else {
    apiRes = await fetch("https://api.woonwa.com/v1/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: target, message }),
    });
  }
  const data = await apiRes.json().catch(() => ({}));
  return { ok: apiRes.ok, data };
}

export function getClassPrefix(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts.slice(0, -1).join(" ");
}
