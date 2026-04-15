import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const Validation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  useRealtimeSubscription("attendance_records", [["validation-records"]]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["validation-records", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*, students(name, nis, class_id), classes(name)")
        .eq("date", selectedDate)
        .in("status", ["izin", "sakit"]);
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

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, user_id, name");
      return data ?? [];
    },
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
        const { error } = await supabase.from("attendance_records").delete().eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("attendance_records").update({
          validation_status: "approved",
          validated_by: user?.id || null,
        }).eq("id", id);
        if (error) throw new Error(error.message);
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

  const validateAllMutation = useMutation({
    mutationFn: async () => {
      const pending = (records as any[]).filter((r: any) => r.validation_status === "pending");
      if (pending.length === 0) throw new Error("Tidak ada yang perlu divalidasi");
      await Promise.all(
        pending.map((r: any) =>
          supabase.from("attendance_records").update({
            validation_status: "approved",
            validated_by: user?.id || null,
          }).eq("id", r.id)
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["validation-records"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "✅ Semua absensi disetujui" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grouped = (records as any[]).reduce<Record<string, { className: string; items: any[] }>>((acc, r: any) => {
    const cName = r.classes?.name || "Tanpa Kelas";
    if (!acc[cName]) acc[cName] = { className: cName, items: [] };
    acc[cName].items.push(r);
    return acc;
  }, {});

  const pendingCount = (records as any[]).filter((r: any) => r.validation_status === "pending").length;

  const statusBadge = (status: string, valStatus: string) => {
    if (valStatus === "approved") return <Badge className="bg-emerald-500 text-white text-[10px]"><CheckCheck className="h-3 w-3 mr-1" />Disetujui</Badge>;
    if (status === "izin") return <Badge className="bg-blue-500 text-white text-[10px]"><Clock className="h-3 w-3 mr-1" />Izin</Badge>;
    return <Badge className="bg-amber-500 text-white text-[10px]"><Clock className="h-3 w-3 mr-1" />Sakit</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-xl font-bold">Validasi Absensi</h1>
          </div>
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={() => validateAllMutation.mutate()}
              disabled={validateAllMutation.isPending}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 border shrink-0"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Setujui Semua ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm font-medium whitespace-nowrap">Pilih Tanggal:</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-[180px]"
            />
          </div>
          {!isSelectedDateEnabled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <PowerOff className="h-4 w-4 text-destructive" />
              <span>Absensi nonaktif untuk hari ini</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Memuat...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-muted-foreground">Tidak ada pengajuan izin/sakit</p>
            <p className="text-xs text-muted-foreground/60 mt-1">untuk tanggal {format(new Date(selectedDate + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale })}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([className, { items }]) => (
          <Card key={className} className="border-none shadow-sm">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="font-bold">{className}</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-full">
                  {items.length} siswa
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Diajukan oleh</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.students?.name || "—"}</TableCell>
                        <TableCell>{statusBadge(r.status, r.validation_status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          {r.notes || <span className="italic opacity-50">Tidak ada keterangan</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.submitted_by ? (profileMap[r.submitted_by] || "—") : <span className="italic opacity-50">Publik</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.validation_status === "pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                className="h-7 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2"
                                onClick={() => validateMutation.mutate({ id: r.id, status: "approved" })}
                                disabled={validateMutation.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />Setuju
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-destructive hover:bg-destructive/10 text-xs px-2"
                                onClick={() => validateMutation.mutate({ id: r.id, status: "rejected" })}
                                disabled={validateMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />Disetujui
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default Validation;
