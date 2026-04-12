import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GraduationCap, Send, Clock, Stethoscope, ShieldCheck, AlertTriangle, CheckCircle2, CalendarOff, PowerOff, ChevronDown, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { convertGDriveLink } from "@/lib/gdrive";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const Index = () => {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const [status, setStatus] = useState<"izin" | "sakit">("izin");
  const [notes, setNotes] = useState("");
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<"hadir" | "izin_sakit" | "generic">("generic");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: () => fetch("/api/web-config").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const logoUrl = webConfig?.logo_url ? convertGDriveLink(webConfig.logo_url) : null;

  const { data: holidays = [] } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: () => fetch("/api/holidays").then(r => r.json()),
    staleTime: 10 * 60_000,
  });

  const { data: attendanceSettings = [] } = useQuery({
    queryKey: ["public-attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings").then(r => r.json()),
    staleTime: 10 * 60_000,
  });

  const todayForHoliday = new Date();
  const todayStr = format(todayForHoliday, "yyyy-MM-dd");
  const dayOfWeek = todayForHoliday.getDay();
  const todayDayName = DAY_NAMES_ID[dayOfWeek];

  const todaySetting = (attendanceSettings as any[]).find((s: any) => s.day_of_week === todayDayName);
  // Jika tidak ada setting untuk hari ini → default nonaktif agar aman
  const isTodayEnabled = todaySetting ? todaySetting.enabled === true : false;

  // Hari libur wajib: ada di daftar hari libur (selalu blokir, terlepas dari setting)
  const todayHolidayInfo = (holidays as any[]).find((h: any) => {
    const start = h.startDate || h.start_date;
    const end = h.endDate || h.end_date;
    return todayStr >= start && todayStr <= end;
  }) ?? null;
  const isInHolidayList = !!todayHolidayInfo;

  // Weekend: Sabtu/Minggu yang belum diaktifkan di setting
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const { data: classes = [] } = useQuery({
    queryKey: ["public-classes"],
    queryFn: () => fetch("/api/classes").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["public-students", classId],
    queryFn: () => {
      if (!classId) return [];
      return fetch(`/api/students?class_id=${classId}`).then(r => r.json());
    },
    enabled: !!classId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: existingRecords = [] } = useQuery({
    queryKey: ["existing-record", studentId, todayStr],
    queryFn: () => {
      if (!studentId) return [];
      return fetch(`/api/attendance?student_id=${studentId}&date=${todayStr}&status=hadir,izin,sakit,alpa`).then(r => r.json());
    },
    enabled: !!studentId,
  });

  // hadir (scan QR / input manual) → langsung blokir meski tidak ada validation_status
  const hadirRecord  = (existingRecords as any[]).find((r: any) => r.status === "hadir");
  // izin/sakit yang sudah dikirim dan belum ditolak
  const izinSakitRecord = (existingRecords as any[]).find(
    (r: any) => (r.status === "izin" || r.status === "sakit") && r.validation_status !== "rejected"
  );
  const alreadySubmitted = !!hadirRecord || !!izinSakitRecord;

  const handleSubmitClick = () => {
    if (isInHolidayList) { setShowHolidayDialog(true); return; }
    if (hadirRecord) {
      setRejectionReason("hadir");
      setShowRejectionDialog(true);
      return;
    }
    if (izinSakitRecord) {
      setRejectionReason("izin_sakit");
      setShowRejectionDialog(true);
      return;
    }
    submitMutation.mutate();
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const serverCheck: any[] = await fetch(
        `/api/attendance?student_id=${studentId}&date=${todayStr}&status=hadir,izin,sakit,alpa`
      ).then(r => r.json());
      const serverHadir = serverCheck.find((r: any) => r.status === "hadir");
      const serverIzinSakit = serverCheck.find(
        (r: any) => (r.status === "izin" || r.status === "sakit") && r.validation_status !== "rejected"
      );
      if (serverHadir || serverIzinSakit) {
        const reason: "hadir" | "izin_sakit" = serverHadir ? "hadir" : "izin_sakit";
        setRejectionReason(reason);
        throw new Error("Sudah tercatat absensi hari ini.");
      }
      await apiRequest("POST", "/api/attendance", { student_id: studentId, class_id: classId, date: todayStr, status, notes: notes || null });
    },
    onSuccess: () => {
      setShowSuccessDialog(true);
      setClassId("");
      setStudentId("");
      setNotes("");
      setStatus("izin");
      queryClient.invalidateQueries({ queryKey: ["existing-record"] });
    },
    onError: () => setShowRejectionDialog(true),
  });

  const appTitle  = webConfig?.app_title    || "E-ABSENSI";
  const appSubtitle = webConfig?.app_subtitle || "Sistem Absensi Sekolah";

  return (
    <div className="animate-slide-left">
      {/* ── Card ── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.22)]" style={{ transform: "translateZ(0)" }}>

        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-5 px-6 text-center">
          {/* Logo */}
          <div className="mb-3">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
              : <div className="w-20 h-20 flex items-center justify-center"><GraduationCap className="h-12 w-12 text-violet-600" /></div>}
          </div>

          {/* Title */}
          <h1
            className="text-[22px] font-black tracking-widest text-slate-800 leading-tight"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            {appTitle}
          </h1>
          <p className="text-slate-600 text-[12px] mt-0.5 tracking-wide">{appSubtitle}</p>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* ── Konten utama: libur wajib / libur weekend / nonaktif / form ── */}
        {isInHolidayList ? (
          /* State Hari Libur Wajib (dari Daftar Hari Libur) */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <CalendarOff className="h-8 w-8 text-white" strokeWidth={2} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 w-fit mx-auto mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Hari Libur</span>
              </div>
              <p className="text-[17px] font-bold text-slate-800 leading-snug">
                {todayHolidayInfo?.description || "Libur Sekolah"}
              </p>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                {(() => {
                  const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
                  const start = todayHolidayInfo?.start_date || todayHolidayInfo?.startDate;
                  const end = todayHolidayInfo?.end_date || todayHolidayInfo?.endDate;
                  const fmt = (d: string) => {
                    const dt = new Date(d + "T00:00:00");
                    return `${dt.getDate()} ${BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
                  };
                  if (start && end && start !== end) {
                    return `${fmt(start)} – ${fmt(end)}`;
                  }
                  return "Tidak dapat mengirim laporan absensi hari ini.";
                })()}
              </p>
            </div>
            <div className="pt-2 pb-1">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-600 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
                Masuk sebagai Admin / Guru
              </Link>
            </div>
          </div>
        ) : !isTodayEnabled && isWeekend ? (
          /* State Hari Libur Weekend (Sabtu/Minggu belum diaktifkan) */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-400/30">
              <CalendarOff className="h-8 w-8 text-white" strokeWidth={2} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[16px] font-bold text-slate-700 leading-snug">Hari Libur</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Tidak dapat mengirim laporan absensi<br />
                di hari <span className="font-semibold text-slate-600">{todayDayName}</span>. Silakan kirim di hari sekolah.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[11px] font-semibold text-red-500 uppercase tracking-widest">Hari Libur</span>
            </div>
            <div className="pt-2 pb-1">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-600 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
                Masuk sebagai Admin / Guru
              </Link>
            </div>
          </div>
        ) : !isTodayEnabled ? (
          /* State Belum Aktif (hari biasa tapi nonaktif oleh admin) */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-400/30">
              <PowerOff className="h-8 w-8 text-white" strokeWidth={2} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[16px] font-bold text-slate-700 leading-snug">Absensi Belum Aktif</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Jam masuk sekolah hari <span className="font-semibold text-slate-600">{todayDayName}</span> belum diaktifkan.<br />
                Silakan hubungi guru atau admin untuk informasi lebih lanjut.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Nonaktif</span>
            </div>
            <div className="pt-2 pb-1">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-600 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
                Masuk sebagai Admin / Guru
              </Link>
            </div>
          </div>
        ) : (
          /* Form normal */
          <div className="px-6 py-5 space-y-4">

            {/* Kelas */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">Pilih Kelas</p>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); setStudentOpen(false); }}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium shadow-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Siswa */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">Pilih Siswa</p>
              <Popover open={studentOpen && !!classId} onOpenChange={(o) => classId && setStudentOpen(o)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!classId}
                    className={`w-full h-11 rounded-xl border px-3 flex items-center justify-between text-sm font-medium transition-[border-color]
                      ${!classId ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60" : "border-slate-200 bg-slate-50 text-slate-700 cursor-pointer hover:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"}
                    `}
                  >
                    <span className="truncate">
                      {studentId
                        ? (students as any[]).find((s: any) => s.id === studentId)?.name || "Pilih siswa..."
                        : classId ? "Pilih siswa..." : "Pilih kelas terlebih dahulu"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 ml-2 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 rounded-xl border-slate-200 shadow-lg"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                  align="start"
                  sideOffset={4}
                >
                  <Command>
                    <div className="border-b border-slate-100 px-3 py-2">
                      <CommandInput
                        placeholder="Cari nama siswa..."
                        className="h-8 text-sm border-0 shadow-none focus:ring-0 p-0 bg-transparent placeholder:text-slate-400"
                      />
                    </div>
                    <CommandList className="max-h-52 overflow-y-auto">
                      <CommandEmpty className="py-4 text-center text-sm text-slate-400">Siswa tidak ditemukan.</CommandEmpty>
                      {(students as any[]).map((s: any) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setStudentId(s.id);
                            setStudentOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-violet-50 aria-selected:bg-violet-50"
                        >
                          <Check className={`h-4 w-4 shrink-0 text-violet-500 ${studentId === s.id ? "opacity-100" : "opacity-0"}`} />
                          <span className="leading-snug">{s.name}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">Status Kehadiran</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("izin")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-semibold text-sm transition-[background-color,border-color,color] duration-150 ${
                    status === "izin"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <Clock className={`h-4 w-4 ${status === "izin" ? "text-blue-500" : "text-slate-400"}`} />
                  Izin
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("sakit")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-semibold text-sm transition-[background-color,border-color,color] duration-150 ${
                    status === "sakit"
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <Stethoscope className={`h-4 w-4 ${status === "sakit" ? "text-amber-500" : "text-slate-400"}`} />
                  Sakit
                </button>
              </div>
            </div>

            {/* Keterangan */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">
                Keterangan <span className="font-normal normal-case text-slate-500">— opsional</span>
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tulis keterangan jika ada..."
                rows={2}
                className="rounded-xl border-slate-200 bg-slate-50 resize-none text-sm text-slate-700 shadow-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmitClick}
              disabled={!studentId || submitMutation.isPending}
              className="w-full h-12 rounded-xl text-sm font-bold tracking-wide bg-gradient-to-r from-violet-600 via-blue-500 to-teal-500 text-white shadow-md shadow-violet-500/25 active:scale-[0.97] transition-transform duration-100 border-0"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitMutation.isPending ? "Mengirim..." : "Kirim Laporan"}
            </Button>

            {/* Admin link */}
            <div className="text-center pb-1">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-600 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Masuk sebagai Admin / Guru
              </Link>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-[320px] rounded-3xl border-0 p-0 overflow-hidden shadow-[0_24px_48px_-8px_rgba(0,0,0,0.30)] gap-0">
          <DialogTitle className="sr-only">Laporan Terkirim</DialogTitle>
          <DialogDescription className="sr-only">Laporan absensi berhasil dikirim.</DialogDescription>
          <div className="h-1 w-full bg-gradient-to-r from-teal-400 via-green-400 to-emerald-500" />
          <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-400/30">
              <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
            <div className="space-y-2">
              <p className="text-[17px] font-bold text-slate-800 leading-snug">Laporan Absensi Terkirim</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Mohon tunggu proses validasi.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-teal-400 text-white font-semibold text-sm tracking-wide shadow-md shadow-violet-500/20 hover:opacity-90 active:scale-[0.98] transition-transform duration-100 mt-1"
            >
              Tutup
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-[320px] rounded-3xl border-0 p-0 overflow-hidden shadow-[0_24px_48px_-8px_rgba(0,0,0,0.30)] gap-0">
          <DialogTitle className="sr-only">Tidak Dapat Mengirim</DialogTitle>
          <DialogDescription className="sr-only">Absensi siswa sudah tercatat hari ini.</DialogDescription>
          {rejectionReason === "hadir" ? (
            <>
              <div className="h-1 w-full bg-gradient-to-r from-red-400 via-rose-500 to-pink-500" />
              <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-400/30">
                  <AlertTriangle className="h-8 w-8 text-white" strokeWidth={2.5} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[17px] font-bold text-slate-800 leading-snug">Sudah Tercatat Hadir</p>
                  <p className="text-[13px] text-slate-500 leading-relaxed">
                    Siswa ini sudah tercatat <strong>HADIR</strong> hari ini<br />
                    melalui scan QR atau input manual.<br />
                    Laporan izin/sakit tidak diperlukan.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 border border-red-200">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[11px] font-semibold text-red-600 uppercase tracking-widest">Absensi Sudah Diproses</span>
                </div>
                <button
                  onClick={() => setShowRejectionDialog(false)}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white font-semibold text-sm tracking-wide shadow-md shadow-rose-400/20 hover:opacity-90 active:scale-[0.98] transition-transform duration-100 mt-1"
                >
                  Mengerti
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="h-1 w-full bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400" />
              <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-400/30">
                  <AlertTriangle className="h-8 w-8 text-white" strokeWidth={2.5} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[17px] font-bold text-slate-800 leading-snug">Tidak Dapat Mengirim</p>
                  <p className="text-[13px] text-slate-500 leading-relaxed">
                    Anda sudah mengirim laporan absensi hari ini.<br />Silakan tunggu hingga besok.
                  </p>
                </div>
                <button
                  onClick={() => setShowRejectionDialog(false)}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-teal-400 text-white font-semibold text-sm tracking-wide shadow-md shadow-violet-500/20 hover:opacity-90 active:scale-[0.98] transition-transform duration-100 mt-1"
                >
                  Mengerti
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent className="max-w-[320px] rounded-3xl border-0 p-0 overflow-hidden shadow-[0_24px_48px_-8px_rgba(0,0,0,0.30)] gap-0">
          <DialogTitle className="sr-only">Hari Libur</DialogTitle>
          <DialogDescription className="sr-only">Tidak dapat mengirim laporan di hari libur.</DialogDescription>
          <div className="h-1 w-full bg-gradient-to-r from-red-400 via-rose-500 to-pink-500" />
          <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-400/30">
              <CalendarOff className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 w-fit mx-auto">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Hari Libur</span>
              </div>
              <p className="text-[17px] font-bold text-slate-800 leading-snug">
                {todayHolidayInfo?.description || "Maaf, Hari Libur"}
              </p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Tidak dapat mengirim laporan absensi<br />di hari libur. Silakan kirim di hari sekolah.
              </p>
            </div>
            <button
              onClick={() => setShowHolidayDialog(false)}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-teal-400 text-white font-semibold text-sm tracking-wide shadow-md shadow-violet-500/20 hover:opacity-90 active:scale-[0.98] transition-transform duration-100 mt-1"
            >
              Mengerti
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
