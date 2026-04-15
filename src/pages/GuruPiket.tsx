import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shield, Plus, Trash2, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

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
    queryFn: async () => {
      const { data } = await supabase.from("guru_piket_assignments").select("*").order("day_of_week");
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, user_id, name, username");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = (roles ?? []).reduce<Record<string, string[]>>((acc, r: any) => {
        if (!acc[r.user_id]) acc[r.user_id] = [];
        acc[r.user_id].push(r.role);
        return acc;
      }, {});
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: roleMap[p.user_id] || [],
      }));
    },
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_settings").select("*");
      return data ?? [];
    },
  });

  const enabledDays = (settings as any[]).filter((s: any) => s.enabled).map((s: any) => s.day_of_week);

  const addMutation = useMutation({
    mutationFn: async () => {
      const records = selectedUsers.map((uid) => {
        const u = (users as any[]).find((u: any) => u.user_id === uid);
        return {
          day_of_week: dayOfWeek,
          user_id: uid,
          user_name: u?.name || "",
        };
      });
      const { error } = await supabase.from("guru_piket_assignments").insert(records);
      if (error) throw new Error(error.message);
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guru_piket_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guru-piket"] });
      toast({ title: "Jadwal piket dihapus" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const groupedByDay = days.reduce<Record<string, any[]>>((acc, day) => {
    acc[day] = (assignments as any[]).filter((a: any) => a.day_of_week === day);
    return acc;
  }, {});

  const alreadyAssignedUsers = ((assignments as any[])
    .filter((a: any) => a.day_of_week === dayOfWeek)
    .map((a: any) => a.user_id));

  const availableUsers = (users as any[]).filter(
    (u: any) => !alreadyAssignedUsers.includes(u.user_id)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5">
        <div className="flex items-center gap-2 text-white">
          <Shield className="h-5 w-5" />
          <h1 className="text-xl font-bold">Jadwal Guru Piket</h1>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Tambah Jadwal Piket
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map(d => (
                  <SelectItem key={d} value={d}>
                    {d}
                    {!enabledDays.includes(d) && (
                      <span className="ml-2 text-[10px] text-muted-foreground">(nonaktif)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left">
                  {selectedUsers.length === 0
                    ? "Pilih guru..."
                    : `${selectedUsers.length} guru dipilih`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-3 space-y-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Semua guru sudah ditambahkan</p>
                ) : (
                  availableUsers.map((u: any) => (
                    <label key={u.user_id} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={selectedUsers.includes(u.user_id)}
                        onCheckedChange={(checked) => {
                          setSelectedUsers(prev =>
                            checked ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id)
                          );
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                      </div>
                    </label>
                  ))
                )}
              </PopoverContent>
            </Popover>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || selectedUsers.length === 0}
              className="bg-violet-500 hover:bg-violet-600 text-white shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {days.map(day => {
          const dayAssignments = groupedByDay[day] || [];
          const isEnabled = enabledDays.includes(day);
          return (
            <Card key={day} className={`border-none shadow-sm ${!isEnabled ? "opacity-60" : ""}`}>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-violet-500" />
                    <span className="font-bold">{day}</span>
                    {!isEnabled && <Badge variant="outline" className="text-[10px]">Nonaktif</Badge>}
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-full">
                    {dayAssignments.length} guru
                  </Badge>
                </div>
                {dayAssignments.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 opacity-40" />
                    Belum ada guru piket untuk hari ini
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {dayAssignments.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="font-medium text-sm">{a.user_name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(a.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GuruPiket;
