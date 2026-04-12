import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Eye, Send, X, Users, UserX, AlertTriangle, BookOpen, GraduationCap, PowerOff, Clock, Settings2, CheckCircle2, Zap } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const todayStr = () => new Date().toISOString().split("T")[0];

function getClassPrefix(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts.slice(0, -1).join(" ");
}

const WhatsAppReport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "group">("single");
  const [classId, setClassId] = useState("");
  const [gradePrefix, setGradePrefix] = useState("");
  const [date, setDate] = useState(todayStr());
  const [preview, setPreview] = useState<null | {
    message: string;
    classLabel: string;
    totalStudents: number;
    absentCount: number;
    dateStr: string;
    perClassTargets?: { classId: string; className: string; waGroupId: string | null }[];
  }>(null);
  const [showDialog, setShowDialog] = useState(false);

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTime, setAutoTime] = useState("14:00");
  const [autoScope, setAutoScope] = useState("all");
  const autoSettingsLoaded = useRef(false);

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then(r => r.json()),
  });

  const { data: waConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ["web-config"],
    queryFn: () => fetch("/api/web-config", { credentials: "include" }).then(r => r.json()),
  });

  const { data: attendanceSettings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: autoSendSettings } = useQuery({
    queryKey: ["whatsapp-auto-send"],
    queryFn: () => fetch("/api/whatsapp/auto-send", { credentials: "include" }).then(r => r.json()),
  });

  useEffect(() => {
    if (autoSendSettings && !autoSettingsLoaded.current) {
      setAutoEnabled(autoSendSettings.enabled ?? false);
      setAutoTime(autoSendSettings.time ?? "14:00");
      setAutoScope(autoSendSettings.scope ?? "all");
      autoSettingsLoaded.current = true;
    }
  }, [autoSendSettings]);

  const sendNowMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/send-now", {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-send"] });
      toast({ title: `✅ Berhasil dikirim ke ${res.sent_to}! (${res.classes} kelas)` });
    },
    onError: (e: Error) => {
      toast({ title: "Gagal mengirim", description: e.message, variant: "destructive" });
    },
  });

  const saveAutoSendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/whatsapp/auto-send", {
      enabled: autoEnabled,
      time: autoTime,
      scope: autoScope,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-send"] });
      toast({ title: "✅ Pengaturan kirim otomatis disimpan!" });
    },
    onError: (e: Error) => {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    },
  });

  const getDateSetting = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAMES_ID[d.getDay()];
    return (attendanceSettings as any[]).find((s: any) => s.day_of_week === dayName);
  };
  const selectedDateSetting = date ? getDateSetting(date) : null;
  const isSelectedDateEnabled = !selectedDateSetting || selectedDateSetting.enabled === true;

  const gradeGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    classes.forEach(c => {
      const prefix = getClassPrefix(c.name);
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix)!.push(c);
    });
    return Array.from(map.entries())
      .filter(([, list]) => list.length > 1)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [classes]);

  const selectedClassIds: string[] = useMemo(() => {
    if (mode === "single") return classId ? [classId] : [];
    if (mode === "group" && gradePrefix) {
      const group = gradeGroups.find(([prefix]) => prefix === gradePrefix);
      return group ? group[1].map((c: any) => c.id) : [];
    }
    return [];
  }, [mode, classId, gradePrefix, gradeGroups]);

  const hasSelection = selectedClassIds.length > 0;

  const handlePreview = async () => {
    if (!hasSelection || !date) {
      toast({ title: "Pilih kelas dan tanggal terlebih dahulu", variant: "destructive" });
      return;
    }
    const params = new URLSearchParams({ class_ids: selectedClassIds.join(","), date });
    const res = await fetch(`/api/whatsapp/preview?${params}`, { credentials: "include" });
    const data = await res.json();
    if (data.error) {
      toast({ title: "Gagal memuat preview", description: data.error, variant: "destructive" });
    } else {
      setPreview(data);
    }
  };

  const [isFetching, setIsFetching] = useState(false);
  const wrappedPreview = async () => {
    setIsFetching(true);
    try { await handlePreview(); } finally { setIsFetching(false); }
  };

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/send", { class_ids: selectedClassIds, date }),
    onSuccess: (res: any) => {
      if (res.failed && res.failed > 0) {
        toast({
          title: `⚠️ Sebagian berhasil`,
          description: `${res.sent} berhasil, ${res.failed} gagal dikirim.`,
          variant: "destructive",
        });
      } else {
        toast({ title: `✅ Berhasil dikirim ke ${res.sent || 1} grup WhatsApp!` });
      }
      setShowDialog(false);
    },
    onError: (e: Error) => {
      toast({ title: "Gagal mengirim", description: e.message, variant: "destructive" });
    },
  });

  const isConfigured = !!waConfig?.wa_token;

  const modeClasses = (m: "single" | "group") =>
    `flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
      mode === m
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
    }`;

  const selectedGradeClasses = gradeGroups.find(([p]) => p === gradePrefix)?.[1] ?? [];

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="rounded-xl bg-gradient-to-r from-[hsl(142,70%,35%)] to-[hsl(168,70%,42%)] px-6 py-5 shadow-lg shadow-green-700/20">
        <div className="flex items-center gap-2.5 text-white">
          <SiWhatsapp className="h-5 w-5 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Kirim Rekap ke WhatsApp</h1>
            <p className="text-white/70 text-xs mt-0.5">Kirim laporan absensi harian ke grup WhatsApp kelas</p>
          </div>
        </div>
      </div>

      {!isConfigLoading && !isConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Konfigurasi WhatsApp belum lengkap</p>
            <p className="text-amber-600 dark:text-amber-500 mt-0.5">
              Token API WhatsApp belum diatur. Silakan lengkapi di menu{" "}
              <a href="/admin/config" className="underline font-medium">Konfigurasi WebApps</a>.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pilih Kelas &amp; Tanggal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl bg-muted border">
            <button
              type="button"
              onClick={() => { setMode("single"); setGradePrefix(""); setPreview(null); }}
              className={modeClasses("single")}
              data-testid="mode-single"
            >
              <BookOpen className="h-4 w-4" />
              Satu Kelas
            </button>
            <button
              type="button"
              onClick={() => { setMode("group"); setClassId(""); setPreview(null); }}
              className={modeClasses("group")}
              data-testid="mode-group"
            >
              <GraduationCap className="h-4 w-4" />
              Satu Jenis Kelas
            </button>
          </div>

          {mode === "single" && (
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Pilih Kelas *</Label>
              <Select value={classId} onValueChange={v => { setClassId(v); setPreview(null); }}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder="-- Pilih Kelas --" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "group" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Pilih Jenis Kelas *</Label>
                {gradeGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Belum ada kelas dengan jenis yang sama. Tambahkan kelas seperti "VII A", "VII B" terlebih dahulu.
                  </p>
                ) : (
                  <Select value={gradePrefix} onValueChange={v => { setGradePrefix(v); setPreview(null); }}>
                    <SelectTrigger data-testid="select-grade-group">
                      <SelectValue placeholder="-- Pilih Jenis Kelas --" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeGroups.map(([prefix, list]) => (
                        <SelectItem key={prefix} value={prefix}>
                          Kelas {prefix} ({list.length} kelas: {list.map((c: any) => c.name).join(", ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {gradePrefix && selectedGradeClasses.length > 0 && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Kelas yang akan direkap:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGradeClasses.map((c: any) => (
                      <span key={c.id} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium border border-primary/20">
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Tanggal *</Label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setPreview(null); }}
              data-testid="input-date"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {!isSelectedDateEnabled && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <PowerOff className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Absensi hari <span className="font-medium text-slate-600 dark:text-slate-300">{selectedDateSetting?.day_of_week}</span> belum diaktifkan — rekap WA masih kosong karena belum ada data absensi untuk tanggal ini.
              </p>
            </div>
          )}

          <Button
            onClick={wrappedPreview}
            disabled={!hasSelection || isFetching}
            variant="outline"
            className="gap-2 border-violet-400 text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
            data-testid="button-preview"
          >
            <Eye className="h-4 w-4" />
            {isFetching ? "Memuat..." : "Preview Pesan"}
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-violet-700 dark:text-violet-400">Preview Pesan:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed text-foreground">
              {preview.message}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-4 text-center">
                <Users className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-600">{preview.totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Siswa</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <UserX className="h-4 w-4 text-destructive mx-auto mb-1" />
                <p className="text-2xl font-bold text-destructive">{preview.absentCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tidak Hadir</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPreview(null)} className="gap-2" data-testid="button-batal">
                <X className="h-4 w-4" />
                Batal
              </Button>
              <Button
                onClick={() => setShowDialog(true)}
                disabled={!isConfigured}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-send-wa"
              >
                <Send className="h-4 w-4" />
                Kirim ke WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-100 dark:border-blue-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-500" />
            Kirim Otomatis
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Rekap akan otomatis dikirim ke setiap grup WhatsApp kelas sesuai waktu yang ditentukan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Aktifkan Kirim Otomatis</p>
              <p className="text-xs text-muted-foreground">Server akan mengirim rekap setiap hari pada waktu yang ditentukan</p>
            </div>
            <Switch
              checked={autoEnabled}
              onCheckedChange={setAutoEnabled}
              data-testid="switch-auto-send"
            />
          </div>

          {autoEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Waktu Kirim (WIB)
                </Label>
                <input
                  type="time"
                  value={autoTime}
                  onChange={e => setAutoTime(e.target.value)}
                  data-testid="input-auto-time"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Kelas yang Dikirim</Label>
                <Select value={autoScope} onValueChange={setAutoScope}>
                  <SelectTrigger data-testid="select-auto-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas (1 pesan gabungan, urut A–Z)</SelectItem>
                    {gradeGroups.map(([prefix]) => (
                      <SelectItem key={prefix} value={prefix}>Kelas {prefix} saja</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Semua kelas digabung menjadi <strong>1 pesan</strong> dan dikirim sekali ke nomor/grup WA global. Kelas diurutkan otomatis dari A ke Z.
                </p>
              </div>

              {autoSendSettings?.last_sent_date && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Terakhir terkirim: {autoSendSettings.last_sent_date}
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {autoEnabled && (
              <Button
                onClick={() => sendNowMutation.mutate()}
                disabled={sendNowMutation.isPending || !isConfigured}
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-send-now"
              >
                <Zap className="h-3.5 w-3.5" />
                {sendNowMutation.isPending ? "Mengirim..." : "Kirim Sekarang"}
              </Button>
            )}
            <Button
              onClick={() => saveAutoSendMutation.mutate()}
              disabled={saveAutoSendMutation.isPending || !isConfigured}
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-auto-send"
            >
              {saveAutoSendMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>

          {!isConfigured && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Token WhatsApp harus dikonfigurasi terlebih dahulu sebelum mengaktifkan kirim otomatis.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-green-500" />
              Konfirmasi Pengiriman
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kelas yang direkap:</p>
              <p className="font-semibold text-foreground">{preview?.classLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Dikirim ke:</p>
              <p className="font-semibold text-foreground font-mono">
                {(preview?.perClassTargets?.length === 1
                  ? preview.perClassTargets[0]?.waGroupId
                  : null) || waConfig?.wa_target_number || "—"}
              </p>
            </div>
            {(preview?.perClassTargets?.length ?? 0) > 1 && (
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                ✅ Semua data kelas digabung menjadi <strong>1 pesan</strong> dan dikirim sekaligus.
              </div>
            )}
            <p>Provider: <span className="capitalize font-medium">{waConfig?.wa_provider || "fonnte"}</span></p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="gap-1.5">
              <X className="h-4 w-4" />
              Batal
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirm-send"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? "Mengirim..." : "Kirim ke WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppReport;
