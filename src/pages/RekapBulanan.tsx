import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ChevronDown, PowerOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getWebConfig } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const statusColors: Record<string, string> = {
  hadir: "bg-emerald-500 text-white",
  sakit: "bg-amber-500 text-white",
  izin: "bg-blue-500 text-white",
  alpa: "bg-red-500 text-white",
  libur: "bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400",
};

const statusLetters: Record<string, string> = {
  hadir: "H",
  sakit: "S",
  izin: "I",
  alpa: "A",
  libur: "L",
};

const summaryColors = [
  { key: "hadir", label: "H", color: "text-emerald-600 dark:text-emerald-400" },
  { key: "izin",  label: "I", color: "text-blue-600 dark:text-blue-400" },
  { key: "sakit", label: "S", color: "text-amber-600 dark:text-amber-400" },
  { key: "alpa",  label: "A", color: "text-red-600 dark:text-red-400" },
];

const LEGEND = [
  { letter: "H", label: "Hadir", color: "bg-emerald-500 text-white" },
  { letter: "I", label: "Izin",  color: "bg-blue-500 text-white" },
  { letter: "S", label: "Sakit", color: "bg-amber-500 text-white" },
  { letter: "A", label: "Alpa",  color: "bg-red-500 text-white" },
  { letter: "L", label: "Libur", color: "bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400" },
];

