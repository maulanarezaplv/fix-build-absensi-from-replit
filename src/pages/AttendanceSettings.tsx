import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getWebConfig } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, CalendarOff, Plus, Trash2, CalendarCheck2, CalendarCog, PowerOff, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const AttendanceSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  useRealtimeSubscription("attendance_settings", [["attendance-settings"]]);
  useRealtimeSubscription("holidays", [["holidays"]]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [schoolStart, setSchoolStart] = useState("");

  const { data: settings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: () => fetch("/api/holidays", { credentials: "include" }).then(r => r.json()),
  });

  const { data: webConfig } = useQuery<any>({
    queryKey: ["web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (webConfig?.school_start_date) setSchoolStart(webConfig.school_start_date);
  }, [webConfig]);

  const saveSchoolStartMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/web-config", { school_start_date: schoolStart || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web-config"] });
      toast({ title: "Tanggal mulai sekolah disimpan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: any }) => {
      return apiRequest("PATCH", `/api/attendance-settings/${id}`, { [field]: value });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
      toast({ title: "Pengaturan disimpan" });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await Promise.all(
        settings.map((s: any) =>
          apiRequest("PATCH", `/api/attendance-settings/${s.id}`, { enabled })
        )
      );
    },
    onSuccess: (_data, enabled) => {
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
      toast({ title: enabled ? "Semua hari diaktifkan" : "Semua hari dinonaktifkan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addHolidayMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/holidays", {
      start_date: startDate,
      end_date: endDate || startDate,
      description,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: "Hari libur ditambahkan" });
      setStartDate("");
      setEndDate("");
      setDescription("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: "Hari libur dihapus" });
    },
  });

  const weekendDays = ["Sabtu", "Minggu"];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page heading ── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/30">
            <CalendarCog className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">Kelola Absen</h1>
            <p className="text-xs text-muted-foreground">Atur jam, hari libur, dan tanggal mulai sekolah</p>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck2 className="h-5 w-5" /> Tanggal Mulai Sekolah
          </CardTitle>
          <p className="text-white/80 text-sm">
            Absensi dihitung mulai dari tanggal ini <span className="font-bold text-white">(tanggal ini ikut dihitung)</span>. Hari sebelumnya tidak dianggap alpa.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 block">
                Tanggal Mulai Tahun Ajaran / Masuk Sekolah
              </Label>
              <Input
                type="date"
                value={schoolStart}
                onChange={(e) => setSchoolStart(e.target.value)}
                className="h-9 max-w-xs"
                data-testid="input-school-start-date"
              />
              {webConfig?.school_start_date && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Saat ini: <span className="font-semibold text-foreground">
                    {format(new Date(webConfig.school_start_date + "T00:00:00"), "dd MMMM yyyy")}
                  </span>
                </p>
              )}
              {!webConfig?.school_start_date && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠ Belum diatur — semua hari aktif di rekap akan dihitung alpa jika tidak ada absensi.
                </p>
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
              onClick={() => saveSchoolStartMutation.mutate()}
              disabled={saveSchoolStartMutation.isPending}
              data-testid="button-save-school-start"
            >
              Simpan Tanggal
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" /> Pengaturan Waktu Absensi
              </CardTitle>
              <p className="text-white/80 text-sm mt-1">Konfigurasi jam operasional absensi per hari.</p>
            </div>
            <div className="flex gap-2 flex-wrap sm:shrink-0">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs font-semibold flex-1 sm:flex-none"
                onClick={() => bulkToggleMutation.mutate(true)}
                disabled={bulkToggleMutation.isPending}
                data-testid="button-enable-all-days"
              >
                <Power className="h-3.5 w-3.5 mr-1" /> Aktifkan Semua
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/20 hover:bg-black/30 text-white border-white/20 text-xs font-semibold flex-1 sm:flex-none"
                onClick={() => bulkToggleMutation.mutate(false)}
                disabled={bulkToggleMutation.isPending}
                data-testid="button-disable-all-days"
              >
                <PowerOff className="h-3.5 w-3.5 mr-1" /> Non-aktifkan Semua
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3">
            {settings.map((s: any) => {
              const isWeekend = weekendDays.includes(s.day_of_week);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 transition-all ${!s.enabled ? "opacity-50 bg-muted/30" : "bg-card"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span className="font-bold text-sm text-foreground">{s.day_of_week}</span>
                      {isWeekend && !s.enabled && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Libur</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{s.enabled ? "Aktif" : "Nonaktif"}</span>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => updateMutation.mutate({ id: s.id, field: "enabled", value: v })}
                        data-testid={`switch-day-${s.day_of_week}`}
                      />
                    </div>
                  </div>

                  {s.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> JAM DATANG
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Buka</Label>
                            <Input
                              type="time"
                              defaultValue={s.check_in_start}
                              className="h-9 text-sm"
                              onBlur={(e) => updateMutation.mutate({ id: s.id, field: "check_in_start", value: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Tutup</Label>
                            <Input
                              type="time"
                              defaultValue={s.check_in_end}
                              className="h-9 text-sm"
                              onBlur={(e) => updateMutation.mutate({ id: s.id, field: "check_in_end", value: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> JAM PULANG
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Buka</Label>
                            <Input
                              type="time"
                              defaultValue={s.check_out_start}
                              className="h-9 text-sm"
                              onBlur={(e) => updateMutation.mutate({ id: s.id, field: "check_out_start", value: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Tutup</Label>
                            <Input
                              type="time"
                              defaultValue={s.check_out_end}
                              className="h-9 text-sm"
                              onBlur={(e) => updateMutation.mutate({ id: s.id, field: "check_out_end", value: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-destructive to-[hsl(25,95%,53%)] text-white pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarOff className="h-5 w-5" /> Daftar Hari Libur
          </CardTitle>
          <p className="text-white/80 text-sm">Siswa tidak bisa absen pada tanggal yang ditentukan.</p>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Tambah Hari Libur</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr] gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Tanggal Mulai</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Tanggal Akhir</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Keterangan</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Maulid Nabi" className="h-9" />
              </div>
            </div>
            <Button
              className="mt-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              onClick={() => { if (startDate && description) addHolidayMutation.mutate(); }}
              disabled={!startDate || !description || addHolidayMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Tambah Hari Libur
            </Button>
          </div>

          {holidays.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada hari libur yang ditambahkan</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{h.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(h.start_date), "dd/MM/yyyy")}
                      {h.end_date !== h.start_date && ` — ${format(new Date(h.end_date), "dd/MM/yyyy")}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => deleteHolidayMutation.mutate(h.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceSettings;
