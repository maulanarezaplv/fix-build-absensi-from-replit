import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserCog, Eye, EyeOff, Pencil, Trash2, RefreshCw, Users, ShieldCheck, UserPlus } from "lucide-react";
import { FaUserGraduate } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface UserData {
  id: string;
  user_id: string;
  name: string;
  username: string;
  password?: string | null;
  roles: string[];
}

const EditUserDialog = ({
  user,
  open,
  onOpenChange,
}: {
  user: UserData;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  const [editName, setEditName] = useState(user.name);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editPassword, setEditPassword] = useState(user.password || "");
  const [showPassword, setShowPassword] = useState(false);
  const [editRole, setEditRole] = useState<"admin" | "guru">(
    user.roles.includes("admin") ? "admin" : "guru"
  );
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/users/${user.id}`, {
      name: editName,
      username: editUsername,
      ...(editPassword ? { password: editPassword } : {}),
      role: editRole,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: "Pengguna berhasil diperbarui" });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-violet-500" />
            Edit Pengguna
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label className="font-bold">Nama Lengkap</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Username</Label>
            <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold">Password</Label>
              {user.password && (
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Password tersimpan
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Kosongkan jika tidak ingin mengubah"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {user.password
                ? "Password saat ini ditampilkan. Ubah jika perlu, kosongkan untuk biarkan tetap."
                : "Isi untuk menetapkan password baru."}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Role</Label>
            <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "guru")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guru">Guru</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-[hsl(315,70%,42%)] hover:bg-[hsl(315,70%,37%)] text-white"
            >
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UserManagement = () => {
  useRealtimeSubscription("profiles", [["admin-users"]]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "guru">("guru");
  const [batchText, setBatchText] = useState("");
  const [batchPassword, setBatchPassword] = useState("");
  const [batchRole, setBatchRole] = useState<"admin" | "guru">("guru");
  const { toast } = useToast();
  const qc = useQueryClient();

  const batchNames = batchText.split("\n").map((n) => n.trim()).filter(Boolean);

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: () => fetch("/api/users", { credentials: "include" }).then(r => r.json()),
  });

  const createSingleMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/users", { username, password, name, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: "Pengguna berhasil dibuat" });
      setOpen(false);
      setName(""); setUsername(""); setPassword(""); setRole("guru");
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createBatchMutation = useMutation({
    mutationFn: async () => {
      if (batchNames.length === 0) throw new Error("Masukkan minimal 1 nama");
      if (!batchPassword) throw new Error("Password wajib diisi");
      const errors: string[] = [];
      for (const n of batchNames) {
        const uname = n.toLowerCase().replace(/\s+/g, "");
        try {
          await apiRequest("POST", "/api/users", { username: uname, password: batchPassword, name: n, role: batchRole });
        } catch (e: any) {
          errors.push(`${n}: ${e.message}`);
        }
      }
      if (errors.length > 0 && errors.length === batchNames.length) throw new Error(errors.join("\n"));
      if (errors.length > 0) toast({ title: "Sebagian gagal", description: errors.join(", "), variant: "destructive" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: `${batchNames.length} pengguna berhasil dibuat` });
      setOpen(false);
      setBatchText(""); setBatchPassword(""); setBatchRole("guru");
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: "Pengguna berhasil dihapus" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adminCount = users.filter((u: any) => (u.roles || []).includes("admin")).length;
  const guruCount  = users.filter((u: any) => (u.roles || []).includes("guru")).length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Banner Header ── */}
      <div className="rounded-xl bg-gradient-to-r from-[hsl(315,70%,42%)] to-[hsl(260,68%,52%)] px-4 sm:px-6 py-4 sm:py-5 shadow-lg shadow-purple-700/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 opacity-90 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold leading-tight">Manajemen Pengguna</h1>
              <p className="text-white/70 text-xs mt-0.5">Kelola akun guru dan administrator sistem</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 text-white hover:bg-white/20 border border-white/30 disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">{isFetching ? "Memuat..." : "Refresh"}</span>
            </Button>
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) { setName(""); setUsername(""); setPassword(""); setBatchText(""); setBatchPassword(""); }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2 bg-white hover:bg-white/90 text-[hsl(290,65%,45%)] font-bold border-0 shadow-md shadow-black/20">
                  <UserPlus className="h-4 w-4" />
                  Tambah Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-violet-500" />
                    Tambah Pengguna
                  </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="single">
                  <TabsList>
                    <TabsTrigger value="single" className="flex items-center gap-1.5">
                      <UserCog className="h-3.5 w-3.5" />
                      Satu Pengguna
                    </TabsTrigger>
                    <TabsTrigger value="batch" className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Input Batch
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="mt-4">
                    <form onSubmit={(e) => { e.preventDefault(); createSingleMutation.mutate(); }} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-bold">Nama Lengkap</Label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold">Username</Label>
                          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username untuk login" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold">Password</Label>
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold">Role</Label>
                          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "guru")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="guru">Guru</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button
                          type="submit"
                          disabled={createSingleMutation.isPending}
                          className="bg-[hsl(315,70%,42%)] hover:bg-[hsl(315,70%,37%)] text-white"
                        >
                          {createSingleMutation.isPending ? "Menyimpan..." : "Simpan"}
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="batch" className="mt-4">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:grid sm:grid-cols-[1fr_260px] gap-4">
                        <div className="space-y-2">
                          <Label className="font-bold">Daftar Nama (satu nama per baris)</Label>
                          <Textarea
                            value={batchText}
                            onChange={(e) => setBatchText(e.target.value)}
                            placeholder={"Ahmad Fauzi\nSiti Nurhaliza\nBudi Santoso\nDewi Lestari"}
                            rows={6}
                            className="bg-muted/30"
                          />
                          <p className="text-xs text-muted-foreground">
                            Copy-paste daftar nama, satu nama per baris. Username otomatis dari nama (huruf kecil, tanpa spasi).
                          </p>
                        </div>
                        <div className="flex flex-row sm:flex-col gap-4 sm:gap-4">
                          <div className="space-y-2 flex-1 sm:flex-none">
                            <Label className="font-bold">Password (untuk semua user)</Label>
                            <Input
                              type="password"
                              value={batchPassword}
                              onChange={(e) => setBatchPassword(e.target.value)}
                              placeholder="Password yang sama untuk semua"
                            />
                          </div>
                          <div className="space-y-2 flex-1 sm:flex-none">
                            <Label className="font-bold">Role</Label>
                            <Select value={batchRole} onValueChange={(v) => setBatchRole(v as "admin" | "guru")}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="guru">Guru</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button
                          onClick={() => createBatchMutation.mutate()}
                          disabled={createBatchMutation.isPending || batchNames.length === 0}
                          className="bg-[hsl(315,70%,42%)] hover:bg-[hsl(315,70%,37%)] text-white"
                        >
                          {createBatchMutation.isPending ? "Menyimpan..." : `Simpan ${batchNames.length} User`}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* ── Stats mini ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40">
            <ShieldCheck className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Administrator</p>
            <p className="text-xl font-bold text-foreground">{adminCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
            <FaUserGraduate className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Guru</p>
            <p className="text-xl font-bold text-foreground">{guruCount}</p>
          </div>
        </div>
      </div>

      {/* ── Tabel ── */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(315,70%,42%)]/10 dark:bg-[hsl(315,70%,42%)]/15 border-b border-border/60">
          <Users className="h-4 w-4 text-[hsl(315,70%,42%)] dark:text-[hsl(315,70%,65%)]" />
          <span className="text-sm font-bold text-[hsl(315,70%,42%)] dark:text-[hsl(315,70%,65%)]">
            Daftar Guru &amp; Admin
          </span>
          <Badge className="ml-auto bg-[hsl(315,70%,42%)] text-white border-0 text-xs">
            {users.length} pengguna
          </Badge>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Memuat...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Belum ada pengguna</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 font-bold hidden sm:table-cell">NO</TableHead>
                  <TableHead className="font-bold">NAMA LENGKAP</TableHead>
                  <TableHead className="font-bold hidden sm:table-cell">USERNAME</TableHead>
                  <TableHead className="font-bold">ROLE</TableHead>
                  <TableHead className="text-right font-bold">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any, i: number) => (
                  <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-muted-foreground font-medium hidden sm:table-cell">{i + 1}</TableCell>
                    <TableCell>
                      <p className="font-extrabold uppercase tracking-wide text-sm">{u.name}</p>
                      <span className="sm:hidden font-mono text-xs text-[hsl(315,60%,45%)] dark:text-[hsl(315,60%,65%)]">@{u.username}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-mono text-sm font-semibold text-[hsl(315,60%,45%)] dark:text-[hsl(315,60%,65%)]">
                        {u.username}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {(u.roles || []).map((r: string) => (
                          <Badge
                            key={r}
                            className={
                              r === "admin"
                                ? "bg-red-600 hover:bg-red-600 text-white border-0 font-bold uppercase text-[11px] px-2"
                                : "bg-violet-600 hover:bg-violet-600 text-white border-0 font-bold uppercase text-[11px] px-2"
                            }
                          >
                            {r === "admin" ? <ShieldCheck className="h-2.5 w-2.5 mr-1" /> : <FaUserGraduate className="h-2.5 w-2.5 mr-1" />}
                            {r.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          onClick={() => setEditingUser(u as UserData)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            if (confirm(`Hapus pengguna ${u.name}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(o) => { if (!o) setEditingUser(null); }}
        />
      )}
    </div>
  );
};

export default UserManagement;
