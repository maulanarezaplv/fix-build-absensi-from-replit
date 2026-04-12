import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shield, Plus, Trash2, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const GuruPiket = () => {
  const [dayOfWeek, setDayOfWeek] = useState(days[0]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();

  useRealtimeSubscription("guru_piket_assignments", [["guru-piket"]]);
  useRealtimeSubscription("profiles", [["users"]]);
  const qc = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ["guru-piket"],
    queryFn: () => fetch("/api/guru-piket", { credentials: "include" }).then(r => r.json()),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users", { credentials: "include" }).then(r => r.json()),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () => fetch("/api/attendance-settings", { credentials: "include" }).then(r => r.json()),
  });

  const enabledDays = settings.filter((s: any) => s.enabled).map((s: any) => s.day_of_week);

  const addMutation = useMutation({
    mutationFn: () => {
      const records = selectedUsers.map((uid) => {
        const u = users.find((u: any) => u.user_id === uid);
        return {
          day_of_week: dayOfWeek,
          user_id: uid,
          user_name: u?.name || "",
        };
      });
      return apiRequest("POST", "/api/guru-piket", { records });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guru-piket"] });
      toast({ title: "Guru piket ditambahkan" });
      setSelectedUsers([]);
      setPopoverOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/guru-piket/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guru-piket"] });
      toast({ title: "Penugasan dihapus" });
    },
  });

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleAll = () => {
    const assignedIds = assignments.filter((a: any) => a.day_of_week === dayOfWeek).map((a: any) => a.user_id);
    const available = users.filter((u: any) => !assignedIds.includes(u.user_id));
    if (selectedUsers.length === available.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(available.map((u: any) => u.user_id));
    }
  };

  const grouped = days
    .filter((d) => enabledDays.includes(d))
    .map((day) => ({
      day,
      teachers: assignments.filter((a: any) => a.day_of_week === day),
    }));

  const assignedIdsForDay = assignments.filter((a: any) => a.day_of_week === dayOfWeek).map((a: any) => a.user_id);
  const availableUsers = users.filter((u: any) => !assignedIdsForDay.includes(u.user_id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="h-6 w-6" />
          <h1 className="text-xl font-bold">Guru Piket</h1>
        </div>
        <p className="text-white/80 text-sm">Atur jadwal guru piket per hari sesuai pengaturan waktu absensi</p>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hari</label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledDays.map((d: string) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pilih Guru</label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {selectedUsers.length > 0 ? `${selectedUsers.length} guru dipilih` : "Pilih guru..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm font-medium">
                      <Checkbox
                        checked={availableUsers.length > 0 && selectedUsers.length === availableUsers.length}
                        onCheckedChange={toggleAll}
                      />
                      Pilih Semua
                    </label>
                    <div className="border-t my-1" />
                    {availableUsers.map((u: any) => (
                      <label key={u.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedUsers.includes(u.user_id)}
                          onCheckedChange={() => toggleUser(u.user_id)}
                        />
                        {u.name}
                      </label>
                    ))}
                    {availableUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Semua guru sudah ditugaskan</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || selectedUsers.length === 0}
              className="bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white hover:opacity-90 sm:self-end"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          {grouped.map(({ day, teachers }) => (
            <div key={day} className="border-b last:border-b-0">
              <div className="flex items-center justify-between px-5 py-3 bg-muted/50">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>{day}</span>
                </div>
                <Badge
                  variant={teachers.length > 0 ? "default" : "secondary"}
                  className={teachers.length > 0
                    ? "bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white border-none"
                    : ""
                  }
                >
                  {teachers.length > 0 ? `${teachers.length} guru` : "Belum diatur"}
                </Badge>
              </div>

              {teachers.length === 0 ? (
                <div className="px-5 py-3">
                  <p className="text-sm text-muted-foreground italic">Belum ada guru piket untuk hari ini</p>
                </div>
              ) : (
                teachers.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white text-xs font-bold">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{t.user_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default GuruPiket;