const RekapBulanan = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [classId, setClassId] = useState("all");
  const [month, setMonth] = useState(now.getMonth().toString());
  const [year, setYear] = useState(now.getFullYear().toString());
  const [showData, setShowData] = useState(false);

  const [showExcelDialog, setShowExcelDialog] = useState(false);
  const [dialogSemester, setDialogSemester] = useState("1");
  const [dialogTahunPelajaran, setDialogTahunPelajaran] = useState("");

  const autoSemester = (m: number, y: number) => m >= 7 ? "1" : "2";
  const autoTahunPelajaran = (m: number, y: number) => m >= 7 ? `${y} / ${y + 1}` : `${y - 1} / ${y}`;

  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [innerWidth, setInnerWidth] = useState(0);
  const isSyncingRef = useRef(false);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    if (!showData) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setInnerWidth(el.scrollWidth);
    const obs = new ResizeObserver(update);
    obs.observe(el);
    const tableEl = el.querySelector("table");
    if (tableEl) obs.observe(tableEl);
    const timer = setTimeout(update, 150);
    return () => { obs.disconnect(); clearTimeout(timer); };
  }, [showData, classId, month, year]);

  useEffect(() => {
    if (!showData) return;
    const top = topScrollRef.current;
    const main = scrollRef.current;
    if (!top || !main) return;
    const onTopScroll = () => {
      if (isSyncingRef.current) { isSyncingRef.current = false; return; }
      isSyncingRef.current = true;
      main.scrollLeft = top.scrollLeft;
    };
    const onMainScroll = () => {
      if (isSyncingRef.current) { isSyncingRef.current = false; return; }
      isSyncingRef.current = true;
      top.scrollLeft = main.scrollLeft;
    };
    top.addEventListener("scroll", onTopScroll);
    main.addEventListener("scroll", onMainScroll);
    return () => {
      top.removeEventListener("scroll", onTopScroll);
      main.removeEventListener("scroll", onMainScroll);
    };
  }, [showData]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current; if (!el) return;
    dragState.current = { isDragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing"; el.style.userSelect = "none";
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current; if (!el || !dragState.current.isDragging) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }, []);
  const onMouseUp = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    dragState.current.isDragging = false;
    el.style.cursor = "grab"; el.style.userSelect = "";
  }, []);

  useRealtimeSubscription("attendance_records", [["attendance-rekap", classId, month, year]]);
  useRealtimeSubscription("students", [["students-rekap", classId]]);
  useRealtimeSubscription("holidays", [["holidays"]]);

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: attendanceSettings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_settings").select("*");
      return data ?? [];
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*");
      return data ?? [];
    },
  });

  const { data: webConfig } = useQuery<any>({
    queryKey: ["web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const schoolStartDate: string | null = webConfig?.school_start_date || null;

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students-rekap", classId],
    queryFn: async () => {
      let q = supabase.from("students").select("*, classes(name, wali_kelas, wali_kelas_nip)").order("name");
      if (classId !== "all") q = q.eq("class_id", classId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: showData,
  });

  const sortedClasses = useMemo(() =>
    [...classes].sort((a: any, b: any) => a.name.localeCompare(b.name, "id", { numeric: true })),
    [classes]
  );

  const studentsByClass = useMemo(() => {
    if (classId !== "all") return null;
    const map: Record<string, any[]> = {};
    students.forEach((s: any) => {
      if (!map[s.class_id]) map[s.class_id] = [];
      map[s.class_id].push(s);
    });
    return map;
  }, [students, classId]);

  const startDate = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-01`;
  const endDate = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-rekap", classId, month, year],
    queryFn: async () => {
      let qHadir = supabase.from("attendance_records").select("*").eq("status", "hadir").gte("date", startDate).lte("date", endDate);
      let qAlpa = supabase.from("attendance_records").select("*").eq("status", "alpa").gte("date", startDate).lte("date", endDate);
      let qValid = supabase.from("attendance_records").select("*").in("status", ["izin", "sakit"]).eq("validation_status", "approved").gte("date", startDate).lte("date", endDate);
      if (classId !== "all") {
        qHadir = qHadir.eq("class_id", classId);
        qAlpa = qAlpa.eq("class_id", classId);
        qValid = qValid.eq("class_id", classId);
      }
      const [r1, r2, r3] = await Promise.all([qHadir, qAlpa, qValid]);
      return [...(r1.data ?? []), ...(r2.data ?? []), ...(r3.data ?? [])];
    },
    enabled: showData,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const dayStatus = useMemo(() => {
    const result: Record<number, "active" | "holiday" | "disabled" | "future"> = {};
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(yearNum, monthNum, d);
      const dayName = DAY_NAMES_ID[date.getDay()];
      if (date > today) { result[d] = "future"; continue; }
      const dateStr = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (schoolStartDate && dateStr < schoolStartDate) { result[d] = "disabled"; continue; }
      const isHoliday = holidays.some((h: any) => dateStr >= h.start_date && dateStr <= h.end_date);
      if (isHoliday) { result[d] = "holiday"; continue; }
      const setting = attendanceSettings.find((s: any) => s.day_of_week === dayName);
      if (!setting || !setting.enabled) { result[d] = "disabled"; continue; }
      result[d] = "active";
    }
    return result;
  }, [daysInMonth, yearNum, monthNum, holidays, attendanceSettings, schoolStartDate]);

  const effectiveDays = useMemo(() => Object.values(dayStatus).filter(s => s === "active").length, [dayStatus]);

  const recordMap = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    records.forEach((r: any) => {
      const day = new Date(r.date).getDate();
      if (!map[r.student_id]) map[r.student_id] = {};
      map[r.student_id][day] = r.status;
    });
    return map;
  }, [records]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  const nowTimeStr = useMemo(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  }, []);

  const todayCheckInEnd = useMemo(() => {
    const todayDayName = DAY_NAMES_ID[new Date().getDay()];
    const setting = (attendanceSettings as any[]).find((s: any) => s.day_of_week === todayDayName);
    return setting?.check_in_end || null;
  }, [attendanceSettings]);

  const allCellStatuses = useMemo(() => {
    const result: Record<string, Record<number, string>> = {};
    if (students.length === 0) return result;
    for (const s of students as any[]) {
      const studentMap: Record<number, string> = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = dayStatus[d];
        if (ds === "future") { studentMap[d] = "future"; continue; }
        if (ds === "holiday" || ds === "disabled") { studentMap[d] = "libur"; continue; }
        const record = recordMap[s.id]?.[d];
        if (record) { studentMap[d] = record; continue; }
        const dateStr = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (dateStr < todayStr) { studentMap[d] = "alpa"; continue; }
        if (dateStr === todayStr && todayCheckInEnd && nowTimeStr > todayCheckInEnd) { studentMap[d] = "alpa"; continue; }
        studentMap[d] = "nodata";
      }
      result[s.id] = studentMap;
    }
    return result;
  }, [students, daysInMonth, dayStatus, recordMap, yearNum, monthNum, todayStr, todayCheckInEnd, nowTimeStr]);

  const allSummaries = useMemo(() => {
    const result: Record<string, { hadir: number; sakit: number; izin: number; alpa: number; pct: number }> = {};
    for (const s of students as any[]) {
      const counts = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
      const statuses = allCellStatuses[s.id] || {};
      for (let d = 1; d <= daysInMonth; d++) {
        const st = statuses[d];
        if (st && st in counts) counts[st as keyof typeof counts]++;
      }
      const pct = effectiveDays > 0 ? Math.round((counts.hadir / effectiveDays) * 100) : 0;
      result[s.id] = { ...counts, pct };
    }
    return result;
  }, [students, allCellStatuses, daysInMonth, effectiveDays]);

  const getClassName = () => {
    if (classId === "all") return "Semua Kelas";
    return classes.find((c: any) => c.id === classId)?.name || "";
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (students.length === 0) { toast({ title: "Tidak ada data siswa", variant: "destructive" }); return; }
    setDialogSemester(autoSemester(monthNum + 1, yearNum));
    setDialogTahunPelajaran(autoTahunPelajaran(monthNum + 1, yearNum));
    setShowExcelDialog(true);
  };

  const doExportExcelWord = () => {
    if (students.length === 0) { toast({ title: "Tidak ada data siswa", variant: "destructive" }); return; }
    let html: string;
    let filename: string;
    if (classId === "all") {
      html = buildAllClassesWordDoc();
      filename = `Presensi_Semua_Kelas_${MONTHS[monthNum]}_${yearNum}.xls`;
    } else {
      html = buildWordDoc();
      const cls = (classes as any[]).find((c: any) => c.id === classId);
      const className = cls?.name?.replace(/\s+/g, "_") || classId;
      filename = `Presensi_${className}_${MONTHS[monthNum]}_${yearNum}.xls`;
    }
    const blob = new Blob(['\ufeff' + html], { type: "application/vnd.ms-excel" });
    downloadBlob(blob, filename);
    setShowExcelDialog(false);
    toast({ title: "File Excel berhasil diunduh" });
  };

  const handleExportWord = () => {
    if (students.length === 0) { toast({ title: "Tidak ada data siswa", variant: "destructive" }); return; }
    let html: string;
    let filename: string;
    if (classId === "all") {
      html = buildAllClassesWordDoc();
      filename = `Presensi_Semua_Kelas_${MONTHS[monthNum]}_${yearNum}.doc`;
    } else {
      html = buildWordDoc();
      const cls = (classes as any[]).find((c: any) => c.id === classId);
      const className = cls?.name?.replace(/\s+/g, "_") || classId;
      filename = `Presensi_${className}_${MONTHS[monthNum]}_${yearNum}.doc`;
    }
    const blob = new Blob(['\ufeff' + html], { type: "application/msword" });
    downloadBlob(blob, filename);
    toast({ title: "File Word berhasil diunduh" });
  };

  const wrapWordDocHtml = (body: string) => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Times New Roman', serif; font-size: 10pt; margin: 0; }
.main-tbl { border-collapse: collapse; width: 100%; font-size: 8pt; }
.main-tbl th, .main-tbl td { border: 1px solid #000; padding: 2px; }
.pagebreak { page-break-before: always; margin: 0; }
</style>
</head><body>${body}</body></html>`;
  };

  const buildWordDocBodyForClass = (clsObj: any, studentsArr: any[]) => {
    const m = monthNum + 1;
    const sem = autoSemester(m, yearNum);
    const tahun = autoTahunPelajaran(m, yearNum);
    const className = clsObj?.name || "";
    const waliKelas = clsObj?.wali_kelas || clsObj?.classes?.wali_kelas || "";
    const waliKelasNip = clsObj?.wali_kelas_nip || clsObj?.classes?.wali_kelas_nip || "";
    const schoolCity = webConfig?.school_city || "";
    const laki = studentsArr.filter((s: any) => s.gender === "L").length;
    const perempuan = studentsArr.filter((s: any) => s.gender === "P").length;
    let totalI = 0, totalS = 0, totalA = 0;
    studentsArr.forEach((s: any) => {
      const sum = allSummaries[s.id] || { izin: 0, sakit: 0, alpa: 0 };
      totalI += sum.izin; totalS += sum.sakit; totalA += sum.alpa;
    });
    const totalAbsen = totalI + totalS + totalA;
    const denom = studentsArr.length * effectiveDays;
    const pctStr = denom > 0 ? ((totalAbsen / denom) * 100).toFixed(2) + " %" : "----------";
    const cityDate = schoolCity
      ? `${schoolCity},  ${daysInMonth} ${MONTHS[monthNum]} ${yearNum}`
      : `${daysInMonth} ${MONTHS[monthNum]} ${yearNum}`;

    const th = (txt: string, rowspan = 1, colspan = 1, w = "") =>
      `<th rowspan="${rowspan}" colspan="${colspan}" style="background:#000;color:#fff;text-align:center;font-size:8.5pt;padding:2px;${w ? `width:${w};` : ''}">${txt}</th>`;

    const dayHeaders2 = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const isWeekend = new Date(yearNum, monthNum, d).getDay() % 6 === 0;
      return `<th style="background:${isWeekend ? '#888' : '#000'};color:#fff;text-align:center;font-size:7pt;padding:1px;">${d}</th>`;
    }).join("");

    const bodyRows = studentsArr.map((s: any, i: number) => {
      const sum = allSummaries[s.id] || { izin: 0, sakit: 0, alpa: 0 };
      const statuses = allCellStatuses[s.id] || {};
      const dayTds = Array.from({ length: daysInMonth }, (_, d) => {
        const st = statuses[d + 1];
        const c = (!st || st === "future" || st === "nodata") ? "" : st === "libur" ? "L" : statusLetters[st] || "";
        return `<td style="text-align:center;font-size:7pt;padding:1px;">${c}</td>`;
      }).join("");
      return `<tr>
        <td style="text-align:center;font-size:9pt;">${i + 1}</td>
        <td style="text-align:center;font-size:8pt;">${s.nis || ""}</td>
        <td style="font-size:9pt;">${s.name}</td>
        <td style="text-align:center;font-size:9pt;">${s.gender || ""}</td>
        ${dayTds}
        <td style="text-align:center;font-size:9pt;">${sum.izin || ""}</td>
        <td style="text-align:center;font-size:9pt;">${sum.sakit || ""}</td>
        <td style="text-align:center;font-size:9pt;">${sum.alpa || ""}</td>
      </tr>`;
    }).join("");

    return `<p style="text-align:center;font-size:14pt;font-weight:bold;margin:0 0 3pt 0;font-family:'Times New Roman',serif;">PRESENSI KELAS ${className}</p>
<table class="info-tbl" style="width:100%;border-collapse:collapse;margin-bottom:4pt;"><tr>
  <td style="border:none;font-size:10pt;font-family:'Times New Roman',serif;">Semester  :  ${sem}</td>
  <td style="border:none;text-align:center;font-size:10pt;font-family:'Times New Roman',serif;">Bulan  :  ${MONTHS[monthNum]} ${yearNum}</td>
  <td style="border:none;text-align:center;font-size:10pt;font-family:'Times New Roman',serif;">L = ${laki}&nbsp;&nbsp;&nbsp;P = ${perempuan}</td>
  <td style="border:none;text-align:right;font-size:10pt;font-family:'Times New Roman',serif;">Tahun Pelajaran  :  ${tahun}</td>
</tr></table>
<table class="main-tbl"><thead><tr>
  ${th("NO", 2, 1, "1%")}
  ${th("INDUK", 2, 1, "5%")}
  ${th("NAMA", 2, 1, "20%")}
  ${th("L/P", 2, 1, "1%")}
  ${th("TANGGAL", 1, daysInMonth)}
  ${th("KET", 1, 3, "5%")}
</tr><tr>
  ${dayHeaders2}
  <th style="background:#000;color:#fff;font-size:8pt;text-align:center;">I</th>
  <th style="background:#000;color:#fff;font-size:8pt;text-align:center;">S</th>
  <th style="background:#000;color:#fff;font-size:8pt;text-align:center;">A</th>
</tr></thead><tbody>${bodyRows}</tbody></table>
<p style="margin:10pt 0 1pt 0;font-size:10pt;font-family:'Times New Roman',serif;"><strong>Rekapitulasi :</strong></p>
<p style="margin:1pt 0 1pt 32pt;font-size:10pt;font-family:'Times New Roman',serif;">I &nbsp;&nbsp;=&nbsp;&nbsp;${totalI > 0 ? totalI : ""}</p>
<p style="margin:1pt 0 1pt 32pt;font-size:10pt;font-family:'Times New Roman',serif;">S &nbsp;&nbsp;=&nbsp;&nbsp;${totalS > 0 ? totalS : ""}</p>
<p style="margin:1pt 0 8pt 32pt;font-size:10pt;font-family:'Times New Roman',serif;">A &nbsp;&nbsp;=&nbsp;&nbsp;${totalA > 0 ? totalA : ""}</p>
<table style="border-collapse:collapse;margin:0 0 0 0;">
  <tr>
    <td style="border:none;padding:0 8pt 0 0;font-size:10pt;font-family:'Times New Roman',serif;vertical-align:middle;white-space:nowrap;">Presensi</td>
    <td style="border:none;padding:0 4pt;font-size:10pt;font-family:'Times New Roman',serif;vertical-align:middle;">=</td>
    <td style="border:none;padding:0;vertical-align:middle;text-align:center;">
      <div style="font-size:9pt;font-family:'Times New Roman',serif;border-bottom:1pt solid #000;text-align:center;padding:0 12pt 2pt 12pt;line-height:1.3;">Jumlah Absen</div>
      <div style="font-size:9pt;font-family:'Times New Roman',serif;text-align:center;padding:2pt 12pt 0 12pt;line-height:1.3;">Jumlah Siswa &times; Jumlah hari masuk</div>
    </td>
    <td style="border:none;padding:0 0 0 6pt;font-size:10pt;font-family:'Times New Roman',serif;vertical-align:middle;white-space:nowrap;">&times; 100% &nbsp;=&nbsp; <strong>${pctStr}</strong></td>
  </tr>
</table>
<div style="text-align:right;margin-top:16pt;">
  <p style="margin:0;font-size:10pt;font-family:'Times New Roman',serif;">${cityDate}</p>
  <p style="margin:4pt 0 0 0;font-size:10pt;font-family:'Times New Roman',serif;">Wali Kelas,</p>
  <p style="margin:30pt 0 0 0;font-size:10pt;font-family:'Times New Roman',serif;"><strong>${waliKelas || "(__________________________)"}</strong></p>
  <p style="margin:2pt 0 0 0;font-size:10pt;font-family:'Times New Roman',serif;">NIP. ${waliKelasNip || "__________________________"}</p>
</div>`;
  };

  const buildWordDoc = () => {
    const cls = (classes as any[]).find((c: any) => c.id === classId);
    return wrapWordDocHtml(buildWordDocBodyForClass(cls, students as any[]));
  };

  const buildAllClassesWordDoc = () => {
    const bodies = sortedClasses.map((cls: any) => {
      const studentsForClass = (studentsByClass?.[cls.id] || [])
        .slice()
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "id"));
      return buildWordDocBodyForClass(cls, studentsForClass);
    });
    return wrapWordDocHtml(bodies.join('<div class="pagebreak"></div>'));
  };

  const appendClassPagesToPDF = (doc: jsPDF, clsObj: any, studentsArr: any[]) => {
    const m = monthNum + 1;
    const sem = autoSemester(m, yearNum);
    const tahun = autoTahunPelajaran(m, yearNum);
    const className = clsObj?.name || "";
    const waliKelas = clsObj?.wali_kelas || clsObj?.classes?.wali_kelas || "";
    const waliKelasNip = clsObj?.wali_kelas_nip || clsObj?.classes?.wali_kelas_nip || "";
    const schoolCity = webConfig?.school_city || "";
    const laki = studentsArr.filter((s: any) => s.gender === "L").length;
    const perempuan = studentsArr.filter((s: any) => s.gender === "P").length;
    let totalI = 0, totalS = 0, totalA = 0;
    studentsArr.forEach((s: any) => {
      const sum = allSummaries[s.id] || { izin: 0, sakit: 0, alpa: 0 };
      totalI += sum.izin; totalS += sum.sakit; totalA += sum.alpa;
    });
    const totalAbsen = totalI + totalS + totalA;
    const denom = studentsArr.length * effectiveDays;
    const pctStr = denom > 0 ? ((totalAbsen / denom) * 100).toFixed(2) + " %" : "----------";
    const cityDate = schoolCity
      ? `${schoolCity},  ${daysInMonth} ${MONTHS[monthNum]} ${yearNum}`
      : `${daysInMonth} ${MONTHS[monthNum]} ${yearNum}`;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const mg = 10;
    const noW = 7;
    const nisW = 16;
    const lpW = 6;
    const ketW = 7;
    const fixedW = noW + nisW + lpW + ketW * 3;
    const nameW = Math.min(55, pageWidth - mg * 2 - fixedW - daysInMonth * 5.2);
    const usableForDays = pageWidth - mg * 2 - noW - nisW - nameW - lpW - ketW * 3;
    const dayW = Math.max(Math.min(usableForDays / daysInMonth, 6.4), 5.0);
    const totalW = noW + nisW + nameW + lpW + dayW * daysInMonth + ketW * 3;
    const rowH = 6.5;
    const hdr1H = 7;
    const hdr2H = 6;
    const BLACK: [number,number,number] = [0, 0, 0];
    const GRAY: [number,number,number] = [120, 120, 120];
    const COL_I: [number,number,number] = [37, 99, 235];
    const COL_S: [number,number,number] = [217, 119, 6];
    const COL_A: [number,number,number] = [220, 38, 38];
    const COL_H: [number,number,number] = [22, 163, 74];
    const COL_L: [number,number,number] = [180, 180, 180];
    const statusPdfColors: Record<string, [number,number,number]> = { H: COL_H, S: COL_S, I: COL_I, A: COL_A, L: COL_L };

    let y = mg;

    doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text(`PRESENSI KELAS ${className}`, pageWidth / 2, y + 5, { align: "center" });
    y += 10;
    doc.setFont("times", "normal"); doc.setFontSize(9);
    const infoY = y + 4;
    doc.text(`Semester  :  ${sem}`, mg, infoY);
    doc.text(`Bulan  :  ${MONTHS[monthNum]} ${yearNum}`, pageWidth * 0.3, infoY);
    doc.text(`L = ${laki}     P = ${perempuan}`, pageWidth * 0.55, infoY);
    doc.text(`Tahun Pelajaran  :  ${tahun}`, pageWidth * 0.72, infoY);
    y += 10;

    const drawHdrCell = (lx: number, ly: number, w: number, h: number, label: string, bg: [number,number,number]) => {
      doc.setFillColor(bg[0], bg[1], bg[2]); doc.setDrawColor(255, 255, 255);
      doc.rect(lx, ly, w, h, "FD");
      doc.setTextColor(255, 255, 255); doc.setFont("times", "bold"); doc.setFontSize(6);
      doc.text(label, lx + w / 2, ly + h / 2 + 1, { align: "center" });
    };
    const drawHdrRow1 = (baseY: number) => {
      let hx = mg;
      drawHdrCell(hx, baseY, noW, hdr1H + hdr2H, "NO", BLACK); hx += noW;
      drawHdrCell(hx, baseY, nisW, hdr1H + hdr2H, "INDUK", BLACK); hx += nisW;
      drawHdrCell(hx, baseY, nameW, hdr1H + hdr2H, "NAMA", BLACK); hx += nameW;
      drawHdrCell(hx, baseY, lpW, hdr1H + hdr2H, "L/P", BLACK); hx += lpW;
      drawHdrCell(hx, baseY, dayW * daysInMonth, hdr1H, "TANGGAL", BLACK); hx += dayW * daysInMonth;
      drawHdrCell(hx, baseY, ketW * 3, hdr1H, "KET", BLACK);
    };
    const drawHdrRow2 = (baseY: number) => {
      let hx = mg + noW + nisW + nameW + lpW;
      for (let d = 1; d <= daysInMonth; d++) {
        const isWeek = new Date(yearNum, monthNum, d).getDay() % 6 === 0;
        drawHdrCell(hx, baseY + hdr1H, dayW, hdr2H, String(d), isWeek ? GRAY : BLACK);
        hx += dayW;
      }
      drawHdrCell(hx, baseY + hdr1H, ketW, hdr2H, "I", COL_I); hx += ketW;
      drawHdrCell(hx, baseY + hdr1H, ketW, hdr2H, "S", COL_S); hx += ketW;
      drawHdrCell(hx, baseY + hdr1H, ketW, hdr2H, "A", COL_A);
    };

    drawHdrRow1(y); drawHdrRow2(y); y += hdr1H + hdr2H;

    const addPageHeader = () => {
      doc.addPage(); y = mg;
      drawHdrRow1(y); drawHdrRow2(y); y += hdr1H + hdr2H;
    };

    doc.setDrawColor(200, 200, 200);
    studentsArr.forEach((s: any, idx: number) => {
      if (y + rowH > pageHeight - 42) addPageHeader();
      const sum = allSummaries[s.id] || { izin: 0, sakit: 0, alpa: 0 };
      const statuses = allCellStatuses[s.id] || {};
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 249, isEven ? 255 : 250);
      doc.setDrawColor(200, 200, 200); doc.rect(mg, y, totalW, rowH, "FD");
      doc.setFont("times", "normal"); doc.setFontSize(6); doc.setTextColor(0, 0, 0);
      let cx = mg;
      doc.text(String(idx + 1), cx + noW / 2, y + rowH / 2 + 1, { align: "center" }); cx += noW;
      doc.text(s.nis || "", cx + nisW / 2, y + rowH / 2 + 1, { align: "center" }); cx += nisW;
      const maxN = Math.floor(nameW / 1.65);
      const dname = s.name.length > maxN ? s.name.slice(0, maxN - 1) + "." : s.name;
      doc.setFont("times", "bold"); doc.text(dname, cx + 1, y + rowH / 2 + 1); cx += nameW;
      doc.setFont("times", "normal"); doc.text(s.gender || "", cx + lpW / 2, y + rowH / 2 + 1, { align: "center" }); cx += lpW;
      for (let d = 1; d <= daysInMonth; d++) {
        const st = statuses[d];
        const c = (!st || st === "future" || st === "nodata") ? "" : st === "libur" ? "L" : statusLetters[st] || "";
        if (c && statusPdfColors[c]) {
          const [r2, g2, b2] = statusPdfColors[c];
          doc.setFillColor(r2, g2, b2);
          doc.roundedRect(cx + 0.3, y + 0.5, dayW - 0.6, rowH - 1, 0.3, 0.3, "F");
          doc.setTextColor(c === "L" ? 80 : 255, c === "L" ? 80 : 255, c === "L" ? 80 : 255);
          doc.setFontSize(5.2);
          doc.text(c, cx + dayW / 2, y + rowH / 2 + 1, { align: "center" });
        }
        doc.setTextColor(0, 0, 0); doc.setFontSize(6); cx += dayW;
      }
      [[sum.izin, COL_I], [sum.sakit, COL_S], [sum.alpa, COL_A]].forEach(([val, col]) => {
        const [r2, g2, b2] = col as [number,number,number];
        doc.setTextColor(r2, g2, b2); doc.setFont("times", "bold"); doc.setFontSize(6);
        const v = (val as number) > 0 ? String(val) : "";
        doc.text(v, cx + ketW / 2, y + rowH / 2 + 1, { align: "center" }); cx += ketW;
      });
      doc.setTextColor(0, 0, 0); doc.setFont("times", "normal"); y += rowH;
    });

    if (y + 48 > pageHeight) { doc.addPage(); y = mg; }
    y += 4;
    doc.setFont("times", "bold"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text("Rekapitulasi  :", mg, y + 4);
    doc.setFont("times", "normal");
    const isaY = [y + 4, y + 9, y + 14];
    const isaLabels = [`I  =  ${totalI > 0 ? totalI : ""}`, `S  =  ${totalS > 0 ? totalS : ""}`, `A  =  ${totalA > 0 ? totalA : ""}`];
    isaLabels.forEach((lbl, i) => { doc.text(lbl, mg + 32, isaY[i]); });

    const fracX = mg; const fracY = y + 22;
    doc.setFont("times", "normal"); doc.setFontSize(9);
    doc.text("Presensi", fracX, fracY);
    const fracLabelX = fracX + 22;
    doc.setFontSize(8);
    doc.text("Jumlah Absen", fracLabelX, fracY - 2);
    doc.setDrawColor(0, 0, 0); doc.line(fracLabelX - 1, fracY, fracLabelX + 37, fracY);
    doc.text("Jumlah Siswa × Jumlah hari masuk", fracLabelX, fracY + 5);
    doc.setFontSize(9); doc.text(`× 100%  =  ${pctStr}`, fracLabelX + 41, fracY + 1);

    const sigX = pageWidth * 0.62; const sigY = y + 4;
    doc.setFont("times", "normal"); doc.setFontSize(9);
    doc.text(cityDate, sigX, sigY);
    doc.text("Wali Kelas,", sigX, sigY + 5);
    doc.setFont("times", "bold"); doc.text(waliKelas || "(                         )", sigX, sigY + 26);
    doc.setFont("times", "normal"); doc.text(`NIP. ${waliKelasNip || "                          "}`, sigX, sigY + 31);
  };

  const generateAttendancePDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const cls = (classes as any[]).find((c: any) => c.id === classId);
    appendClassPagesToPDF(doc, cls, students as any[]);
    return doc;
  };

  const generateAllClassesPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    sortedClasses.forEach((cls: any, idx: number) => {
      if (idx > 0) doc.addPage();
      const studentsForClass = (studentsByClass?.[cls.id] || [])
        .slice()
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "id"));
      appendClassPagesToPDF(doc, cls, studentsForClass);
    });
    return doc;
  };

  const handleExportPDF = () => {
    if (students.length === 0) { toast({ title: "Tidak ada data siswa", variant: "destructive" }); return; }
    if (classId === "all") {
      const doc = generateAllClassesPDF();
      doc.save(`Presensi_Semua_Kelas_${MONTHS[monthNum]}_${yearNum}.pdf`);
    } else {
      const doc = generateAttendancePDF();
      const cls = (classes as any[]).find((c: any) => c.id === classId);
      const className = cls?.name?.replace(/\s+/g, "_") || classId;
      doc.save(`Presensi_${className}_${MONTHS[monthNum]}_${yearNum}.pdf`);
    }
    toast({ title: "File PDF berhasil diunduh" });
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-none shadow-lg bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)]">
        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Rekapitulasi Bulanan</h1>
            <p className="text-white/80 text-sm">Data otomatis diambil dari Laporan Harian</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={classId} onValueChange={v => { setClassId(v); setShowData(false); }}>
              <SelectTrigger className="w-40 bg-white/20 border-white/30 text-white placeholder:text-white/60">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {sortedClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={v => { setMonth(v); setShowData(false); }}>
              <SelectTrigger className="w-36 bg-white/20 border-white/30 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={v => { setYear(v); setShowData(false); }}>
              <SelectTrigger className="w-28 bg-white/20 border-white/30 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setShowData(true);
                queryClient.invalidateQueries({ queryKey: ["students-rekap"] });
                queryClient.invalidateQueries({ queryKey: ["attendance-rekap"] });
              }}
              className="bg-white text-primary hover:bg-white/90 font-semibold"
            >
              <Search className="h-4 w-4 mr-2" />Tampilkan
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                  <Download className="h-4 w-4 mr-2" />Export<ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportExcel}>📊 Export Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>📕 Export PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord}>📝 Export Word</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const todayDate = new Date();
        const todayDayName = DAY_NAMES_ID[todayDate.getDay()];
        const todaySetting = (attendanceSettings as any[]).find((s: any) => s.day_of_week === todayDayName);
        const isTodayEnabled = !todaySetting || todaySetting.enabled === true;
        const isCurrentMonth = todayDate.getMonth() === monthNum && todayDate.getFullYear() === yearNum;
        if (!isTodayEnabled && isCurrentMonth) {
          return (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <PowerOff className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-slate-600 dark:text-slate-300">Absensi Hari Ini Belum Aktif</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Pengaturan waktu absensi hari <span className="font-medium">{todayDayName}</span> belum diaktifkan.
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {!showData && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Search className="h-8 w-8 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Pilih filter lalu klik <span className="text-primary">Tampilkan</span></p>
            <p className="text-sm text-muted-foreground mt-1">Pilih kelas, bulan, dan tahun — kemudian klik tombol Tampilkan untuk memuat data rekap.</p>
          </div>
        </div>
      )}

      {showData && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-card rounded-lg px-4 py-3 border shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {LEGEND.map(lg => (
                <span key={lg.label} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold ${lg.color}`}>{lg.letter}</span>
                  <span className="text-muted-foreground text-xs">{lg.label}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>Hari Efektif: <strong className="text-foreground">{effectiveDays} hari</strong></span>
              <span>% = (H ÷ {effectiveDays}) × 100</span>
            </div>
          </div>

          <div className="hidden md:block space-y-3">
            <div ref={topScrollRef} className="overflow-x-auto rounded-lg" style={{ height: 14 }}>
              <div style={{ width: innerWidth, height: 1 }} />
            </div>
            <Card className="shadow-lg" style={{ overflow: "clip" }}>
              <CardContent className="p-0">
                <div
                  ref={scrollRef}
                  className="overflow-x-auto cursor-grab select-none drag-scroll"
                  style={{ scrollbarWidth: "none", touchAction: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                >
                  <table className="caption-bottom text-sm" style={{ width: `${daysInMonth * 36 + 380}px`, minWidth: "100%" }}>
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 bg-muted/90 z-20 w-12 h-10 px-2 text-center font-bold align-middle">NO</th>
                        <th className="sticky left-12 bg-muted/90 z-20 min-w-[140px] h-10 px-3 text-left font-bold align-middle">NAMA SISWA</th>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i} className="w-9 h-10 px-1 text-center font-bold text-xs align-middle">{i + 1}</th>
                        ))}
                        {summaryColors.map(s => (
                          <th key={s.key} className={`w-9 h-10 px-1 text-center font-bold text-xs align-middle ${s.color}`}>{s.label}</th>
                        ))}
                        <th className="w-12 h-10 px-2 text-center font-bold align-middle">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b animate-pulse">
                            <td className="w-12 px-2 py-3 text-center"><div className="h-4 bg-muted rounded mx-auto w-6" /></td>
                            <td className="min-w-[140px] px-3 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                            {Array.from({ length: Math.min(daysInMonth, 10) }).map((_, d) => (
                              <td key={d} className="w-9 px-1 py-3 text-center"><div className="h-6 w-6 bg-muted rounded mx-auto" /></td>
                            ))}
                            <td colSpan={daysInMonth - 10 + 5} />
                          </tr>
                        ))
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan={daysInMonth + 7} className="text-center py-12 text-muted-foreground align-middle">
                            Tidak ada data siswa
                          </td>
                        </tr>
                      ) : classId !== "all" ? (
                        (students as any[]).map((s: any, i: number) => {
                          const summary = allSummaries[s.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0, pct: 0 };
                          const statuses = allCellStatuses[s.id] || {};
                          return (
                            <tr key={s.id} className="border-b transition-colors hover:bg-muted/30">
                              <td className="sticky left-0 bg-card z-10 w-12 px-2 py-2 text-center text-muted-foreground text-xs align-middle">{i + 1}</td>
                              <td className="sticky left-12 bg-card z-10 min-w-[140px] px-3 py-2 font-medium text-sm whitespace-nowrap align-middle">{s.name}</td>
                              {Array.from({ length: daysInMonth }, (_, d) => {
                                const status = statuses[d + 1];
                                if (!status || status === "future" || status === "nodata") return <td key={d} className="w-9 px-1 text-center align-middle" />;
                                const colorClass = statusColors[status] || "";
                                const letter = status === "libur" ? "L" : statusLetters[status] || "";
                                return (
                                  <td key={d} className="w-9 px-1 py-1.5 text-center align-middle">
                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold ${colorClass}`}>{letter}</span>
                                  </td>
                                );
                              })}
                              {summaryColors.map(sc => (
                                <td key={sc.key} className={`w-9 px-1 text-center font-bold text-sm align-middle ${sc.color}`}>
                                  {summary[sc.key as keyof typeof summary]}
                                </td>
                              ))}
                              <td className="w-12 px-2 text-center font-bold text-sm align-middle">{summary.pct}%</td>
                            </tr>
                          );
                        })
                      ) : (
                        sortedClasses.flatMap((cls: any) => {
                          const classStudents = studentsByClass?.[cls.id] || [];
                          if (classStudents.length === 0) return [];
                          return [
                            <tr key={`header-${cls.id}`} className="bg-gradient-to-r from-primary/10 to-primary/5 border-y border-primary/20">
                              <td colSpan={daysInMonth + 7} className="py-2 px-4 font-bold text-primary text-sm align-middle">
                                📋 Kelas {cls.name} — {classStudents.length} Siswa
                              </td>
                            </tr>,
                            ...classStudents.map((s: any, i: number) => {
                              const summary = allSummaries[s.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0, pct: 0 };
                              const statuses = allCellStatuses[s.id] || {};
                              return (
                                <tr key={s.id} className="border-b transition-colors hover:bg-muted/30">
                                  <td className="sticky left-0 bg-card z-10 w-12 px-2 py-2 text-center text-muted-foreground text-xs align-middle">{i + 1}</td>
                                  <td className="sticky left-12 bg-card z-10 min-w-[140px] px-3 py-2 font-medium text-sm whitespace-nowrap align-middle">{s.name}</td>
                                  {Array.from({ length: daysInMonth }, (_, d) => {
                                    const status = statuses[d + 1];
                                    if (!status || status === "future" || status === "nodata") return <td key={d} className="w-9 px-1 text-center align-middle" />;
                                    const colorClass = statusColors[status] || "";
                                    const letter = status === "libur" ? "L" : statusLetters[status] || "";
                                    return (
                                      <td key={d} className="w-9 px-1 py-1.5 text-center align-middle">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold ${colorClass}`}>{letter}</span>
                                      </td>
                                    );
                                  })}
                                  {summaryColors.map(sc => (
                                    <td key={sc.key} className={`w-9 px-1 text-center font-bold text-sm align-middle ${sc.color}`}>
                                      {summary[sc.key as keyof typeof summary]}
                                    </td>
                                  ))}
                                  <td className="w-12 px-2 text-center font-bold text-sm align-middle">{summary.pct}%</td>
                                </tr>
                              );
                            }),
                          ];
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden space-y-2">
            {studentsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border shadow-sm p-3 animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-40" />
                  <div className="flex gap-2">{Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-6 w-14 bg-muted rounded" />)}</div>
                  <div className="flex flex-wrap gap-1">{Array.from({ length: 10 }).map((_, j) => <div key={j} className="h-7 w-7 bg-muted rounded" />)}</div>
                </div>
              ))
            ) : (students as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Tidak ada data siswa</p>
            ) : (
              (classId !== "all" ? students as any[] : sortedClasses.flatMap((cls: any) => (studentsByClass?.[cls.id] || []))).map((s: any, i: number) => {
                const summary = allSummaries[s.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0, pct: 0 };
                const statuses = allCellStatuses[s.id] || {};
                return (
                  <div key={s.id} className="bg-card rounded-xl border shadow-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-5">{i + 1}.</span>
                        <span className="font-semibold text-sm">{s.name}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{summary.pct}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">H:{summary.hadir}</span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">I:{summary.izin}</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold">S:{summary.sakit}</span>
                      <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">A:{summary.alpa}</span>
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {Array.from({ length: daysInMonth }, (_, d) => {
                        const status = statuses[d + 1];
                        if (!status || status === "future" || status === "nodata") {
                          return <span key={d} className="w-7 h-7 rounded text-[10px] flex items-center justify-center bg-muted text-muted-foreground font-medium">{d + 1}</span>;
                        }
                        const colorClass = statusColors[status] || "bg-muted text-muted-foreground";
                        const letter = status === "libur" ? "L" : statusLetters[status] || "?";
                        return (
                          <span key={d} className={`w-7 h-7 rounded text-[10px] flex items-center justify-center font-bold ${colorClass}`} title={`Tgl ${d + 1}: ${status}`}>
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <Dialog open={showExcelDialog} onOpenChange={setShowExcelDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📊 Export Excel / Word
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">Semester</Label>
              <Select value={dialogSemester} onValueChange={setDialogSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 1 (Ganjil)</SelectItem>
                  <SelectItem value="2">Semester 2 (Genap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Tahun Pelajaran</Label>
              <Input
                value={dialogTahunPelajaran}
                onChange={e => setDialogTahunPelajaran(e.target.value)}
                placeholder="Contoh: 2024 / 2025"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExcelDialog(false)}>Batal</Button>
            <Button onClick={doExportExcelWord} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              📊 Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RekapBulanan;
