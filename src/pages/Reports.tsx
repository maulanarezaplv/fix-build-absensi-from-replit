import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getWebConfig } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, ChevronDown, Pencil, PowerOff, FileBarChart2, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import jsPDF from "jspdf";

type AttendanceStatus = "hadir" | "izin" | "sakit" | "alpa";

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

const Reports = () => {
  const queryClient = useQueryClient();
  useRealtimeSubscription("attendance_records", [["report-records"]]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [classId, setClassId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ recordId, studentId, classId: cId, date, newStatus }: { recordId?: string; studentId: string; classId: string; date: string; newStatus: AttendanceStatus }) => {
      if (recordId) {
        return apiRequest("PATCH", `/api/attendance/${recordId}`, { status: newStatus });
      } else {
        return apiRequest("POST", "/api/attendance", {
          records: [{
            student_id: studentId,
            class_id: cId,
            date,
            status: newStatus,
            validation_status: "approved",
          }]
        });
      }
    },
    onSuccess: () => {
      toast.success("Status berhasil diubah");
      queryClient.invalidateQueries({ queryKey: ["report-records"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-rekap"] });
    },
    onError: () => {
      toast.error("Gagal mengubah status");
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then(r => r.json()),
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["all-students"],
    queryFn: () => fetch("/api/students", { credentials: "include" }).then(r => r.json()),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: webConfig } = useQuery<any>({
    queryKey: ["web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const schoolStartDate: string | null = webConfig?.school_start_date || null;

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: () => fetch("/api/holidays", { credentials: "include" }).then(r => r.json()),
  });

  const getHolidayForDate = (dateStr: string): any | null => {
    return (holidays as any[]).find((h: any) => {
      const start = h.start_date;
      const end = h.end_date || h.start_date;
      return dateStr >= start && dateStr <= end;
    }) ?? null;
  };

  const { data: records = [] } = useQuery({
    queryKey: ["report-records", startDate, endDate, classId],
    queryFn: async () => {
      const queryDate = startDate || format(new Date(), "yyyy-MM-dd");
      const queryEndDate = endDate || queryDate;
      const classParam = classId !== "all" ? `&class_id=${classId}` : "";

      const [validationRes, hadirRes] = await Promise.all([
        fetch(`/api/attendance?start_date=${queryDate}&end_date=${queryEndDate}&status=izin,sakit&validation_status=approved${classParam}`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/attendance?start_date=${queryDate}&end_date=${queryEndDate}&status=hadir,alpa${classParam}`, { credentials: "include" }).then(r => r.json()),
      ]);

      return [...validationRes, ...hadirRes];
    },
    staleTime: 0,
  });

  const getSettingForDate = (dateStr: string) => {
    const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const date = new Date(dateStr);
    const dayName = DAY_NAMES_ID[date.getDay()];
    return settings.find((s: any) => s.day_of_week === dayName);
  };

  const isCheckInClosed = (dateStr: string): boolean => {
    // Dates before school started are NOT counted as missed attendance
    if (schoolStartDate && dateStr < schoolStartDate) return false;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const setting = getSettingForDate(dateStr);
    if (!setting?.enabled) return false;
    if (!setting?.check_in_end) return false;
    const nowTime = format(new Date(), "HH:mm");
    return nowTime > setting.check_in_end;
  };

  // O(1) record lookup — menggantikan records.find() yang O(n) per siswa
  const recordMap = useMemo(() => {
    const map = new Map<string, any>();
    records.forEach((r: any) => map.set(r.student_id, r));
    return map;
  }, [records]);

  const groupedData = useMemo(() => {
    const dateToUse = startDate || format(new Date(), "yyyy-MM-dd");

    let filteredStudents = allStudents;
    if (classId !== "all") {
      filteredStudents = allStudents.filter((s: any) => s.class_id === classId);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filteredStudents = filteredStudents.filter(
        (s: any) => s.name.toLowerCase().includes(q) || s.classes?.name?.toLowerCase().includes(q)
      );
    }

    const classMap: Record<string, { className: string; classId: string; students: any[] }> = {};

    filteredStudents.forEach((student: any) => {
      const cId = student.class_id;
      const cName = student.classes?.name || "Tanpa Kelas";
      if (!classMap[cId]) {
        classMap[cId] = { className: cName, classId: cId, students: [] };
      }

      classMap[cId].students.push({
        id: student.id,
        name: student.name,
        nis: student.nis,
        date: dateToUse,
        record: recordMap.get(student.id) ?? null,
      });
    });

    return Object.values(classMap).sort((a, b) => a.className.localeCompare(b.className));
  }, [allStudents, recordMap, classId, debouncedSearch, startDate]);

  const handleSearch = () => {
    queryClient.invalidateQueries({ queryKey: ["report-records"] });
  };

  const getEffectiveStatus = (record: any, dateStr?: string): { label: string; isVirtualAlpa: boolean; isHoliday: boolean; holidayName?: string } => {
    if (dateStr) {
      const holiday = getHolidayForDate(dateStr);
      if (holiday && !record) {
        return { label: "Hari Libur", isVirtualAlpa: false, isHoliday: true, holidayName: holiday.description || holiday.name };
      }
    }
    if (!record) {
      if (dateStr && isCheckInClosed(dateStr)) {
        return { label: "Alpa", isVirtualAlpa: true, isHoliday: false };
      }
      return { label: "Belum Absen", isVirtualAlpa: false, isHoliday: false };
    }
    const map: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpa: "Alpa" };
    return { label: map[record.status] || record.status, isVirtualAlpa: false, isHoliday: false };
  };

  const getStatusLabel = (record: any, dateStr?: string) => {
    return getEffectiveStatus(record, dateStr).label;
  };

  const getStatusBadgeClass = (record: any, dateStr?: string) => {
    const { isVirtualAlpa, isHoliday } = getEffectiveStatus(record, dateStr);
    if (isHoliday) return "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-400";
    if (!record) {
      if (isVirtualAlpa) return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400";
      return "bg-muted text-muted-foreground";
    }
    const map: Record<string, string> = {
      hadir: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400",
      izin: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400",
      sakit: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400",
      alpa: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400",
    };
    return map[record.status] || "";
  };

  const getTimeInfo = (record: any, dateStr?: string) => {
    if (!record) {
      if (dateStr) {
        const holiday = getHolidayForDate(dateStr);
        if (holiday) {
          return { jamDatang: "-", jamPulang: "-", keterangan: "-", isLate: false, isHoliday: true };
        }
      }
      return { jamDatang: "-", jamPulang: "-", keterangan: "-", isLate: false, isHoliday: false };
    }
    if (record.status === "izin" || record.status === "sakit" || record.status === "alpa") {
      return { jamDatang: "-", jamPulang: "-", keterangan: "-", isLate: false, isHoliday: false };
    }

    const jamDatang = record.submitted_at ? format(new Date(record.submitted_at), "HH:mm") : "-";
    const jamPulang = record.check_out_at ? format(new Date(record.check_out_at), "HH:mm") : "-";

    let keterangan = "-";
    let isLate = false;

    if (record.submitted_at && record.date) {
      const setting = getSettingForDate(record.date);
      if (setting && setting.check_in_end) {
        const checkInTime = format(new Date(record.submitted_at), "HH:mm");
        if (checkInTime > setting.check_in_end) {
          isLate = true;
          const [endH, endM] = setting.check_in_end.split(":").map(Number);
          const [actH, actM] = checkInTime.split(":").map(Number);
          const diffMinutes = (actH * 60 + actM) - (endH * 60 + endM);

          if (diffMinutes >= 60) {
            const hours = Math.floor(diffMinutes / 60);
            const mins = diffMinutes % 60;
            keterangan = `Terlambat ${hours} jam ${mins > 0 ? `${mins} menit` : ""}`;
          } else {
            keterangan = `Terlambat ${diffMinutes} menit`;
          }
        }
      }
    }

    if (!isLate) keterangan = record.notes || "Tepat Waktu";

    return { jamDatang, jamPulang, keterangan, isLate, isHoliday: false };
  };

  const buildExportRows = () => {
    const rows: { no: number; kelas: string; tanggal: string; nama: string; jamDatang: string; jamPulang: string; keterangan: string; status: string }[] = [];
    groupedData.forEach((group) => {
      group.students.forEach((s, i) => {
        const { jamDatang, jamPulang, keterangan } = getTimeInfo(s.record, s.date);
        rows.push({
          no: i + 1,
          kelas: group.className,
          tanggal: format(new Date(s.date), "dd MMM yyyy", { locale: idLocale }),
          nama: s.name,
          jamDatang,
          jamPulang,
          keterangan,
          status: getStatusLabel(s.record, s.date),
        });
      });
    });
    return rows;
  };

  const getFilenameSuffix = () => {
    const d = startDate || format(new Date(), "yyyy-MM-dd");
    return endDate && endDate !== d ? `${d}_sd_${endDate}` : d;
  };

  const getReportTitle = () => {
    const d = startDate || format(new Date(), "yyyy-MM-dd");
    const dFmt = format(new Date(d + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale });
    if (endDate && endDate !== d) {
      return `${dFmt} s.d. ${format(new Date(endDate + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale })}`;
    }
    return dFmt;
  };

  const getKelasLabel = () => {
    if (classId === "all") return "Semua Kelas";
    const cls = (classes as any[]).find((c: any) => c.id === classId);
    return cls ? `Kelas ${cls.name}` : "Semua Kelas";
  };

  const statusBgColor: Record<string, string> = {
    Hadir: "#22c55e", Izin: "#3b82f6", Sakit: "#f59e0b", Alpa: "#ef4444",
    "Belum Absen": "#d1d5db", "Hari Libur": "#a855f7",
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildHTMLReport = (rows: ReturnType<typeof buildExportRows>) => {
    const schoolName = webConfig?.app_subtitle || "SMP Negeri 1 Kebakkramat";
    const printDate = format(new Date(), "dd MMMM yyyy", { locale: idLocale });
    const printDateTime = format(new Date(), "dd MMMM yyyy, HH:mm 'WIB'", { locale: idLocale });

    const statusStyle: Record<string, string> = {
      "Hadir":      "background:#22c55e;color:#fff;",
      "Izin":       "background:#3b82f6;color:#fff;",
      "Sakit":      "background:#f59e0b;color:#fff;",
      "Alpa":       "background:#ef4444;color:#fff;",
      "Hari Libur": "background:#a855f7;color:#fff;",
      "Belum Absen":"background:#e5e7eb;color:#555;",
    };

    const bodyRows = rows.map((r, idx) => {
      const rowBg = idx % 2 !== 0 ? "background:#f5f5f5;" : "";
      const stStyle = statusStyle[r.status] || "background:#e5e7eb;color:#555;";
      const jamPulangLabel = r.jamPulang !== "-" ? `${r.jamPulang} (Sudah Pulang)` : "-";
      return `<tr>
        <td style="${rowBg}text-align:center;">${r.no}</td>
        <td style="${rowBg}">${r.kelas}</td>
        <td style="${rowBg}white-space:nowrap;">${r.tanggal}</td>
        <td style="${rowBg}">${r.nama}</td>
        <td style="${rowBg}text-align:center;">${r.jamDatang}</td>
        <td style="${rowBg}">${r.keterangan !== "-" ? r.keterangan : ""}</td>
        <td style="${rowBg}text-align:center;">${jamPulangLabel}</td>
        <td style="${stStyle}text-align:center;font-weight:bold;">${r.status}</td>
      </tr>`;
    }).join("");

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 20mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; line-height: 1.5; }
  .kop { text-align: center; margin-bottom: 6px; }
  .kop-judul { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3pt; margin-bottom: 3px; }
  .kop-instansi { font-size: 12pt; font-weight: bold; margin-bottom: 2px; }
  .kop-sub { font-size: 10pt; font-weight: normal; margin-bottom: 0; }
  .garis-kop { height: 5px; border-top: 3pt solid #000; border-bottom: 1pt solid #000; margin: 8px 0 10px 0; }
  table.data { border-collapse: collapse; width: 100%; font-size: 10pt; margin-top: 6px; }
  table.data th { background: #d0d0d0; color: #000; padding: 5px 6px; border: 1pt solid #000; text-align: center; font-weight: bold; vertical-align: middle; font-size: 10pt; }
  table.data td { padding: 4px 6px; border: 0.75pt solid #555; vertical-align: middle; font-size: 10pt; }
  .footer-info { margin-top: 8px; font-size: 9pt; color: #444; }
  table.ttd { width: 100%; border-collapse: collapse; margin-top: 30px; }
  table.ttd td { border: none; padding: 2px 10px; font-size: 11pt; text-align: center; vertical-align: top; width: 50%; }
  .ttd-line { margin-top: 44px; border-top: 1pt solid #000; padding-top: 4px; font-weight: bold; }
  .ttd-nip { font-weight: normal; font-size: 10pt; margin-top: 2px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
<div class="kop">
  <div class="kop-judul">Laporan Harian Kehadiran Siswa</div>
  <div class="kop-instansi">${schoolName}</div>
  <div class="kop-sub">Tanggal: ${getReportTitle()} &nbsp;&nbsp;|&nbsp;&nbsp; ${getKelasLabel()}</div>
</div>
<div class="garis-kop"></div>
<table class="data">
  <thead>
    <tr>
      <th style="width:4%">No</th>
      <th style="width:9%">Kelas</th>
      <th style="width:11%">Tanggal</th>
      <th style="width:24%">Nama Siswa</th>
      <th style="width:8%">Jam Datang</th>
      <th style="width:16%">Keterangan Waktu Datang</th>
      <th style="width:10%">Jam Pulang</th>
      <th style="width:9%">Status</th>
    </tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer-info">Jumlah siswa: <strong>${rows.length} orang</strong> &nbsp;&nbsp;|&nbsp;&nbsp; Dicetak pada: ${printDateTime}</div>
<table class="ttd">
  <tr>
    <td>
      Mengetahui,<br>Kepala Sekolah
      <div class="ttd-line">.................................................</div>
      <div class="ttd-nip">NIP. .......................................</div>
    </td>
    <td>
      Kebakkramat, ${printDate}<br>Guru / Wali Kelas
      <div class="ttd-line">.................................................</div>
      <div class="ttd-nip">NIP. .......................................</div>
    </td>
  </tr>
</table>
</body></html>`;
  };

  const exportExcel = () => {
    const rows = buildExportRows();
    if (rows.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }
    const html = buildHTMLReport(rows);
    downloadBlob(new Blob([html], { type: "application/vnd.ms-excel" }), `laporan-harian_${getFilenameSuffix()}.xls`);
    toast.success("File Excel berhasil diunduh");
  };

  const exportWord = () => {
    const rows = buildExportRows();
    if (rows.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }
    const html = buildHTMLReport(rows);
    downloadBlob(new Blob(["\ufeff" + html], { type: "application/msword" }), `laporan-harian_${getFilenameSuffix()}.doc`);
    toast.success("File Word berhasil diunduh");
  };

  const exportPDF = () => {
    const rows = buildExportRows();
    if (rows.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth  = doc.internal.pageSize.getWidth();   // 210 mm
    const pageHeight = doc.internal.pageSize.getHeight();  // 297 mm
    const margin = 15;
    const schoolName = webConfig?.app_subtitle || "SMP Negeri 1 Kebakkramat";

    // ── Kolom (total 180 mm) ──────────────────────────────────────────
    const colWidths = [7, 15, 22, 48, 16, 30, 24, 18];
    const colLabels = ["NO", "KELAS", "TANGGAL", "NAMA SISWA", "JAM\nDATANG", "KET. WAKTU\nDATANG", "JAM\nPULANG", "STATUS"];
    const rowH    = 8;
    const headerH = 11;
    const lineH   = 3.5;

    // ── KOP SURAT ─────────────────────────────────────────────────────
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(margin, 11, pageWidth - margin, 11);
    doc.setLineWidth(0.25);
    doc.line(margin, 13, pageWidth - margin, 13);

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("LAPORAN HARIAN KEHADIRAN SISWA", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(schoolName.toUpperCase(), pageWidth / 2, 27, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("times", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(`Tanggal: ${getReportTitle()}  |  ${getKelasLabel()}`, pageWidth / 2, 33, { align: "center" });
    doc.setTextColor(0, 0, 0);

    doc.setLineWidth(0.25);
    doc.line(margin, 36.5, pageWidth - margin, 36.5);
    doc.setLineWidth(0.8);
    doc.line(margin, 38, pageWidth - margin, 38);

    let y = 44;
    let pageNum = 1;

    // ── Footer tiap halaman ───────────────────────────────────────────
    const addPageFooter = (pn: number) => {
      doc.setFontSize(8);
      doc.setFont("times", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Dicetak: ${format(new Date(), "dd MMMM yyyy, HH:mm 'WIB'", { locale: idLocale })}`,
        margin, pageHeight - 8
      );
      doc.text(`Halaman ${pn}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      doc.text(`Total: ${rows.length} siswa`, pageWidth - margin, pageHeight - 8, { align: "right" });
      doc.setTextColor(0, 0, 0);
    };

    // ── Fungsi menggambar 1 baris ─────────────────────────────────────
    const drawRow = (cells: string[], rowIndex: number, isHeader = false) => {
      const cellH = isHeader ? headerH : rowH;
      let x = margin;
      cells.forEach((cell, ci) => {
        const w = colWidths[ci];
        const lines = cell.split("\n");

        if (isHeader) {
          doc.setFillColor(208, 208, 208);
          doc.rect(x, y, w, cellH, "F");
          doc.setTextColor(0, 0, 0);
          doc.setFont("times", "bold");
          doc.setFontSize(8);
          const th = lines.length * lineH;
          const sy = y + (cellH - th) / 2 + lineH * 0.8;
          lines.forEach((ln, li) => doc.text(ln, x + w / 2, sy + li * lineH, { align: "center" }));
        } else {
          const statusColors: Record<string, [number, number, number]> = {
            "Hadir":      [34,  197, 94],
            "Izin":       [59,  130, 246],
            "Sakit":      [245, 158, 11],
            "Alpa":       [239, 68,  68],
            "Hari Libur": [168, 85,  247],
            "Belum Absen":[209, 213, 219],
          };
          const statusTextWhite = new Set(["Hadir", "Izin", "Sakit", "Alpa", "Hari Libur"]);
          const altBg: [number, number, number] = rowIndex % 2 === 0 ? [255, 255, 255] : [248, 248, 248];

          if (ci === 7 && statusColors[cell]) {
            const [r2, g2, b2] = statusColors[cell];
            doc.setFillColor(r2, g2, b2);
            doc.rect(x, y, w, cellH, "F");
            doc.setTextColor(statusTextWhite.has(cell) ? 255 : 85, statusTextWhite.has(cell) ? 255 : 85, statusTextWhite.has(cell) ? 255 : 85);
          } else {
            doc.setFillColor(altBg[0], altBg[1], altBg[2]);
            doc.rect(x, y, w, cellH, "F");
            doc.setTextColor(ci === 0 ? 110 : 0, ci === 0 ? 110 : 0, ci === 0 ? 110 : 0);
          }

          doc.setFont("times", "normal");
          doc.setFontSize(8.5);
          const align = (ci === 0 || ci === 4 || ci === 6 || ci === 7) ? "center" : "left";
          const textX = align === "center" ? x + w / 2 : x + 1.5;
          const splitLines: string[] = [];
          lines.forEach(ln => splitLines.push(...doc.splitTextToSize(ln, w - 2)));
          const th = splitLines.length * lineH;
          const sy = y + (cellH - th) / 2 + lineH * 0.8;
          splitLines.forEach((ln, li) => doc.text(ln, textX, sy + li * lineH, { align }));
        }

        doc.setDrawColor(140, 140, 140);
        doc.setLineWidth(0.2);
        doc.rect(x, y, w, cellH);
        doc.setTextColor(0, 0, 0);
        x += w;
      });
    };

    // ── Gambar header tabel ───────────────────────────────────────────
    drawRow(colLabels, 0, true);
    y += headerH;

    // ── Gambar baris data ─────────────────────────────────────────────
    rows.forEach((r, i) => {
      if (y + rowH > pageHeight - 22) {
        addPageFooter(pageNum);
        doc.addPage();
        pageNum++;
        y = margin;
        drawRow(colLabels, 0, true);
        y += headerH;
      }
      const jamPulangPDF = r.jamPulang !== "-" ? `${r.jamPulang}\nSudah Pulang` : "-";
      const ketPDF = r.keterangan !== "-" ? r.keterangan : "";
      drawRow([String(r.no), r.kelas, r.tanggal, r.nama, r.jamDatang, ketPDF, jamPulangPDF, r.status], i);
      y += rowH;
    });

    // ── Footer halaman terakhir ───────────────────────────────────────
    addPageFooter(pageNum);

    // ── Tanda Tangan ─────────────────────────────────────────────────
    const sigH = 60;
    let sigY = y + 10;
    if (sigY + sigH > pageHeight - 18) {
      doc.addPage();
      sigY = margin + 10;
    }

    const printDate = format(new Date(), "dd MMMM yyyy", { locale: idLocale });
    const leftCx  = margin + 28;
    const rightCx = pageWidth - margin - 28;

    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.setTextColor(0, 0, 0);

    doc.text("Mengetahui,",    leftCx,  sigY,      { align: "center" });
    doc.text("Kepala Sekolah", leftCx,  sigY + 5,  { align: "center" });
    doc.text(`Kebakkramat, ${printDate}`, rightCx, sigY,     { align: "center" });
    doc.text("Guru / Wali Kelas",         rightCx, sigY + 5, { align: "center" });

    const lineY = sigY + 42;
    doc.setLineWidth(0.4);
    doc.line(leftCx  - 24, lineY, leftCx  + 24, lineY);
    doc.line(rightCx - 24, lineY, rightCx + 24, lineY);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("NIP. .............................", leftCx,  lineY + 5, { align: "center" });
    doc.text("NIP. .............................", rightCx, lineY + 5, { align: "center" });

    doc.save(`laporan-harian_${getFilenameSuffix()}.pdf`);
    toast.success("File PDF berhasil diunduh");
  };

  const displayDate = startDate || format(new Date(), "yyyy-MM-dd");

  const displayDateSetting = getSettingForDate(displayDate);
  const isDisplayDateEnabled = !displayDateSetting || displayDateSetting.enabled === true;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-[hsl(185,75%,32%)] to-[hsl(199,85%,45%)] px-6 py-5 shadow-lg shadow-cyan-700/20">
        <div className="flex items-center gap-2.5 text-white">
          <FileBarChart2 className="h-5 w-5 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Laporan Harian</h1>
            <p className="text-white/70 text-xs mt-0.5">Data dari scan barcode & input manual — sumber rekap bulanan</p>
          </div>
        </div>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dari Tanggal</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full lg:w-44 bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sampai Tanggal</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full lg:w-44 bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Kelas</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full lg:w-44 bg-background">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Button
                onClick={handleSearch}
                className="gap-2 flex-1 lg:flex-none bg-[hsl(185,75%,32%)] hover:bg-[hsl(185,75%,27%)] dark:bg-[hsl(185,65%,38%)] dark:hover:bg-[hsl(185,65%,33%)] text-white"
              >
                <Search className="h-4 w-4" />
                Cari Data
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2 flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={exportExcel}>📊 Export Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF}>📕 Export PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportWord}>📝 Export Word</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isDisplayDateEnabled && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
          <PowerOff className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-slate-600 dark:text-slate-300">Absensi Tidak Aktif</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Pengaturan waktu absensi hari <span className="font-medium">{displayDateSetting?.day_of_week}</span> belum diaktifkan,
              sehingga data laporan masih kosong untuk tanggal ini.
            </p>
          </div>
        </div>
      )}

      {(() => {
        const displayHoliday = getHolidayForDate(displayDate);
        if (!displayHoliday) return null;
        return (
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-300 rounded-xl px-4 py-3.5 shadow-sm dark:bg-purple-950/20 dark:border-purple-700">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center">
              <CalendarOff className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-purple-700 dark:text-purple-400">Hari Libur — Status Siswa Ditampilkan Khusus</p>
              {displayHoliday.description && (
                <p className="text-xs text-purple-500 mt-0.5 truncate">{displayHoliday.description}</p>
              )}
              <p className="text-xs text-purple-400 mt-0.5">Siswa yang tidak memiliki catatan absensi akan ditampilkan statusnya sebagai <span className="font-semibold">Hari Libur</span>.</p>
            </div>
          </div>
        );
      })()}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari Siswa / Kelas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 w-full sm:w-64 bg-background"
        />
      </div>

      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {groupedData.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              Tidak ada data absensi untuk filter yang dipilih
            </p>
          ) : (
            <div className="overflow-x-auto">
              {groupedData.map((group) => {
                return (
                  <div key={group.classId}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(185,75%,32%)]/10 dark:bg-[hsl(185,65%,38%)]/15 border-b border-border/60">
                      <Badge className="bg-[hsl(185,75%,32%)] hover:bg-[hsl(185,75%,27%)] dark:bg-[hsl(185,65%,42%)] text-white border-0">
                        {group.className}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{group.students.length} siswa</span>
                    </div>

                    {/* ── Mobile: card per siswa — hanya di-render saat HP ── */}
                    {isMobile && (
                      <div className="divide-y divide-border/60">
                        {group.students.map((s: any) => {
                          const { jamDatang, jamPulang, keterangan, isLate, isHoliday: isStudentHoliday } = getTimeInfo(s.record, s.date);
                          const sudahPulang = !!s.record?.check_out_at;
                          return (
                            <div key={s.id} className="px-4 py-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm flex-1 min-w-0 truncate">{s.name}</p>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0">
                                      <Badge variant="outline" className={getStatusBadgeClass(s.record, s.date) + " text-[11px]"}>
                                        {getStatusLabel(s.record, s.date)}
                                      </Badge>
                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(["hadir", "izin", "sakit", "alpa"] as AttendanceStatus[]).map((status) => (
                                      <DropdownMenuItem
                                        key={status}
                                        onClick={() => updateStatusMutation.mutate({
                                          recordId: s.record?.id,
                                          studentId: s.id,
                                          classId: s.record?.class_id || allStudents.find((st: any) => st.id === s.id)?.class_id,
                                          date: s.date,
                                          newStatus: status,
                                        })}
                                      >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                {jamDatang !== "-" && (
                                  <span>Datang: <span className="font-mono font-semibold text-foreground">{jamDatang}</span></span>
                                )}
                                {jamPulang !== "-" ? (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>Pulang: <span className="font-mono font-semibold text-emerald-600">{jamPulang}</span></span>
                                    {sudahPulang && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold">
                                        Sudah Pulang
                                      </Badge>
                                    )}
                                  </span>
                                ) : null}
                                {keterangan !== "-" && (
                                  <span className={isStudentHoliday ? "text-purple-600 font-semibold" : isLate ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"}>{keterangan}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Desktop: table — hanya di-render saat layar lebar ── */}
                    {!isMobile && <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">NO</TableHead>
                          <TableHead>TANGGAL</TableHead>
                          <TableHead>NAMA SISWA</TableHead>
                          <TableHead>JAM DATANG</TableHead>
                          <TableHead>KETERANGAN WAKTU DATANG</TableHead>
                          <TableHead>JAM PULANG</TableHead>
                          <TableHead className="text-right">STATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.students.map((s: any, i: number) => {
                          const { jamDatang, jamPulang, keterangan, isLate, isHoliday: isStudentHoliday } = getTimeInfo(s.record, s.date);
                          const sudahPulang = !!s.record?.check_out_at;
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>{format(new Date(displayDate), "dd MMM yyyy", { locale: idLocale })}</TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{jamDatang}</TableCell>
                              <TableCell>
                                {isStudentHoliday ? (
                                  <span className="text-purple-600 font-semibold">{keterangan}</span>
                                ) : isLate ? (
                                  <span className="text-destructive font-semibold">{keterangan}</span>
                                ) : (
                                  keterangan
                                )}
                              </TableCell>
                              <TableCell>
                                {jamPulang !== "-" ? (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>{jamPulang}</span>
                                    {sudahPulang && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold">
                                        Sudah Pulang
                                      </Badge>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                                      <Badge variant="outline" className={getStatusBadgeClass(s.record, s.date)}>
                                        {getStatusLabel(s.record, s.date)}
                                      </Badge>
                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(["hadir", "izin", "sakit", "alpa"] as AttendanceStatus[]).map((status) => (
                                      <DropdownMenuItem
                                        key={status}
                                        onClick={() => updateStatusMutation.mutate({
                                          recordId: s.record?.id,
                                          studentId: s.id,
                                          classId: s.record?.class_id || allStudents.find((st: any) => st.id === s.id)?.class_id,
                                          date: s.date,
                                          newStatus: status,
                                        })}
                                      >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
