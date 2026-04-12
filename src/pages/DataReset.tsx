import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DatabaseZap, ClipboardList, Users, BookUser, CalendarOff,
  CalendarCheck, Trash2, TriangleAlert, CheckCircle2, ShieldOff, HardDriveUpload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ResetAction {
  id: string;
  label: string;
  desc: string;
  icon: any;
  color: string;
  iconBg: string;
  endpoint: string;
  withYear?: boolean;
  confirmWord: string;
}

const RESET_ACTIONS: ResetAction[] = [
  {
    id: "attendance",
    label: "Data Absensi",
    desc: "Menghapus semua rekap absensi siswa. Data siswa & pengguna tetap aman.",
    icon: ClipboardList,
    color: "text-amber-600",
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    endpoint: "/api/reset/attendance",
    withYear: true,
    confirmWord: "HAPUS ABSENSI",
  },
  {
    id: "students",
    label: "Data Siswa",
    desc: "Menghapus semua data siswa dari seluruh kelas. Data absensi terkait juga ikut terhapus.",
    icon: Users,
    color: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    endpoint: "/api/reset/students",
    confirmWord: "HAPUS SISWA",
  },
  {
    id: "users",
    label: "Akun Guru",
    desc: "Menghapus semua akun Guru. Akun Admin tetap aman dan tidak ikut terhapus.",
    icon: BookUser,
    color: "text-violet-600",
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    endpoint: "/api/reset/users",
    confirmWord: "HAPUS GURU",
  },
  {
    id: "holidays",
    label: "Daftar Hari Libur",
    desc: "Menghapus semua hari libur yang sudah dikonfigurasi.",
    icon: CalendarOff,
    color: "text-orange-600",
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    endpoint: "/api/reset/holidays",
    confirmWord: "HAPUS LIBUR",
  },
  {
    id: "guru-piket",
    label: "Jadwal Guru Piket",
    desc: "Menghapus semua jadwal piket yang sudah ditentukan.",
    icon: CalendarCheck,
    color: "text-teal-600",
    iconBg: "bg-teal-50 dark:bg-teal-950/40",
    endpoint: "/api/reset/guru-piket",
    confirmWord: "HAPUS PIKET",
  },
];

