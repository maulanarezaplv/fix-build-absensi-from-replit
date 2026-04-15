import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, School, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const Classes = () => {
  const [name, setName] = useState("");
  const [batchText, setBatchText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWaGroupId, setEditWaGroupId] = useState("");
  const [editWaliKelas, setEditWaliKelas] = useState("");
  const [editWaliKelasNip, setEditWaliKelasNip] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();

  useRealtimeSubscription("classes", [["classes"]]);
  useRealtimeSubscription("students", [["student-counts"]]);
  const qc = useQueryClient();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: studentCounts = {} } = useQuery({
    queryKey: ["student-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("class_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((s: any) => {
        counts[s.class_id] = (counts[s.class_id] || 0) + 1;
      });
      return counts;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (className: string) => {
      const { error } = await supabase.from("classes").insert({ name: className });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Kelas ditambahkan" });
      setName("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addBatchMutation = useMutation({
    mutationFn: async () => {
      const names = batchText.split("\n").map(n => n.trim()).filter(Boolean);
      if (names.length === 0) throw new Error("Tidak ada nama kelas");
      const { error } = await supabase.from("classes").insert(names.map(n => ({ name: n })));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Kelas batch ditambahkan" });
      setBatchText("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase.from("classes").update({
        name: editName,
        wa_group_id: editWaGroupId || null,
        wali_kelas: editWaliKelas || null,
        wali_kelas_nip: editWaliKelasNip || null,
      }).eq("id", editId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Kelas diperbarui" });
      setEditOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Kelas dihapus" });
    },
  });

  const grouped = classes.reduce<Record<string, typeof classes>>((acc, cls: any) => {
    const prefix = cls.name.split("-")[0].trim();
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(cls);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-[hsl(220,80%,60%)] to-[hsl(180,70%,50%)] px-6 py-5">
        <div className="flex items-center gap-2 text-white">
          <School className="h-5 w-5" />
          <h1 className="text-xl font-bold">Daftar Kelas</h1>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-5">
          <Tabs defaultValue="manual">
            <TabsList>
              <TabsTrigger value="manual">Input Manual</TabsTrigger>
              <TabsTrigger value="batch">Input Batch</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">
              <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(name); }} className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan Nama Kelas Baru"
                  className="flex-1"
                  required
                />
                <Button type="submit" disabled={addMutation.isPending} className="bg-gradient-to-r from-[hsl(220,80%,60%)] to-[hsl(180,70%,50%)] text-white shrink-0">
                  <Plus className="h-4 w-4 mr-2" />Tambah Kelas
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="batch" className="mt-4">
              <form onSubmit={(e) => { e.preventDefault(); addBatchMutation.mutate(); }} className="space-y-3">
                <Textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={"Contoh:\nX-A\nX-B\nXI-A"}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">1 baris = 1 kelas</p>
                <Button type="submit" disabled={addBatchMutation.isPending} className="bg-gradient-to-r from-[hsl(220,80%,60%)] to-[hsl(180,70%,50%)] text-white">
                  <Plus className="h-4 w-4 mr-2" />Tambah Batch
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Memuat...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Belum ada kelas</p>
      ) : (
        Object.entries(grouped).map(([prefix, items]) => (
          <Card key={prefix} className="border-none shadow-sm">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-border">
                <span className="font-bold">Kelas {prefix}</span>
                <span className="text-muted-foreground ml-1">({items.length} kelas)</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 hidden sm:table-cell">No</TableHead>
                      <TableHead>Nama Kelas</TableHead>
                      <TableHead className="text-center w-20">Siswa</TableHead>
                      <TableHead className="hidden md:table-cell">Grup WA</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((cls: any, i: number) => (
                      <TableRow key={cls.id}>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <p>{cls.name}</p>
                            {cls.wa_group_id && (
                              <span className="md:hidden flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                                <MessageCircle className="h-3 w-3" />{cls.wa_group_id}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-full px-3">
                            {(studentCounts as any)[cls.id] || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {cls.wa_group_id ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                              <MessageCircle className="h-3 w-3" />{cls.wa_group_id}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-warning"
                              onClick={() => {
                                setEditId(cls.id);
                                setEditName(cls.name);
                                setEditWaGroupId(cls.wa_group_id || "");
                                setEditWaliKelas(cls.wali_kelas || "");
                                setEditWaliKelasNip(cls.wali_kelas_nip || "");
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(cls.id)}
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
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Kelas</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Kelas</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-green-500" />
                Nomor/ID Grup WhatsApp
              </Label>
              <Input
                value={editWaGroupId}
                onChange={(e) => setEditWaGroupId(e.target.value)}
                placeholder="Contoh: 628xxxxxxxx-12345@g.us atau 628xxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Kosongkan jika menggunakan nomor global dari Konfigurasi WebApps.
              </p>
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Wali Kelas (untuk Export Excel)</p>
              <div className="space-y-2">
                <Label>Nama Wali Kelas</Label>
                <Input
                  value={editWaliKelas}
                  onChange={(e) => setEditWaliKelas(e.target.value)}
                  placeholder="Contoh: Tatik Susilowati, S.Pd"
                />
              </div>
              <div className="space-y-2">
                <Label>NIP Wali Kelas</Label>
                <Input
                  value={editWaliKelasNip}
                  onChange={(e) => setEditWaliKelasNip(e.target.value)}
                  placeholder="Contoh: 197205222007012008"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Classes;
