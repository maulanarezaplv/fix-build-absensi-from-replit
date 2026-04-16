import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Users, PowerOff, ShieldCheck, Clock, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const Validation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  useRealtimeSubscription("attendance_records", [["validation-records"]]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["validation-records", selectedDate],
    queryFn: () =>
      fetch(`/api/attendance?date=${selectedDate}&status=izin,sakit`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: attendanceSettings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: () => fetch("/api/profiles", { credentials: "include" }).then(r => r.json()),
  });

  const getSettingForDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const dayName = DAY_NAMES_ID[d.getDay()];
    return (attendanceSettings as any[]).find((s: any) => s.day_of_week === dayName);
  };
  const selectedDateSetting = getSettingForDate(selectedDate);
  const isSelectedDateEnabled = !selectedDateSetting || selectedDateSetting.enabled === true;

  const profileMap = profiles.reduce<Record<string, string>>((acc, p: any) => {
    acc[p.user_id] = p.name;
    return acc;
  }, {});

  const validateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      if (status === "rejected") {
        return apiRequest("DELETE", `/api/attendance/${id}`);
      } else {
        return apiRequest("PATCH", `/api/attendance/${id}`, {
          validation_status: "approved",
          validated_by: user?.id || null,
        });
      }
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["validation-records"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
      qc.invalidateQueries({ queryKey: ["today-records"] });
      qc.invalidateQueries({ queryKey: ["report-records"] });
      qc.invalidateQueries({ queryKey: ["attendance-rekap"] });
      toast({ title: status === "approved" ? "✅ Absensi disetujui" : "❌ Absensi ditolak & dihapus" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grouped = records.reduce<Record<string, { className: string; items: any[] }>>((acc, r: any) => {
    const cName = r.classes?.name || "Tanpa Kelas";
    if (!acc[cName]) acc[cName] = { className: cName, items: [] };
    acc[cName].items.push(r);
    return acc;
  }, {});

  const totalPending  = records.filter((r: any) => r.validation_status === "pending").length;
  const totalApproved = records.filter((r: any) => r.validation_status === "approved").length;
  const totalAll      = records.length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Banner Header ── */}
      <div className="rounded-xl bg-gradient-to-r from-[hsl(38,88%,42%)] to-[hsl(22,90%,52%)] px-6 py-5 shadow-lg shadow-amber-600/20">
        <div className="flex items-center gap-2.5 text-white">
          <ShieldCheck className="h-5 w-5 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Validasi Absen</h1>
            <p className="text-white/70 text-xs mt-0.5">Periksa dan setujui laporan izin & sakit siswa</p>
          </div>
        </div>
      </div>

      {/* ── Filter Tanggal ── */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="space-y-1.5 flex-1 sm:flex-none">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tanggal</p>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-56 bg-background"
              />
            </div>
            {totalAll > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold gap-1">
                  <Clock className="h-3 w-3" />
                  {totalPending} Menunggu
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold gap-1">
                  <CheckCheck className="h-3 w-3" />
                  {totalApproved} Disetujui
                </Badge>
                <Badge className="bg-muted text-muted-foreground border border-border font-semibold">
                  {totalAll} Total
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Peringatan hari nonaktif ── */}
      {!isSelectedDateEnabled && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <PowerOff className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Absensi Tidak Aktif</p>
            <p className="text-amber-600 dark:text-amber-500 mt-0.5">
              Pengaturan absensi hari <span className="font-bold">{selectedDateSetting?.day_of_week}</span> belum diaktifkan,
              sehingga data laporan masih kosong untuk tanggal ini.
            </p>
          </div>
        </div>
      )}

      {/* ── Tabel data ── */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Tidak ada laporan izin/sakit</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              untuk tanggal {format(new Date(selectedDate + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale })}
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.values(grouped).map(({ className, items }) => {
          const pendingCount = items.filter(r => r.validation_status === "pending").length;
          return (
            <Card key={className} className="border border-border/60 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(38,88%,42%)]/10 dark:bg-[hsl(38,88%,42%)]/15 border-b border-border/60">
                <Users className="h-4 w-4 text-[hsl(38,88%,40%)] dark:text-[hsl(38,88%,60%)]" />
                <span className="font-bold text-sm text-[hsl(38,88%,38%)] dark:text-[hsl(38,88%,62%)]">
                  {className}
                </span>
                <span className="text-xs text-muted-foreground">{items.length} laporan</span>
                {pendingCount > 0 && (
                  <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white border-0 text-xs">
                    <Clock className="h-2.5 w-2.5 mr-1" />
                    {pendingCount} menunggu
                  </Badge>
                )}
              </div>

              <CardContent className="p-0">
                {/* ── Mobile: card list ── */}
                <div className="md:hidden divide-y divide-border/60">
                  {items.map((r: any, i: number) => (
                    <div key={r.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-sm leading-tight truncate">{r.students?.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {r.submitted_at ? format(new Date(r.submitted_at), "HH:mm") : "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge
                            className={
                              r.status === "izin"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold uppercase text-[11px]"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold uppercase text-[11px]"
                            }
                          >
                            {r.status.toUpperCase()}
                          </Badge>
                          {r.validation_status === "pending" && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold text-[11px]">
                              Menunggu
                            </Badge>
                          )}
                          {r.validation_status === "approved" && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]">
                              ✓ Disetujui
                            </Badge>
                          )}
                        </div>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 leading-relaxed">
                          {r.notes}
                        </p>
                      )}
                      {r.validation_status === "pending" && (
                        <div className="flex gap-2 pt-0.5">
                          <Button
                            size="sm"
                            className="flex-1 h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            onClick={() => validateMutation.mutate({ id: r.id, status: "approved" })}
                            disabled={validateMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />Setujui
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-8 gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs"
                            onClick={() => validateMutation.mutate({ id: r.id, status: "rejected" })}
                            disabled={validateMutation.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5" />Tolak
                          </Button>
                        </div>
                      )}
                      {r.validation_status === "approved" && r.validated_by && (
                        <p className="text-[10px] text-muted-foreground italic">oleh: {profileMap[r.validated_by] || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Desktop: table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-10 font-bold">NO</TableHead>
                        <TableHead className="font-bold">WAKTU</TableHead>
                        <TableHead className="font-bold">NAMA SISWA</TableHead>
                        <TableHead className="font-bold">STATUS</TableHead>
                        <TableHead className="font-bold">KETERANGAN</TableHead>
                        <TableHead className="font-bold">VALIDASI</TableHead>
                        <TableHead className="text-right font-bold">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r: any, i: number) => (
                        <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {r.submitted_at ? format(new Date(r.submitted_at), "HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="font-bold uppercase">{r.students?.name}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                r.status === "izin"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold uppercase"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold uppercase"
                              }
                            >
                              {r.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                            {r.notes || <span className="italic opacity-50">—</span>}
                          </TableCell>
                          <TableCell>
                            {r.validation_status === "pending" && (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold">
                                Menunggu
                              </Badge>
                            )}
                            {r.validation_status === "approved" && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                                Disetujui
                              </Badge>
                            )}
                            {r.validation_status === "rejected" && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 font-semibold">
                                Ditolak
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              {r.validation_status === "pending" && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs"
                                    onClick={() => validateMutation.mutate({ id: r.id, status: "approved" })}
                                    disabled={validateMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Setujui
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs"
                                    onClick={() => validateMutation.mutate({ id: r.id, status: "rejected" })}
                                    disabled={validateMutation.isPending}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Tolak
                                  </Button>
                                </div>
                              )}
                              {r.validation_status === "approved" && r.validated_by && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  oleh: {profileMap[r.validated_by] || "—"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default Validation;