const DataReset = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pending, setPending] = useState<ResetAction | null>(null);
  const [pendingAll, setPendingAll] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [backupYear, setBackupYear] = useState(String(new Date().getFullYear()));
  const [doneId, setDoneId] = useState<string | null>(null);

  const backupAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/drive/all-data", { year: backupYear }),
    onSuccess: (data: any) => {
      toast({ title: "✅ Backup berhasil!", description: `${data.filename} (${data.totalRecords} record) tersimpan di Google Drive.` });
    },
    onError: (e: Error) => toast({ title: "Backup gagal", description: e.message || "Pastikan Google Drive sudah terhubung di Konfigurasi", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ endpoint, year }: { endpoint: string; year?: string }) => {
      const url = year ? `${endpoint}?year=${year}` : endpoint;
      return apiRequest("DELETE", url);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries();
      const action = RESET_ACTIONS.find(a => a.endpoint === vars.endpoint);
      setDoneId(action?.id || "all");
      setTimeout(() => setDoneId(null), 3000);
      toast({ title: "Berhasil dihapus", description: "Data telah dihapus dari sistem." });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShieldOff className="w-14 h-14 text-destructive/60" />
        <h2 className="text-xl font-bold text-destructive">Akses Ditolak</h2>
        <p className="text-muted-foreground max-w-xs">
          Halaman ini hanya dapat diakses oleh <strong>Admin</strong>.
        </p>
      </div>
    );
  }

  const confirmWord = pendingAll ? "RESET SEMUA DATA" : (pending?.confirmWord ?? "");
  const isValid = confirmInput === confirmWord;

  const handleConfirm = () => {
    if (!isValid) return;
    if (pendingAll) {
      resetMutation.mutate({ endpoint: "/api/reset/all" });
    } else if (pending) {
      resetMutation.mutate({
        endpoint: pending.endpoint,
        year: pending.withYear && selectedYear ? selectedYear : undefined,
      });
    }
    setPending(null);
    setPendingAll(false);
    setConfirmInput("");
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Banner ── */}
      <div className="rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-5 shadow-lg shadow-red-700/20">
        <div className="flex items-center gap-3 text-white">
          <DatabaseZap className="h-6 w-6 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Kelola &amp; Reset Data</h1>
            <p className="text-white/70 text-xs mt-0.5">Hapus data secara selektif untuk persiapan tahun ajaran baru</p>
          </div>
        </div>
      </div>

      {/* ── Backup ke Google Drive ── */}
      <Card className="border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
              <HardDriveUpload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-sm">Backup Semua Data ke Google Drive</p>
              <p className="text-xs text-muted-foreground">Simpan seluruh data absensi ke Drive sebelum melakukan reset</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Tahun:</Label>
            <Input
              data-testid="input-backup-year"
              type="number"
              value={backupYear}
              onChange={e => setBackupYear(e.target.value)}
              className="h-7 w-24 text-xs"
              min={2020}
              max={2099}
            />
            <Button
              data-testid="button-backup-all-drive"
              size="sm"
              onClick={() => backupAllMutation.mutate()}
              disabled={backupAllMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <HardDriveUpload className="h-3.5 w-3.5" />
              {backupAllMutation.isPending ? "Membackup..." : "Backup ke Google Drive"}
            </Button>
            {backupAllMutation.isSuccess && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Berhasil!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Warning notice ── */}
      <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-4 py-3">
        <TriangleAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Peringatan Penting</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            Semua aksi di halaman ini <strong>tidak dapat dibatalkan</strong>. Data yang dihapus tidak bisa dikembalikan.
            Pastikan sudah melakukan backup sebelum melanjutkan.
          </p>
        </div>
      </div>

      {/* ── Individual reset cards ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {RESET_ACTIONS.map((action) => {
          const Icon = action.icon;
          const done = doneId === action.id;
          return (
            <Card key={action.id} className="border border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg}`}>
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    : <Icon className={`h-5 w-5 ${action.color}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.desc}</p>
                  {action.withYear && (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Hapus tahun:</Label>
                      <Input
                        type="number"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="h-7 w-24 text-xs"
                        min={2020}
                        max={2099}
                      />
                      <span className="text-[11px] text-muted-foreground">atau kosongkan untuk semua</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPending(action); setConfirmInput(""); }}
                  disabled={resetMutation.isPending || done}
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Hapus
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Nuclear / Reset All ── */}
      <Card className="border-2 border-red-400/60 dark:border-red-700/50 shadow-sm bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
              {doneId === "all"
                ? <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                : <DatabaseZap className="h-6 w-6 text-red-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-red-700 dark:text-red-400">Reset Semua Data</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1 leading-relaxed">
                Menghapus <strong>seluruh</strong> data absensi, siswa, akun guru, hari libur, dan jadwal piket sekaligus.
                Hanya akun Admin yang tetap tersimpan.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setPendingAll(true); setConfirmInput(""); }}
              disabled={resetMutation.isPending || doneId === "all"}
              className="shrink-0 font-bold shadow-md shadow-red-700/20"
            >
              <DatabaseZap className="h-3.5 w-3.5 mr-1.5" />
              Reset Semua
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Confirmation Dialog ── */}
      <AlertDialog
        open={pending !== null || pendingAll}
        onOpenChange={(o) => { if (!o) { setPending(null); setPendingAll(false); setConfirmInput(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" />
              Konfirmasi Penghapusan
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Anda akan menghapus <strong>{pendingAll ? "SEMUA DATA" : pending?.label}</strong>.
                  Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                </p>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-xs font-semibold text-destructive mb-1">
                    Ketik <span className="font-mono bg-destructive/20 px-1.5 py-0.5 rounded">{confirmWord}</span> untuk melanjutkan:
                  </p>
                  <Input
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={confirmWord}
                    className="h-9 font-mono text-sm"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmInput("")}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!isValid || resetMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 disabled:opacity-40"
            >
              {resetMutation.isPending ? "Menghapus..." : "Ya, Hapus Sekarang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DataReset;
