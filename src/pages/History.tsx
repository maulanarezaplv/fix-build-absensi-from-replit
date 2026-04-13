import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, LogIn, LogOut, Send, Clock, QrCode, Camera, CheckCheck, Trash2, Package, ClipboardList, CalendarOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import QRScannerDialog, { type ScanResult } from "@/components/QRScannerDialog";

type BufferedCheckin = {
  student_id: string;
  class_id: string;
  student_name: string;
  class_name: string;
  status: "hadir" | "izin" | "sakit" | "alpa";
  scanned_at: string;
};

type BufferedCheckout = {
  record_id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  checkout_time: string;
};

const statusOptions = [
  { value: "hadir", label: "Hadir", bg: "bg-emerald-500", ring: "ring-emerald-400", dot: "bg-emerald-500" },
  { value: "izin", label: "Izin", bg: "bg-blue-500", ring: "ring-blue-400", dot: "bg-blue-500" },
  { value: "sakit", label: "Sakit", bg: "bg-amber-500", ring: "ring-amber-400", dot: "bg-amber-500" },
  { value: "alpa", label: "Alpa", bg: "bg-red-500", ring: "ring-red-400", dot: "bg-red-500" },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const avatarColors = [
  "from-[hsl(260,70%,55%)] to-[hsl(280,60%,50%)]",
  "from-[hsl(199,89%,48%)] to-[hsl(220,80%,50%)]",
  "from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)]",
  "from-[hsl(38,92%,50%)] to-[hsl(25,95%,53%)]",
  "from-[hsl(340,82%,52%)] to-[hsl(0,84%,55%)]",
];

const History = () => {
  useRealtimeSubscription("attendance_records", [["attendance-records"]]);
  const [tab, setTab] = useState<"checkin" | "checkout">("checkin");
  const [classId, setClassId] = useState("");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [manualName, setManualName] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const [checkinBuffer, setCheckinBuffer] = useState<BufferedCheckin[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("checkinBuffer") || "[]"); } catch { return []; }
  });
  const [checkoutBuffer, setCheckoutBuffer] = useState<BufferedCheckout[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("checkoutBuffer") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    sessionStorage.setItem("checkinBuffer", JSON.stringify(checkinBuffer));
  }, [checkinBuffer]);
  useEffect(() => {
    sessionStorage.setItem("checkoutBuffer", JSON.stringify(checkoutBuffer));
  }, [checkoutBuffer]);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const todayDayNameFull = format(new Date(), "EEEE", { locale: idLocale });
  const dayNameMap: Record<string, string> = {
    senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis",
    jumat: "Jumat", sabtu: "Sabtu", minggu: "Minggu",
  };
  const todayPiketDay = Object.entries(dayNameMap).find(([k]) => todayDayNameFull.toLowerCase().includes(k))?.[1] || "";

  const { data: piketAssignments = [], isLoading: piketLoading } = useQuery({
    queryKey: ["my-piket", user?.id],
    queryFn: () => fetch(`/api/guru-piket?user_id=${user?.id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user?.id && !isAdmin,
  });

  const isGuruOnPiketToday = isAdmin || piketAssignments.some((a: any) => a.day_of_week === todayPiketDay);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then(r => r.json()),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-for-class", classId],
    queryFn: () => fetch(`/api/students?class_id=${classId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!classId,
  });

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["today-records", classId, dateStr],
    queryFn: () => fetch(`/api/attendance?class_id=${classId}&date=${dateStr}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!classId,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: () => fetch("/api/holidays", { credentials: "include" }).then(r => r.json()),
  });

  const todayDayName = format(new Date(dateStr), "EEEE", { locale: idLocale });
  const dayMap: Record<string, string> = { Senin: "Senin", Selasa: "Selasa", Rabu: "Rabu", Kamis: "Kamis", Jumat: "Jumat", Sabtu: "Sabtu", Minggu: "Minggu" };
  const mappedDay = Object.entries(dayMap).find(([, v]) => todayDayName.toLowerCase().includes(v.toLowerCase()))?.[0];
  const todaySetting = settings.find((s: any) => s.day_of_week === mappedDay);

  // Cek apakah tanggal yang dipilih masuk dalam daftar hari libur
  const isHoliday = (holidays as any[]).some((h: any) => {
    const start = h.startDate || h.start_date;
    const end = h.endDate || h.end_date;
    return dateStr >= start && dateStr <= end;
  });

  const holidayInfo = (holidays as any[]).find((h: any) => {
    const start = h.startDate || h.start_date;
    const end = h.endDate || h.end_date;
    return dateStr >= start && dateStr <= end;
  });

  const isWithinTimeWindow = useMemo(() => {
    if (!todaySetting || !todaySetting.enabled) return false;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (tab === "checkin") {
      return currentTime >= todaySetting.check_in_start && currentTime <= todaySetting.check_out_end;
    } else {
      return currentTime >= todaySetting.check_out_start && currentTime <= todaySetting.check_out_end;
    }
  }, [todaySetting, tab, dateStr]);

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const canSubmit = !isHoliday && (!isToday || isWithinTimeWindow);

  const getTimeBlockMessage = () => {
    if (!todaySetting) return "Jadwal absensi tidak tersedia untuk hari ini";
    if (!todaySetting.enabled) return "Absensi tidak aktif untuk hari ini";
    if (tab === "checkin") {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (currentTime > todaySetting.check_out_end) {
        return `Waktu absensi sudah ditutup (batas pulang: ${todaySetting.check_out_end}).`;
      }
      if (currentTime < todaySetting.check_in_start) {
        return `Absensi belum dibuka. Waktu masuk dimulai pukul ${todaySetting.check_in_start}.`;
      }
    } else {
      return `Waktu pulang: ${todaySetting.check_out_start} - ${todaySetting.check_out_end}`;
    }
    return "";
  };

  const sendCheckinMutation = useMutation({
    mutationFn: async () => {
      if (checkinBuffer.length === 0) throw new Error("Tidak ada data untuk dikirim");
      const records = checkinBuffer.map((b) => ({
        student_id: b.student_id,
        class_id: b.class_id,
        date: dateStr,
        status: b.status,
        submitted_by: user?.id || null,
        check_in_at: b.scanned_at,
      }));
      return apiRequest("POST", "/api/attendance", { records });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-records"] });
      qc.invalidateQueries({ queryKey: ["report-records"] });
      qc.invalidateQueries({ queryKey: ["attendance-rekap"] });
      toast({ title: `${checkinBuffer.length} data absensi berhasil dikirim ke Laporan Harian` });
      setCheckinBuffer([]);
      setStatuses({});
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendCheckoutMutation = useMutation({
    mutationFn: async () => {
      if (checkoutBuffer.length === 0) throw new Error("Tidak ada data untuk dikirim");
      await Promise.all(
        checkoutBuffer.map(b => apiRequest("PATCH", `/api/attendance/${b.record_id}`, { check_out_at: b.checkout_time }))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-records"] });
      qc.invalidateQueries({ queryKey: ["report-records"] });
      qc.invalidateQueries({ queryKey: ["attendance-rekap"] });
      toast({ title: `${checkoutBuffer.length} data pulang berhasil dikirim ke Laporan Harian` });
      setCheckoutBuffer([]);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Selama pengecekan piket masih berjalan, jangan tampilkan halaman sama sekali (cegah scan sebelum cek selesai)
  if (!isAdmin && piketLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm">Memeriksa jadwal piket...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isGuruOnPiketToday) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="max-w-md w-full border-none shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
            <p className="text-muted-foreground text-sm">
              Anda tidak terjadwal sebagai Guru Piket hari ini ({todayPiketDay}).
              Hanya guru yang bertugas piket pada hari ini yang dapat mengakses halaman Scan & Absensi.
            </p>
            <p className="text-xs text-muted-foreground">
              Hubungi admin jika Anda merasa ini adalah kesalahan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const batchToBuffer = () => {
    const entries = Object.entries(statuses).filter(([, status]) => status);
    if (entries.length === 0) return;

    const newBuffered: BufferedCheckin[] = entries.map(([studentId, status]) => {
      const student = students.find((s: any) => s.id === studentId);
      const cls = classes.find((c: any) => c.id === classId);
      return {
        student_id: studentId,
        class_id: classId,
        student_name: student?.name || "Unknown",
        class_name: cls?.name || "",
        status: status as "hadir" | "izin" | "sakit" | "alpa",
        scanned_at: new Date().toISOString(),
      };
    });

    setCheckinBuffer(prev => [...prev, ...newBuffered]);
    setStatuses({});
    toast({ title: `${newBuffered.length} siswa ditambahkan ke antrian` });
  };

  const markAllHadir = () => {
    const newStatuses: Record<string, string> = {};
    unrecordedStudents.forEach((s: any) => { newStatuses[s.id] = "hadir"; });
    setStatuses((prev) => ({ ...prev, ...newStatuses }));
  };

  const removeFromCheckinBuffer = (index: number) => {
    setCheckinBuffer(prev => prev.filter((_, i) => i !== index));
  };

  const removeFromCheckoutBuffer = (index: number) => {
    setCheckoutBuffer(prev => prev.filter((_, i) => i !== index));
  };

  const handleQRScan = async (raw: string): Promise<ScanResult> => {
    if (isHoliday) {
      return { success: false, message: `Hari Libur${holidayInfo?.description ? `: ${holidayInfo.description}` : ""}` };
    }
    if (isToday && !isWithinTimeWindow) {
      return { success: false, message: getTimeBlockMessage() };
    }

    const trimmedNis = raw.trim();
    const todayDateStr = format(new Date(), "yyyy-MM-dd");

    // Single API call: returns student + today's attendance together
    const { student: studentData, attendance: existing } = await fetch(
      `/api/scan-lookup?q=${encodeURIComponent(trimmedNis)}&date=${todayDateStr}`,
      { credentials: "include" }
    ).then(r => r.json());

    if (!studentData) {
      return { success: false, message: `Siswa tidak ditemukan` };
    }

    if (tab === "checkin") {
      if (existing) {
        return { success: false, message: "Sudah scan hadir!", studentName: studentData.name };
      }

      const alreadyInBuffer = checkinBuffer.some(b => b.student_id === studentData.id);
      if (alreadyInBuffer) {
        return { success: false, message: "Sudah ada di antrian!", studentName: studentData.name };
      }

      setCheckinBuffer(prev => [...prev, {
        student_id: studentData.id,
        class_id: studentData.class_id,
        student_name: studentData.name,
        class_name: studentData.classes?.name || "",
        status: "hadir",
        scanned_at: new Date().toISOString(),
      }]);

      return { success: true, message: "Hadir ✓ (antrian)", studentName: `${studentData.name} - ${studentData.classes?.name || ""}` };
    } else {
      if (!existing) {
        return { success: false, message: "Belum absen masuk!", studentName: studentData.name };
      }
      if (existing.check_out_at) {
        return { success: false, message: "Sudah scan pulang!", studentName: studentData.name };
      }

      const alreadyInBuffer = checkoutBuffer.some(b => b.record_id === existing.id);
      if (alreadyInBuffer) {
        return { success: false, message: "Sudah ada di antrian!", studentName: studentData.name };
      }

      setCheckoutBuffer(prev => [...prev, {
        record_id: existing.id,
        student_id: studentData.id,
        student_name: studentData.name,
        class_name: studentData.classes?.name || "",
        checkout_time: new Date().toISOString(),
      }]);

      return { success: true, message: "Pulang ✓ (antrian)", studentName: studentData.name };
    }
  };

  const bufferedStudentIds = new Set(checkinBuffer.map(b => b.student_id));
  const recordedStudentIds = new Set(todayRecords.map((r: any) => r.student_id));
  const unrecordedStudents = students.filter((s: any) => !recordedStudentIds.has(s.id) && !bufferedStudentIds.has(s.id));
  const newCount = Object.values(statuses).filter(Boolean).length;
  const pendingCount = unrecordedStudents.length - newCount;

  const currentBuffer = tab === "checkin" ? checkinBuffer : checkoutBuffer;
  const currentBufferCount = currentBuffer.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Heading */}
      <div className="rounded-xl bg-gradient-to-r from-[hsl(260,75%,50%)] to-[hsl(220,85%,60%)] px-6 py-5 shadow-lg shadow-violet-500/20">
        <div className="flex items-center gap-2.5 text-white">
          <ClipboardList className="h-5 w-5 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Scan & Absensi</h1>
            <p className="text-white/70 text-xs mt-0.5">Rekam kehadiran siswa masuk dan pulang sekolah</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-xl overflow-hidden shadow-md">
        <button
          onClick={() => setTab("checkin")}
          className={`flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all ${
            tab === "checkin"
              ? "bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Absen Masuk
          {tab === "checkin" && checkinBuffer.length > 0 && (
            <Badge className="bg-white/20 text-white border-none text-[10px] px-1.5">{checkinBuffer.length} antrian</Badge>
          )}
        </button>
        <button
          onClick={() => setTab("checkout")}
          className={`flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all ${
            tab === "checkout"
              ? "bg-gradient-to-r from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)] text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <LogOut className="h-4 w-4" />
          Absen Pulang
          {tab === "checkout" && checkoutBuffer.length > 0 && (
            <Badge className="bg-white/20 text-white border-none text-[10px] px-1.5">{checkoutBuffer.length} antrian</Badge>
          )}
        </button>
      </div>

      {isHoliday && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3.5 shadow-sm">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
            <CalendarOff className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-700">Hari Libur — Absensi Ditutup</p>
            {holidayInfo?.description && (
              <p className="text-xs text-red-500 mt-0.5 truncate">{holidayInfo.description}</p>
            )}
            <p className="text-xs text-red-400 mt-0.5">Scan QR dan input manual tidak dapat dilakukan pada hari libur.</p>
          </div>
        </div>
      )}

      {!isHoliday && isToday && !canSubmit && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive font-medium text-center">
          ⚠️ {getTimeBlockMessage()}
        </div>
      )}

      {currentBufferCount > 0 && (
        <Card className="border-2 border-amber-400 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white min-w-0">
              <Package className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">Antrian {tab === "checkin" ? "Absen Masuk" : "Absen Pulang"}</h3>
                <p className="text-white/80 text-xs">{currentBufferCount} siswa menunggu dikirim</p>
              </div>
            </div>
            <Button
              onClick={() => tab === "checkin" ? sendCheckinMutation.mutate() : sendCheckoutMutation.mutate()}
              disabled={sendCheckinMutation.isPending || sendCheckoutMutation.isPending}
              className="bg-white text-amber-700 hover:bg-white/90 font-bold shadow shrink-0"
              size="sm"
            >
              <Send className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {(sendCheckinMutation.isPending || sendCheckoutMutation.isPending) ? "Mengirim..." : "Kirim ke Laporan Harian"}
              </span>
              <span className="sm:hidden">
                {(sendCheckinMutation.isPending || sendCheckoutMutation.isPending) ? "..." : "Kirim"}
              </span>
            </Button>
          </div>
          <CardContent className="p-0 max-h-[200px] overflow-y-auto">
            {tab === "checkin" ? (
              checkinBuffer.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b last:border-b-0 hover:bg-muted/20 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} text-white text-[10px] font-bold`}>
                      {getInitials(b.student_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.student_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.class_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge className="bg-emerald-500 text-white text-[10px]">{b.status}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{new Date(b.scanned_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <button onClick={() => removeFromCheckinBuffer(i)} className="text-destructive hover:text-destructive/80 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              checkoutBuffer.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b last:border-b-0 hover:bg-muted/20 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} text-white text-[10px] font-bold`}>
                      {getInitials(b.student_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.student_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.class_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge className="bg-emerald-500 text-white text-[10px]">Pulang</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{new Date(b.checkout_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <button onClick={() => removeFromCheckoutBuffer(i)} className="text-destructive hover:text-destructive/80 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "checkin" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[140px]">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pilih Kelas</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[140px]">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tanggal</label>
              <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full" />
            </div>
          </div>
          {classId && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground text-xs">
                <span className="text-emerald-600 font-bold">{newCount} baru</span>
                {" / "}
                <span className="text-destructive font-bold">{pendingCount} belum</span>
                {" "}
                <span className="text-muted-foreground">({todayRecords.length} tersimpan)</span>
              </span>
              {unrecordedStudents.length > 0 && (
                <Button
                  onClick={batchToBuffer}
                  disabled={newCount === 0 || !canSubmit}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90"
                >
                  <Package className="h-4 w-4 mr-1.5" />
                  Tambah ke Antrian
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "checkout" ? (
        <div className="max-w-md mx-auto space-y-4">
          <Card className="border-none shadow-md overflow-hidden">
            <div className="bg-gradient-to-br from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)] p-6 text-center text-white">
              <QrCode className="h-16 w-16 mx-auto mb-3 opacity-80" />
              <h3 className="font-bold text-lg">Scan QR - Absen Pulang</h3>
              <p className="text-white/70 text-sm mt-1">Hasil scan akan ditampung di antrian, klik Kirim jika sudah selesai</p>
            </div>
            <CardContent className="p-4 space-y-3">
              <Button
                onClick={() => {
                  if (!canSubmit) {
                    toast({ title: isHoliday ? "Hari Libur" : "Waktu absensi ditutup", description: isHoliday ? (holidayInfo?.description || "Absensi ditutup pada hari libur") : getTimeBlockMessage(), variant: "destructive" });
                    return;
                  }
                  setScannerOpen(true);
                }}
                disabled={!canSubmit}
                className="w-full text-white hover:opacity-90 bg-gradient-to-r from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)] h-12 text-base"
              >
                <Camera className="h-5 w-5 mr-2" />
                Buka Kamera Live
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden">
            <div className="bg-gradient-to-br from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)] p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4" />
                <h3 className="font-bold text-sm">Jadwal Absensi Hari Ini</h3>
              </div>
              <p className="text-white/70 text-xs">{format(new Date(dateStr), "EEEE", { locale: idLocale })}</p>
            </div>
            <CardContent className="p-4 space-y-2 text-sm">
              {todaySetting ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jam Pulang</span>
                    <span className="font-bold">{todaySetting.check_out_start} - {todaySetting.check_out_end}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Pulang bisa dicatat mulai {todaySetting.check_out_start}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Jadwal tidak tersedia untuk hari ini</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <div className="order-2 lg:order-1">
          {classId ? (
            <Card className="border-none shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                  <div>
                    <h2 className="font-bold text-sm">Scan & Absensi Siswa</h2>
                    <p className="text-white/70 text-xs">Scan QR atau atur status manual</p>
                  </div>
                </div>
                {unrecordedStudents.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/20 text-white border-none hover:bg-white/30"
                    onClick={markAllHadir}
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Tandai Semua
                  </Button>
                )}
              </div>

              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[40px_1fr_auto] items-center px-3 sm:px-5 py-2.5 border-b bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="hidden sm:block">#</span>
                  <span>Nama Siswa</span>
                  <span>Status</span>
                </div>

                {unrecordedStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {students.length === 0 ? "Belum ada siswa di kelas ini" : "Semua siswa sudah diabsen"}
                  </div>
                ) : (
                  unrecordedStudents.map((s: any, i: number) => (
                    <div key={s.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[40px_1fr_auto] items-center px-3 sm:px-5 py-2.5 border-b last:border-b-0 hover:bg-muted/20 transition-colors gap-2">
                      <span className="hidden sm:block text-sm text-muted-foreground">{i + 1}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} text-white text-[10px] sm:text-xs font-bold flex-shrink-0`}>
                          {getInitials(s.name)}
                        </div>
                        <span className="text-xs sm:text-sm font-medium truncate">{s.name}</span>
                      </div>
                      <div className="flex gap-1">
                        {statusOptions.map((opt) => {
                          const active = statuses[s.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: prev[s.id] === opt.value ? "" : opt.value }))}
                              disabled={!canSubmit}
                              title={opt.label}
                              className={`rounded-lg text-xs font-bold transition-all
                                px-1.5 py-1 sm:px-3 sm:py-1.5
                                ${active
                                  ? `${opt.bg} text-white ring-2 ${opt.ring} ring-offset-1`
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                                } ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {/* Mobile: 1-letter abbreviation. Desktop: full label */}
                              <span className="sm:hidden">{active ? "✕" : opt.label.charAt(0)}</span>
                              <span className="hidden sm:inline">{active ? "✕ " : ""}{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-md overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">Pilih kelas untuk input manual</p>
                <p className="text-xs text-muted-foreground mt-1">Atau gunakan kamera scan QR tanpa perlu pilih kelas</p>
              </CardContent>
            </Card>
          )}
          </div>{/* end order-2 lg:order-1 */}

          <div className="order-1 lg:order-2 space-y-4">
            <Card className="border-none shadow-md overflow-hidden">
              <div className="bg-gradient-to-br from-[hsl(168,71%,35%)] to-[hsl(142,71%,38%)] p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4" />
                  <h3 className="font-bold text-sm">Jadwal Absensi Hari Ini</h3>
                </div>
                <p className="text-white/70 text-xs">{format(new Date(dateStr), "EEEE", { locale: idLocale })}</p>
              </div>
              <CardContent className="p-4 space-y-2 text-sm">
                {todaySetting ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jam Masuk</span>
                      <span className="font-bold">{todaySetting.check_in_start} - {todaySetting.check_in_end}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jam Pulang</span>
                      <span className="font-bold">{todaySetting.check_out_start} - {todaySetting.check_out_end}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Absen setelah {todaySetting.check_in_end} akan ditandai terlambat
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Jadwal tidak tersedia untuk hari ini</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden">
              <div className="bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] p-6 text-center text-white">
                <QrCode className="h-12 w-12 mx-auto mb-2 opacity-80" />
                <h3 className="font-bold text-sm">Scan QR Siswa</h3>
                <p className="text-white/70 text-xs">Hasil scan masuk ke antrian dulu</p>
              </div>
              <CardContent className="p-3 space-y-3">
                <p className="text-xs text-muted-foreground text-center mb-2">Scan barcode langsung tanpa perlu pilih kelas</p>
                <Button
                  onClick={() => {
                    if (!canSubmit) {
                      toast({ title: isHoliday ? "Hari Libur" : "Waktu absensi ditutup", description: isHoliday ? (holidayInfo?.description || "Absensi ditutup pada hari libur") : getTimeBlockMessage(), variant: "destructive" });
                      return;
                    }
                    setScannerOpen(true);
                  }}
                  disabled={!canSubmit}
                  className="w-full text-white hover:opacity-90 bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)]"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Buka Kamera Live
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">atau</span></div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Input Nama Manual {!classId && <span className="text-destructive">(pilih kelas dulu)</span>}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ketik nama siswa..."
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="flex-1"
                      disabled={!classId}
                    />
                    <Button
                      size="icon"
                      disabled={!manualName.trim() || !classId || !canSubmit}
                      className="shrink-0 text-white hover:opacity-90 bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)]"
                      onClick={() => {
                        const student = students.find((s: any) => s.name.toLowerCase().includes(manualName.toLowerCase()));
                        const cls = classes.find((c: any) => c.id === classId);
                        if (!student) {
                          toast({ title: "Siswa tidak ditemukan", variant: "destructive" });
                          return;
                        }
                        const already = checkinBuffer.some(b => b.student_id === student.id) || recordedStudentIds.has(student.id);
                        if (already) {
                          toast({ title: "Siswa sudah ada di daftar", variant: "destructive" });
                          return;
                        }
                        setCheckinBuffer(prev => [...prev, {
                          student_id: student.id,
                          class_id: classId,
                          student_name: student.name,
                          class_name: cls?.name || "",
                          status: "hadir",
                          scanned_at: new Date().toISOString(),
                        }]);
                        setManualName("");
                        toast({ title: `${student.name} ditambahkan ke antrian` });
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleQRScan}
      />
    </div>
  );
};

export default History;
