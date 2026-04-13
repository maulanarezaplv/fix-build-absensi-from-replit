import ExcelJS from "exceljs";
import { storage } from "./storage";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_NAMES_WD = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function getSemesterAndTahunPelajaran(year: number, month: number) {
  if (month >= 7) return { semester: "1", tahunPelajaran: `${year} / ${year + 1}` };
  return { semester: "2", tahunPelajaran: `${year - 1} / ${year}` };
}

async function addClassSheetToWorkbook(
  wb: ExcelJS.Workbook,
  cls: any,
  year: number,
  month: number,
  schoolCity: string,
  waliKelas: string,
  waliKelasNip: string,
  semesterOverride?: string,
  tahunPelajaranOverride?: string,
): Promise<void> {
  const lastDay   = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [studentRows, attendanceRows, cfg, settingList, holidayList] = await Promise.all([
    storage.getStudents(cls.id),
    storage.getAttendance({ classId: cls.id, startDate, endDate }),
    storage.getWebConfig(),
    storage.getAttendanceSettings(),
    storage.getHolidays(),
  ]);

  const students   = studentRows as any[];
  const attendance = attendanceRows as any[];
  const schoolStartDate: string | null = cfg?.school_start_date || null;

  // Izin & Sakit hanya dihitung jika sudah approved (sama seperti tampilan aplikasi)
  const attendanceMap: Record<string, Record<number, string>> = {};
  for (const rec of attendance) {
    const sid = rec.student_id;
    const day = parseInt(rec.date.slice(8, 10));

    // Izin / Sakit yang belum approved diabaikan (pending / rejected = tidak ada keterangan)
    if ((rec.status === "izin" || rec.status === "sakit") && rec.validation_status !== "approved") {
      continue;
    }

    const st =
      rec.status === "hadir" ? "H" :
      rec.status === "sakit" ? "S" :
      rec.status === "izin"  ? "I" :
      rec.status === "alpa"  ? "A" :
      (rec.status?.slice(0, 1).toUpperCase() || "?");
    if (!attendanceMap[sid]) attendanceMap[sid] = {};
    if (!attendanceMap[sid][day]) attendanceMap[sid][day] = st;
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayStr = todayEnd.toISOString().slice(0, 10); // YYYY-MM-DD hari ini
  type DayType = "active" | "libur" | "future" | "pre";
  const dayType: Record<number, DayType> = {};

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const date    = new Date(year, month - 1, d);

    if (date > todayEnd) { dayType[d] = "future"; continue; }
    if (schoolStartDate && dateStr < schoolStartDate) { dayType[d] = "pre"; continue; }

    const isHoliday = (holidayList as any[]).some(
      (h: any) => dateStr >= h.start_date && dateStr <= h.end_date,
    );
    if (isHoliday) { dayType[d] = "libur"; continue; }

    const dayName = DAY_NAMES_WD[date.getDay()];
    const setting = (settingList as any[]).find((s: any) => s.day_of_week === dayName);
    if (!setting || !setting.enabled) { dayType[d] = "libur"; continue; }

    dayType[d] = "active";
  }

  const effectiveDays  = Object.values(dayType).filter(t => t === "active").length;
  const monthLabel     = MONTHS_ID[month - 1];
  const auto           = getSemesterAndTahunPelajaran(year, month);
  const semester       = semesterOverride       || auto.semester;
  const tahunPelajaran = tahunPelajaranOverride || auto.tahunPelajaran;
  const laki           = students.filter((s: any) => s.gender === "L").length;
  const perempuan      = students.filter((s: any) => s.gender === "P").length;

  const COL_NO    = 1;
  const COL_NIS   = 2;
  const COL_NAMA  = 3;
  const COL_LP    = 4;
  const COL_D1    = 5;
  const COL_KETI  = COL_D1 + lastDay;
  const COL_KETS  = COL_KETI + 1;
  const COL_KETA  = COL_KETS + 1;
  const TABLE_END = COL_KETA;

  const FRAC_S    = COL_NAMA;
  const FRAC_E    = COL_LP;
  const DENOM_E   = FRAC_E;

  const ISA_LBL   = COL_D1;
  const ISA_LBL_E = COL_D1 + 4;
  const ISA_VAL   = ISA_LBL_E + 1;
  const ISA_VAL_E = ISA_VAL + 4;

  const X_S     = ISA_VAL;
  const X_E     = ISA_VAL;
  const PCT_S   = ISA_VAL + 1;
  const PCT_E   = ISA_VAL + 3;
  const EQ_COL  = ISA_VAL + 4;
  const RES_S   = ISA_VAL + 5;
  const RES_E   = TABLE_END;

  const SIG_COL_S = Math.max(ISA_LBL, TABLE_END - 14);
  const SIG_COL_E = TABLE_END;

  const ROW_BLANK  = 1;
  const ROW_TITLE  = 2;
  const ROW_INFO   = 3;
  const ROW_SPACER = 4;
  const ROW_HDR1   = 5;
  const ROW_HDR2   = 6;
  const DATA_START = 7;

  const ws = wb.addWorksheet(`Presensi ${cls.name}`, {
    pageSetup: {
      paperSize: 9, orientation: "landscape",
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });

  ws.getColumn(COL_NO).width   = 4.5;
  ws.getColumn(COL_NIS).width  = 10;
  ws.getColumn(COL_NAMA).width = 40;
  ws.getColumn(COL_LP).width   = 4;
  for (let d = 0; d < lastDay; d++) ws.getColumn(COL_D1 + d).width = 2.6;
  ws.getColumn(COL_KETI).width = 4.5;
  ws.getColumn(COL_KETS).width = 4.5;
  ws.getColumn(COL_KETA).width = 4.5;

  const TNR = (sz = 11, bold = false): Partial<ExcelJS.Font> =>
    ({ name: "Times New Roman", size: sz, bold });
  const ctr: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: false };
  const lft: Partial<ExcelJS.Alignment> = { horizontal: "left",   vertical: "middle", wrapText: false };
  const thin: ExcelJS.BorderStyle = "thin";
  const med:  ExcelJS.BorderStyle = "medium";
  const box  = (s: ExcelJS.BorderStyle = thin): Partial<ExcelJS.Borders> =>
    ({ top: { style: s }, bottom: { style: s }, left: { style: s }, right: { style: s } });

  const mc = (
    r1: number, c1: number, r2: number, c2: number,
    val: any,
    font: Partial<ExcelJS.Font>,
    align: Partial<ExcelJS.Alignment>,
    border?: Partial<ExcelJS.Borders>,
    fill?: { type: "pattern"; pattern: string; fgColor: { argb: string } },
  ) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    cell.value = val; cell.font = font; cell.alignment = align;
    if (border) cell.border = border;
    if (fill)   cell.fill   = fill as ExcelJS.Fill;
  };

  ws.getRow(ROW_BLANK).height  = 8;
  ws.getRow(ROW_TITLE).height  = 22;
  ws.getRow(ROW_INFO).height   = 16;
  ws.getRow(ROW_SPACER).height = 4;
  ws.getRow(ROW_HDR1).height   = 16;
  ws.getRow(ROW_HDR2).height   = 16;

  mc(ROW_TITLE, COL_NO, ROW_TITLE, TABLE_END,
    `PRESENSI KELAS ${cls.name.toUpperCase()}`,
    TNR(14, true), ctr);

  const q1 = Math.floor(TABLE_END * 0.18);
  const q2 = Math.floor(TABLE_END * 0.50);
  const q3 = Math.floor(TABLE_END * 0.68);
  mc(ROW_INFO, COL_NO, ROW_INFO, q1,        `Semester  :  ${semester}`,              TNR(11), lft);
  mc(ROW_INFO, q1+1,   ROW_INFO, q2,        `Bulan  :  ${monthLabel} ${year}`,       TNR(11), lft);
  mc(ROW_INFO, q2+1,   ROW_INFO, q3,        `L = ${laki}     P = ${perempuan}`,      TNR(11), lft);
  mc(ROW_INFO, q3+1,   ROW_INFO, TABLE_END, `Tahun Pelajaran  :  ${tahunPelajaran}`, TNR(11), lft);

  const hdr = TNR(10, true);
  for (const [c1, c2, lbl] of [
    [COL_NO, COL_NO, "NO"], [COL_NIS, COL_NIS, "INDUK"],
    [COL_NAMA, COL_NAMA, "NAMA"], [COL_LP, COL_LP, "L/P"],
  ] as [number, number, string][]) {
    ws.mergeCells(ROW_HDR1, c1, ROW_HDR2, c2);
    const c = ws.getCell(ROW_HDR1, c1);
    c.value = lbl; c.font = hdr; c.alignment = ctr; c.border = box();
  }

  ws.mergeCells(ROW_HDR1, COL_D1, ROW_HDR1, COL_D1 + lastDay - 1);
  { const c = ws.getCell(ROW_HDR1, COL_D1); c.value = "TANGGAL"; c.font = hdr; c.alignment = ctr; c.border = box(); }

  ws.mergeCells(ROW_HDR1, COL_KETI, ROW_HDR1, COL_KETA);
  { const c = ws.getCell(ROW_HDR1, COL_KETI); c.value = "KET"; c.font = hdr; c.alignment = ctr; c.border = box(); }

  for (let d = 1; d <= lastDay; d++) {
    const c = ws.getCell(ROW_HDR2, COL_D1 + d - 1);
    c.value = d; c.font = hdr; c.alignment = ctr; c.border = box();
  }
  for (const [i, lbl] of (["I", "S", "A"] as string[]).entries()) {
    const c = ws.getCell(ROW_HDR2, COL_KETI + i);
    c.value = lbl; c.font = hdr; c.alignment = ctr; c.border = box();
  }

  let totalI = 0, totalS = 0, totalA = 0;
  const LIBUR_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0E0E0" } };
  const LIBUR_FONT: Partial<ExcelJS.Font> = { name: "Times New Roman", size: 9, color: { argb: "FF888888" } };

  students.forEach((student: any, idx: number) => {
    const row = DATA_START + idx;
    ws.getRow(row).height = 14;
    const sm = attendanceMap[student.id] || {};
    let cI = 0, cS = 0, cA = 0;

    const setC = (col: number, val: any, font: Partial<ExcelJS.Font>, align: Partial<ExcelJS.Alignment>) => {
      const cell = ws.getCell(row, col);
      cell.value = val; cell.font = font; cell.alignment = align; cell.border = box();
    };

    setC(COL_NO,   idx + 1,             TNR(11),     ctr);
    setC(COL_NIS,  student.nis || "",    TNR(11),     ctr);
    setC(COL_NAMA, student.name,         TNR(11),     lft);
    setC(COL_LP,   student.gender || "", TNR(11),     ctr);

    for (let d = 1; d <= lastDay; d++) {
      const cell = ws.getCell(row, COL_D1 + d - 1);
      cell.alignment = ctr;
      cell.border = box();

      const dt = dayType[d];
      const st = sm[d];

      if (dt === "libur") {
        cell.value = "L";
        cell.font  = LIBUR_FONT;
        cell.fill  = LIBUR_FILL as ExcelJS.Fill;
      } else if (dt === "future" || dt === "pre") {
        cell.font = TNR(10);
      } else if (st && st !== "H") {
        // Keterangan eksplisit: I, S, atau A
        cell.value = st;
        cell.font  = TNR(10, true);
        if (st === "I") cI++;
        else if (st === "S") cS++;
        else if (st === "A") cA++;
      } else if (!st || st === "H") {
        // Hari aktif: jika tidak ada record (atau hadir) dan sudah lewat hari ini → alpa otomatis
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (!st && dateStr < todayStr) {
          // Tidak ada record sama sekali di hari yang sudah lewat = alpa
          cell.value = "A";
          cell.font  = TNR(10, true);
          cA++;
        } else {
          // Hadir (H) atau hari ini tanpa record = kosong (hadir)
          cell.font = TNR(10);
        }
      }
    }

    const setKET = (col: number, val: number) => {
      const cell = ws.getCell(row, col);
      cell.value = val > 0 ? val : null;
      cell.font = TNR(10, true); cell.alignment = ctr; cell.border = box();
    };
    setKET(COL_KETI, cI); setKET(COL_KETS, cS); setKET(COL_KETA, cA);
    totalI += cI; totalS += cS; totalA += cA;
  });

  const RK  = DATA_START + students.length;
  const RK2 = RK + 1;
  const RK3 = RK + 2;
  const PR1 = RK + 4;
  const PR2 = RK + 5;
  const SG_CITY = PR2 + 2;
  const SG_WK   = PR2 + 3;
  const SG_LINE = PR2 + 7;
  const SG_NAME = PR2 + 8;
  const SG_NIP  = PR2 + 9;

  for (const r of [RK, RK2, RK3]) ws.getRow(r).height = 16;
  ws.getRow(RK + 3).height = 8;
  ws.getRow(PR1).height = 20;
  ws.getRow(PR2).height = 30;
  ws.getRow(SG_CITY).height = 16;
  ws.getRow(SG_WK).height   = 16;
  for (let r = SG_WK + 1; r <= SG_LINE; r++) ws.getRow(r).height = 18;
  ws.getRow(SG_NAME).height = 16;
  ws.getRow(SG_NIP).height  = 16;

  mc(RK, COL_NO, RK, FRAC_E, "Rekapitulasi  :", TNR(11, true), lft);

  mc(RK,  ISA_LBL, RK,  ISA_LBL_E, "I  =", TNR(11), ctr);
  mc(RK2, ISA_LBL, RK2, ISA_LBL_E, "S  =", TNR(11), ctr);
  mc(RK3, ISA_LBL, RK3, ISA_LBL_E, "A  =", TNR(11), ctr);

  mc(RK,  ISA_VAL, RK,  ISA_VAL_E, totalI > 0 ? totalI : null, TNR(11, true), ctr);
  mc(RK2, ISA_VAL, RK2, ISA_VAL_E, totalS > 0 ? totalS : null, TNR(11, true), ctr);
  mc(RK3, ISA_VAL, RK3, ISA_VAL_E, totalA > 0 ? totalA : null, TNR(11, true), ctr);

  const cityStr = schoolCity
    ? `${schoolCity},  ${lastDay} ${monthLabel} ${year}`
    : `${lastDay} ${monthLabel} ${year}`;

  mc(SG_CITY, SIG_COL_S, SG_CITY, SIG_COL_E, cityStr,      TNR(11), lft);
  mc(SG_WK,   SIG_COL_S, SG_WK,   SIG_COL_E, "Wali Kelas", TNR(11), lft);

  mc(SG_NAME, SIG_COL_S, SG_NAME, SIG_COL_E,
    waliKelas || "(__________________________)", TNR(11, !!waliKelas), lft);
  mc(SG_NIP,  SIG_COL_S, SG_NIP,  SIG_COL_E,
    waliKelas ? `NIP. ${waliKelasNip || ""}` : "NIP. __________________________", TNR(11), lft);

  const totalAbsen  = totalI + totalS + totalA;
  const denominator = students.length * effectiveDays;
  const pctStr = denominator > 0
    ? ((totalAbsen / denominator) * 100).toFixed(2) + " %"
    : "----------.";

  mc(PR1, COL_NO, PR1, COL_NIS,  "Presensi",    TNR(11), lft);
  mc(PR1, FRAC_S, PR1, FRAC_E, "Jumlah Absen", TNR(11), ctr, {
    bottom: { style: med },
  });
  mc(PR1, X_S, PR1, X_E, "X", TNR(11), ctr);
  mc(PR1, PCT_S,  PR1, PCT_E,  "100%", TNR(11), ctr);
  mc(PR1, EQ_COL, PR1, EQ_COL, "=",   TNR(11), ctr);
  mc(PR1, RES_S,  PR1, RES_E,  pctStr, TNR(11, true), lft);

  mc(PR2, COL_NO, PR2, COL_NIS, "", TNR(11), lft);
  mc(PR2, FRAC_S, PR2, DENOM_E, "Jumlah Siswa  X  Jumlah hari masuk",
    TNR(11), { ...ctr, wrapText: true });
}

