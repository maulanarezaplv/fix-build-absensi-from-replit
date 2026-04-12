import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getWebConfig } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Type, Globe, Image, Save, Link2, Wand2, X, Plus, Settings2, HardDriveUpload, CheckCircle2, Unlink, FolderOpen, AlertCircle, Clock, CalendarDays, RefreshCw } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const convertGDriveLink = (url: string): string => {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
  }
  return url;
};

const WebConfig = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gdriveInput, setGdriveInput] = useState("");
  const [gdriveResult, setGdriveResult] = useState("");
  const [folderIdInput, setFolderIdInput] = useState("");

  const { data: googleStatus, isLoading: googleLoading } = useQuery<{
    configured: boolean; connected: boolean; email: string | null; folderId: string | null;
  }>({
    queryKey: ["google-status"],
    queryFn: () => fetch("/api/backup/google-status", { credentials: "include" }).then(r => r.json()),
    retry: false,
  });

  const { data: webConfig } = useQuery<any>({
    queryKey: ["web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (googleStatus?.folderId) setFolderIdInput(googleStatus.folderId);
  }, [googleStatus?.folderId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "success") {
      toast({ title: "✅ Google Drive berhasil terhubung!" });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (g === "error") {
      toast({ title: "Gagal menghubungkan Google Drive", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/auth/google/disconnect"),
    onSuccess: () => {
      toast({ title: "Google Drive terputus" });
      qc.invalidateQueries({ queryKey: ["google-status"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const saveFolderMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/config/google-folder", { folderId: folderIdInput.trim() || null }),
    onSuccess: () => {
      toast({ title: "✅ Folder ID disimpan" });
      qc.invalidateQueries({ queryKey: ["google-status"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const saveAutoBackupMutation = useMutation({
    mutationFn: (data: { enabled: boolean; time: string; schedule: string }) =>
      apiRequest("PATCH", "/api/config/gdrive-auto-backup", data),
    onSuccess: () => {
      toast({ title: "✅ Pengaturan backup otomatis disimpan" });
      qc.invalidateQueries({ queryKey: ["web-config"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ["web-config"],
    queryFn: () => fetch("/api/web-config", { credentials: "include" }).then(r => r.json()),
  });

  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean | null>(null);
  const [autoBackupTime, setAutoBackupTime] = useState<string | null>(null);
  const [autoBackupSchedule, setAutoBackupSchedule] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [bgList, setBgList] = useState<string[] | null>(null);

  const currentBgList: string[] = useMemo(() => {
    if (bgList !== null) return bgList;
    if (config?.bg_images) {
      try {
        const parsed: string[] = JSON.parse(config.bg_images);
        if (parsed.length > 0) return parsed;
      } catch {}
    }
    const legacyUrls = [config?.bg_url_1 || "", config?.bg_url_2 || "", config?.bg_url_3 || "", config?.bg_url_4 || ""].filter(Boolean);
    return legacyUrls.length > 0 ? legacyUrls : [""];
  }, [bgList, config]);

  const currentData = {
    app_title: formData.app_title ?? config?.app_title ?? "DIGITAL ABSENSI",
    app_subtitle: formData.app_subtitle ?? config?.app_subtitle ?? "Sistem Absensi Sekolah",
    school_city: formData.school_city ?? config?.school_city ?? "",
    logo_url: formData.logo_url ?? config?.logo_url ?? "",
    wa_provider: formData.wa_provider ?? config?.wa_provider ?? "fonnte",
    wa_token: formData.wa_token ?? config?.wa_token ?? "",
    wa_target_number: formData.wa_target_number ?? config?.wa_target_number ?? "",
  };

  const addBg = () => setBgList([...currentBgList, ""]);
  const removeBg = (i: number) => {
    const updated = currentBgList.filter((_, idx) => idx !== i);
    setBgList(updated.length > 0 ? updated : [""]);
  };
  const updateBg = (i: number, val: string) => {
    const updated = [...currentBgList];
    updated[i] = val;
    setBgList(updated);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const validBgs = currentBgList.filter(u => u.trim() !== "");
      return apiRequest("PATCH", "/api/web-config", {
        app_title: currentData.app_title,
        app_subtitle: currentData.app_subtitle,
        school_city: currentData.school_city || null,
        logo_url: currentData.logo_url || null,
        bg_images: validBgs.length > 0 ? JSON.stringify(validBgs) : null,
        bg_url_1: validBgs[0] || null,
        bg_url_2: validBgs[1] || null,
        bg_url_3: validBgs[2] || null,
        bg_url_4: validBgs[3] || null,
        wa_provider: currentData.wa_provider || "fonnte",
        wa_token: currentData.wa_token || null,
        wa_target_number: currentData.wa_target_number || null,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["web-config"] });
      await qc.cancelQueries({ queryKey: ["public-web-config"] });
      const prev = qc.getQueryData<any>(["web-config"]) ?? {};
      const validBgs = currentBgList.filter(u => u.trim() !== "");
      const optimistic = {
        ...prev,
        app_title: currentData.app_title,
        app_subtitle: currentData.app_subtitle,
        logo_url: currentData.logo_url || null,
        bg_images: validBgs.length > 0 ? JSON.stringify(validBgs) : null,
        bg_url_1: validBgs[0] || null,
        bg_url_2: validBgs[1] || null,
        bg_url_3: validBgs[2] || null,
        bg_url_4: validBgs[3] || null,
        wa_provider: currentData.wa_provider || "fonnte",
        wa_token: currentData.wa_token || null,
        wa_target_number: currentData.wa_target_number || null,
      };
      qc.setQueryData(["web-config"], optimistic);
      qc.setQueryData(["public-web-config"], optimistic);
      setFormData({});
      setBgList(null);
      toast({ title: "✅ Konfigurasi disimpan" });
      return { prev };
    },
    onError: (e: Error, _v, ctx: any) => {
      if (ctx?.prev) {
        qc.setQueryData(["web-config"], ctx.prev);
        qc.setQueryData(["public-web-config"], ctx.prev);
      }
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["web-config"] });
      qc.invalidateQueries({ queryKey: ["public-web-config"] });
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    if (!gdriveInput.trim()) return;
    const result = convertGDriveLink(gdriveInput.trim());
    setGdriveResult(result);
    toast({ title: "Link berhasil di-generate!" });
  };

  const handleUseAsLogo = () => {
    if (gdriveResult) {
      updateField("logo_url", gdriveResult);
      toast({ title: "Link diterapkan sebagai logo" });
    }
  };

  if (isLoading) return <p className="text-muted-foreground text-center py-8">Memuat...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-[hsl(25,85%,48%)] to-[hsl(42,90%,52%)] px-6 py-5 shadow-lg shadow-orange-600/20">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-5 w-5 opacity-90" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Konfigurasi WebApps</h1>
              <p className="text-white/70 text-xs mt-0.5">Pengaturan tampilan dan identitas aplikasi</p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 bg-white hover:bg-white/90 text-orange-600 font-bold border-0 shadow-md shadow-black/20"
          >
            <Save className="h-4 w-4" />
            Simpan
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            Identitas Aplikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-semibold">Judul Aplikasi</Label>
            <Input value={currentData.app_title} onChange={(e) => updateField("app_title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Subtitle</Label>
            <Input value={currentData.app_subtitle} onChange={(e) => updateField("app_subtitle", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Kota / Kecamatan <span className="text-muted-foreground font-normal text-xs">(digunakan di footer Excel presensi)</span></Label>
            <Input value={currentData.school_city} onChange={(e) => updateField("school_city", e.target.value)} placeholder="Contoh: Kebakkramat" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-semibold">URL Logo (Google Drive link)</Label>
            <Input value={currentData.logo_url} onChange={(e) => updateField("logo_url", e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">Link Google Drive akan otomatis dikonversi ke format direct image</p>
          </div>
          {currentData.logo_url && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
              <img
                src={currentData.logo_url}
                alt="Logo Preview"
                className="h-14 w-14 rounded-lg object-contain bg-background border"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="text-sm text-muted-foreground truncate flex-1">{currentData.logo_url}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Generator Link Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tempelkan link Google Drive di bawah untuk di-generate menjadi link thumbnail yang bisa digunakan sebagai logo.
          </p>
          <div className="flex gap-2">
            <Input
              value={gdriveInput}
              onChange={(e) => setGdriveInput(e.target.value)}
              placeholder="Paste link Google Drive di sini..."
              className="flex-1"
            />
            <Button onClick={handleGenerate} className="gap-2 shrink-0">
              <Link2 className="h-4 w-4" />
              Generate
            </Button>
          </div>
          {gdriveResult && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Label className="font-semibold text-sm">Hasil:</Label>
                <button onClick={() => { navigator.clipboard.writeText(gdriveResult); toast({ title: "Link disalin!" }); }} className="text-xs text-primary hover:underline">Salin</button>
              </div>
              <Input value={gdriveResult} readOnly className="bg-background text-sm" />
              {gdriveResult.includes("drive.google.com") && (
                <div className="flex items-center gap-4">
                  <img src={gdriveResult} alt="Preview" className="h-14 w-14 rounded-lg object-contain bg-background border" onError={(e) => (e.currentTarget.style.display = "none")} />
                  <Button variant="outline" size="sm" onClick={handleUseAsLogo} className="gap-2">
                    <Plus className="h-3 w-3" />
                    Gunakan sebagai Logo
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SiWhatsapp className="h-5 w-5 text-green-500" />
            Integrasi WhatsApp API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Konfigurasi untuk fitur kirim rekap absensi ke grup WhatsApp. Mendukung provider <strong>Fonnte</strong> dan <strong>Woonwa</strong>.
          </p>
          <div className="space-y-1.5">
            <Label className="font-semibold">Provider API</Label>
            <Select value={currentData.wa_provider} onValueChange={v => updateField("wa_provider", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fonnte">Fonnte (api.fonnte.com)</SelectItem>
                <SelectItem value="woonwa">Woonwa (api.woonwa.com)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Token / API Key</Label>
            <Input
              value={currentData.wa_token}
              onChange={e => updateField("wa_token", e.target.value)}
              placeholder="Masukkan token dari dashboard Fonnte/Woonwa..."
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              Token didapatkan dari dashboard provider WhatsApp API yang digunakan.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Nomor / ID Target (Grup WA)</Label>
            <Input
              value={currentData.wa_target_number}
              onChange={e => updateField("wa_target_number", e.target.value)}
              placeholder="Contoh: 628123456789-1234567890@g.us atau nomor grup"
            />
            <p className="text-xs text-muted-foreground">
              Untuk grup WA, gunakan format ID grup. Untuk nomor individu, gunakan format internasional (62xxx).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Google Drive Backup ── */}
      <Card className="border-blue-200 dark:border-blue-800/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDriveUpload className="h-5 w-5 text-blue-600" />
            Backup Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!googleLoading && !googleStatus?.configured && (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>Belum dikonfigurasi.</strong> Tambahkan <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_CLIENT_ID</code> dan <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_CLIENT_SECRET</code> di file <code>.env</code> server untuk mengaktifkan fitur ini.
              </p>
            </div>
          )}

          {!googleLoading && googleStatus?.configured && !googleStatus.connected && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Hubungkan akun Google untuk mengaktifkan backup otomatis rekap absensi ke Google Drive.
              </p>
              <Button
                data-testid="button-connect-google"
                onClick={() => { window.location.href = "/api/auth/google"; }}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <HardDriveUpload className="h-4 w-4" />
                Hubungkan Google Drive
              </Button>
            </div>
          )}

          {!googleLoading && googleStatus?.connected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Terhubung</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">{googleStatus.email}</p>
                </div>
                <Button
                  data-testid="button-disconnect-google"
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="shrink-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  Putuskan
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  ID Folder Google Drive (opsional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    data-testid="input-folder-id"
                    value={folderIdInput}
                    onChange={e => setFolderIdInput(e.target.value)}
                    placeholder="Paste ID folder Drive di sini (kosongkan untuk root)"
                    className="flex-1"
                  />
                  <Button
                    data-testid="button-save-folder"
                    onClick={() => saveFolderMutation.mutate()}
                    disabled={saveFolderMutation.isPending}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Simpan
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ambil ID dari link folder Drive: drive.google.com/drive/folders/<strong>ID_FOLDER_INI</strong>. Pastikan folder sudah di-share ke email service account atau akun yang terhubung.
                </p>
              </div>

              {/* ── Auto Backup ── */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    <Label className="font-semibold text-base">Backup Otomatis</Label>
                  </div>
                  <button
                    data-testid="toggle-auto-backup"
                    type="button"
                    onClick={() => {
                      const next = !(autoBackupEnabled ?? config?.gdrive_auto_backup_enabled ?? false);
                      setAutoBackupEnabled(next);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      (autoBackupEnabled ?? config?.gdrive_auto_backup_enabled ?? false)
                        ? "bg-blue-600"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        (autoBackupEnabled ?? config?.gdrive_auto_backup_enabled ?? false)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {(autoBackupEnabled ?? config?.gdrive_auto_backup_enabled ?? false) && (
                  <div className="space-y-3 pl-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          Jadwal Backup
                        </Label>
                        <Select
                          value={autoBackupSchedule ?? config?.gdrive_auto_backup_schedule ?? "monthly"}
                          onValueChange={v => setAutoBackupSchedule(v)}
                        >
                          <SelectTrigger data-testid="select-backup-schedule" className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Akhir Bulan</SelectItem>
                            <SelectItem value="daily">Setiap Hari</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Jam Backup (WIB)
                        </Label>
                        <Input
                          data-testid="input-backup-time"
                          type="time"
                          value={autoBackupTime ?? config?.gdrive_auto_backup_time ?? "23:00"}
                          onChange={e => setAutoBackupTime(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(autoBackupSchedule ?? config?.gdrive_auto_backup_schedule ?? "monthly") === "monthly"
                        ? "Sistem akan otomatis membuat folder di Google Drive setiap akhir bulan, lalu mengisi dengan PDF rekap absensi per kelas."
                        : "Sistem akan otomatis membuat folder di Google Drive setiap hari, lalu mengisi dengan PDF rekap absensi per kelas."}
                    </p>
                    {config?.gdrive_auto_backed_up_date && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        ✅ Terakhir backup: {config.gdrive_auto_backed_up_date}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  data-testid="button-save-auto-backup"
                  onClick={() => {
                    saveAutoBackupMutation.mutate({
                      enabled: autoBackupEnabled ?? config?.gdrive_auto_backup_enabled ?? false,
                      time: autoBackupTime ?? config?.gdrive_auto_backup_time ?? "23:00",
                      schedule: autoBackupSchedule ?? config?.gdrive_auto_backup_schedule ?? "monthly",
                    });
                  }}
                  disabled={saveAutoBackupMutation.isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveAutoBackupMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan Backup"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Custom Background Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gambar background yang tampil bergantian di halaman depan. Tambahkan sebanyak yang diinginkan.
          </p>
          {currentBgList.map((url, i) => (
            <div key={i} className="space-y-1.5">
              <Label className="font-semibold">Background {i + 1}</Label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateBg(i, e.target.value)}
                  placeholder="https://drive.google.com/... atau URL gambar lainnya"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBg(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Hapus background ini"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {url && (
                <div className="rounded-lg overflow-hidden h-24 border">
                  <img
                    src={convertGDriveLink(url)}
                    alt={`BG ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            onClick={addBg}
            className="w-full gap-2 border-dashed"
          >
            <Plus className="h-4 w-4" />
            Tambah Background
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebConfig;