export async function generateMonthlyRecapExcel(
  classId: string,
  year: number,
  month: number,
  schoolCity: string,
  waliKelas: string,
  waliKelasNip: string,
  semesterOverride?: string,
  tahunPelajaranOverride?: string,
): Promise<Buffer> {
  const cls = (await storage.getClasses()).find((c: any) => c.id === classId);
  if (!cls) throw new Error("Kelas tidak ditemukan");
  const wb = new ExcelJS.Workbook();
  await addClassSheetToWorkbook(wb, cls, year, month, schoolCity, waliKelas, waliKelasNip, semesterOverride, tahunPelajaranOverride);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateAllClassesExcel(
  year: number,
  month: number,
  schoolCity: string,
  semesterOverride?: string,
  tahunPelajaranOverride?: string,
): Promise<Buffer> {
  const allClasses = await storage.getClasses();
  const sorted = [...allClasses].sort((a: any, b: any) =>
    a.name.localeCompare(b.name, "id", { numeric: true }),
  );
  if (sorted.length === 0) throw new Error("Tidak ada kelas yang ditemukan");
  const wb = new ExcelJS.Workbook();
  for (const cls of sorted) {
    await addClassSheetToWorkbook(
      wb, cls, year, month, schoolCity,
      (cls as any).wali_kelas || "",
      (cls as any).wali_kelas_nip || "",
      semesterOverride, tahunPelajaranOverride,
    );
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
