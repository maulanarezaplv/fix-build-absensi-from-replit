import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Search, Printer, Download, Info, ImagePlus, Hash, RefreshCw, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

const Students = () => {
  useRealtimeSubscription("students", [["students"]]);
  useRealtimeSubscription("classes", [["classes"]]);
  const [classId, setClassId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNis, setEditNis] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printDialogData, setPrintDialogData] = useState<{ items: any[]; className: string } | null>(null);
  const [singlePrintDialogOpen, setSinglePrintDialogOpen] = useState(false);
  const [singlePrintData, setSinglePrintData] = useState<{ student: any; className: string } | null>(null);
  const [batchPhotoOpen, setBatchPhotoOpen] = useState(false);
  const [batchPhotoData, setBatchPhotoData] = useState<{ items: any[]; className: string } | null>(null);
  const [batchPhotoUrls, setBatchPhotoUrls] = useState("");
  const [batchNisOpen, setBatchNisOpen] = useState(false);
  const [batchNisData, setBatchNisData] = useState<{ items: any[]; className: string } | null>(null);
  const [batchNisInputs, setBatchNisInputs] = useState<string[]>([]);
  const [batchNisPasteText, setBatchNisPasteText] = useState("");
  const [batchNisPasteOpen, setBatchNisPasteOpen] = useState(false);
  const [batchGenderOpen, setBatchGenderOpen] = useState(false);
  const [batchGenderData, setBatchGenderData] = useState<{ items: any[]; className: string } | null>(null);
  const [batchGenderValues, setBatchGenderValues] = useState<string[]>([]);
  const [batchGenderPasteText, setBatchGenderPasteText] = useState("");
  const [batchGenderPasteOpen, setBatchGenderPasteOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then(r => r.json()),
  });

  const { data: students = [], isLoading, isFetching: isStudentFetching, refetch: refetchStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => fetch("/api/students", { credentials: "include" }).then(r => r.json()),
  });

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const detectedNames = bulkText.split("\n").map(n => n.trim()).filter(Boolean);

  const addBulkMutation = useMutation({
    mutationFn: () => {
      if (!classId) throw new Error("Pilih kelas terlebih dahulu");
      if (detectedNames.length === 0) throw new Error("Masukkan minimal 1 nama");
      const studentList = detectedNames.map((name) => ({
        name,
        class_id: classId,
      }));
      return apiRequest("POST", "/api/students", { students: studentList });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-counts"] });
      toast({ title: `${detectedNames.length} siswa ditambahkan` });
      setBulkText("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editId) return;
      return apiRequest("PATCH", `/api/students/${editId}`, { name: editName, nis: editNis.trim() || null, gender: editGender || null, photo_url: editPhotoUrl, class_id: editClassId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-counts"] });
      toast({ title: "Siswa diperbarui" });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/students/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-counts"] });
      toast({ title: "Siswa dihapus" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: (cId: string) => apiRequest("DELETE", `/api/students/by-class/${cId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-counts"] });
      toast({ title: "Semua siswa di kelas ini dihapus" });
    },
  });

  const batchPhotoMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; photo_url: string }>) =>
      apiRequest("PATCH", "/api/students/batch-photos", { updates }),
    onSuccess: (_, updates) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast({ title: `${updates.length} foto siswa diperbarui` });
      setBatchPhotoOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleBatchPhotoSave = () => {
    if (!batchPhotoData) return;
    const lines = batchPhotoUrls.split("\n");
    const updates = batchPhotoData.items.map((s: any, i: number) => ({
      id: s.id,
      photo_url: (lines[i] || "").trim(),
    }));
    batchPhotoMutation.mutate(updates);
  };

  const batchNisMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; nis: string | null }>) =>
      apiRequest("PATCH", "/api/students/batch-nis", { updates }),
    onSuccess: (data: { saved: number; duplicates: string[] }) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      if (data.duplicates && data.duplicates.length > 0) {
        toast({
          title: `${data.saved} NIS disimpan`,
          description: `NIS berikut sudah digunakan siswa lain: ${data.duplicates.join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({ title: `${data.saved} NIS berhasil disimpan` });
        setBatchNisOpen(false);
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleBatchNisSave = () => {
    if (!batchNisData) return;
    const updates = batchNisData.items.map((s: any, i: number) => ({
      id: s.id,
      nis: (batchNisInputs[i] || "").trim() || null,
    }));
    batchNisMutation.mutate(updates);
  };

  const applyPasteToNisInputs = () => {
    const lines = batchNisPasteText.split(/\r?\n|\r/);
    setBatchNisInputs(prev => prev.map((cur, i) => (lines[i] || "").trim() || cur));
    setBatchNisPasteOpen(false);
    setBatchNisPasteText("");
  };

  const batchGenderMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; gender: string | null }>) =>
      apiRequest("PATCH", "/api/students/batch-gender", { updates }),
    onSuccess: (_data: { count: number }) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      const filled = batchGenderValues.filter(v => v === "L" || v === "P").length;
      toast({ title: `${filled} jenis kelamin berhasil disimpan` });
      setBatchGenderOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleBatchGenderSave = () => {
    if (!batchGenderData) return;
    const updates = batchGenderData.items.map((s: any, i: number) => ({
      id: s.id,
      gender: (batchGenderValues[i] === "L" || batchGenderValues[i] === "P") ? batchGenderValues[i] : null,
    }));
    batchGenderMutation.mutate(updates);
  };

  const applyPasteToGenderValues = () => {
    const lines = batchGenderPasteText.split(/\r?\n|\r/);
    const cleaned = lines.map(l => l.trim().toUpperCase()).filter((_, i) => i < (batchGenderData?.items.length ?? 999));
    setBatchGenderValues(prev => prev.map((cur, i) => {
      const raw = cleaned[i] ?? "";
      return (raw === "L" || raw === "P") ? raw : cur;
    }));
    setBatchGenderPasteOpen(false);
    setBatchGenderPasteText("");
  };

  const ROMAN: Record<string, number> = {
    XII: 12, XI: 11, IX: 9, VIII: 8, VII: 7, VI: 6, IV: 4, III: 3, II: 2, X: 10, V: 5, I: 1,
  };
  const ROMAN_RE = /^(XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I)\b/;
  const sortClassName = useCallback((a: string, b: string) => {
    const aM = a.match(ROMAN_RE);
    const bM = b.match(ROMAN_RE);
    if (aM && bM) {
      const diff = ROMAN[aM[1]] - ROMAN[bM[1]];
      if (diff !== 0) return diff;
      return a.slice(aM[1].length).trim().localeCompare(b.slice(bM[1].length).trim(), "id", { numeric: true });
    }
    return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
  }, []);

  const sortedGroups = useMemo(() => {
    const lc = debouncedSearch.toLowerCase();
    const filtered = (students as any[]).filter(s => {
      const matchClass = filterClassId === "all" || s.class_id === filterClassId;
      const matchSearch = !lc || s.name.toLowerCase().includes(lc);
      return matchClass && matchSearch;
    });
    const grouped = filtered.reduce<Record<string, { className: string; classId: string; items: any[] }>>((acc, s) => {
      if (!acc[s.class_id]) acc[s.class_id] = { className: s.classes?.name || "-", classId: s.class_id, items: [] };
      acc[s.class_id].items.push(s);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => sortClassName(a.className, b.className));
  }, [students, filterClassId, debouncedSearch, sortClassName]);

  const fetchImageAsDataURL = (url: string): Promise<string> => {
    // Gunakan proxy server agar tidak terkena CORS saat fetch Google Drive / URL eksternal
    const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 250;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = proxiedUrl;
    });
  };

  const drawCardToPdf = async (doc: jsPDF, student: any, className: string, x: number, y: number) => {
    const appSubtitle = webConfig?.app_subtitle || "SMP Negeri 1 Kebakkramat";
    const cardW = 90;
    const cardH = 55;
    const headerH = 15;

    // ── Border kartu (rounded) ──
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5);

    // ── Header navy ──
    doc.setFillColor(20, 52, 120);
    doc.roundedRect(x, y, cardW, headerH, 2.5, 2.5, "F");
    doc.rect(x, y + headerH - 4, cardW, 4, "F"); // tutup sudut bawah header

    // ── Garis emas di bawah header ──
    doc.setFillColor(245, 158, 11);
    doc.rect(x, y + headerH, cardW, 1.2, "F");

    // ── Teks header ──
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("KARTU PELAJAR", x + cardW / 2, y + 6.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(200, 220, 255);
    doc.text(appSubtitle, x + cardW / 2, y + 12, { align: "center" });

    // ── QR Code ──
    const qrData = student.nis || student.id || "";
    let qrDataUrl = "";
    try {
      if (qrData) qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 220, margin: 1,
        color: { dark: "#111111", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    } catch { }

    const qrSize = 23;
    const qrX = x + 5;
    const qrY = y + headerH + 3;

    if (qrDataUrl) {
      // Kotak putih di belakang QR agar jelas saat cetak
      doc.setFillColor(255, 255, 255);
      doc.rect(qrX - 0.5, qrY - 0.5, qrSize + 1, qrSize + 1, "F");
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }

    // Label scan (di bawah QR)
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(4);
    doc.text("Scan untuk Absensi", qrX + qrSize / 2, qrY + qrSize + 2.5, { align: "center" });

    // ── Foto siswa ──
    const photoW = 21;
    const photoH = 26;
    const photoX = x + cardW - photoW - 4;
    const photoY = y + headerH + 2.5;

    const rawPhotoUrl = student.photo_url || "";
    let photoLoaded = false;
    if (rawPhotoUrl) {
      const convertedUrl = convertGDriveLink(rawPhotoUrl);
      const photoDataUrl = await fetchImageAsDataURL(convertedUrl);
      if (photoDataUrl) {
        photoLoaded = true;
        // Border foto
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(photoX, photoY, photoW, photoH);
        doc.addImage(photoDataUrl, "JPEG", photoX, photoY, photoW, photoH);
      }
    }
    if (!photoLoaded) {
      // Placeholder abu-abu bergradasi
      doc.setFillColor(238, 238, 238);
      doc.rect(photoX, photoY, photoW, photoH, "F");
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(photoX, photoY, photoW, photoH);
      // Ikon kamera kecil (orang)
      doc.setFillColor(195, 195, 195);
      const cx = photoX + photoW / 2;
      const cy = photoY + photoH / 2 - 2;
      doc.circle(cx, cy - 3, 3, "F");           // kepala
      doc.ellipse(cx, cy + 4, 5, 3.5, "F");     // badan
      // Teks FOTO
      doc.setTextColor(165, 165, 165);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.text("FOTO", cx, photoY + photoH - 2.5, { align: "center" });
    }

    // ── Info siswa ──
    const infoX = qrX + qrSize + 5;
    const infoMaxW = photoX - infoX - 2;
    const infoStartY = y + headerH + 5;

    // Nama siswa (auto shrink)
    doc.setTextColor(15, 15, 15);
    doc.setFont("helvetica", "bold");
    let nameLines: string[] = [];
    let nameFontSize = 8;
    for (let fs = 8; fs >= 5; fs -= 0.5) {
      doc.setFontSize(fs);
      const lines: string[] = doc.splitTextToSize(student.name.toUpperCase(), infoMaxW);
      if (lines.length <= 2) { nameFontSize = fs; nameLines = lines; break; }
      nameLines = lines.slice(0, 2);
    }
    doc.setFontSize(nameFontSize);
    const lineH = nameFontSize < 6.5 ? 3.3 : 4;
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, infoX, infoStartY + i * lineH);
    });

    // Garis tipis di bawah nama
    const afterNameY = infoStartY + nameLines.length * lineH + 1.5;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(infoX, afterNameY, photoX - 2, afterNameY);

    // NIS
    let detailY = afterNameY + 4;
    if (student.nis) {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("NIS", infoX, detailY);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text(": " + student.nis, infoX + 7, detailY);
      detailY += 4.5;
    }

    // Kelas
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Kelas", infoX, detailY);
    doc.setTextColor(20, 52, 120);
    doc.setFont("helvetica", "bold");
    doc.text(": " + className, infoX + 7, detailY);
  };

  const downloadCard = async (student: any, className: string) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [100, 65] });
    await drawCardToPdf(doc, student, className, 5, 5);
    doc.save("kartu-pelajar-" + student.name.replace(/\s+/g, "-").toLowerCase() + ".pdf");
    toast({ title: "Kartu pelajar diunduh (PDF)" });
  };

  const downloadAllCards = async (classItems: any[], className: string) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const cardW = 90;
    const cardH = 55;
    const marginX = 10;
    const marginY = 10;
    const gapX = 5;
    const gapY = 5;
    const cols = 2;
    const maxRows = Math.floor((297 - 2 * marginY + gapY) / (cardH + gapY));

    for (let i = 0; i < classItems.length; i++) {
      const indexOnPage = i % (cols * maxRows);
      const col = indexOnPage % cols;
      const row = Math.floor(indexOnPage / cols);

      if (i > 0 && indexOnPage === 0) doc.addPage();

      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);
      await drawCardToPdf(doc, classItems[i], className, x, y);
    }

    doc.save("kartu-pelajar-" + className.replace(/\s+/g, "-").toLowerCase() + ".pdf");
    toast({ title: classItems.length + " kartu pelajar diunduh (PDF)" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl bg-gradient-to-r from-[hsl(152,60%,45%)] to-[hsl(142,71%,45%)] px-6 py-5">
        <div className="flex items-center gap-2 text-white">
          <Users className="h-5 w-5" />
          <h1 className="text-xl font-bold">Tambah Data Siswa</h1>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-[250px_1fr_auto] gap-4 items-start">
            <div>
              <p className="font-bold text-sm mb-2">Pilih Kelas</p>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="-- Pilih Kelas --" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="font-bold text-sm mb-2">Daftar Nama Siswa <span className="font-normal text-muted-foreground">(1 baris = 1 nama)</span></p>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Contoh:\nAditya Salim\nBudi Setiawan\nCitra Dewi"}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">{detectedNames.length} nama terdeteksi</p>
            </div>
            <div className="pt-7">
              <Button
                onClick={() => addBulkMutation.mutate()}
                disabled={addBulkMutation.isPending}
                className="bg-gradient-to-r from-[hsl(152,60%,45%)] to-[hsl(142,71%,45%)] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />Tambah
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari siswa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterClassId} onValueChange={setFilterClassId}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => refetchStudents()}
          disabled={isStudentFetching}
          className="gap-2 shrink-0"
          data-testid="button-refresh-students"
        >
          <RefreshCw className={`h-4 w-4 ${isStudentFetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{isStudentFetching ? "Memuat..." : "Refresh"}</span>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Memuat...</p>
      ) : sortedGroups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Belum ada siswa</p>
      ) : (
        sortedGroups.map(({ className, classId: cId, items }) => (
          <Card key={cId} className="border-none shadow-sm">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border bg-accent/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {/* Nama kelas */}
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="font-bold truncate">{className}</span>
                  <span className="text-muted-foreground whitespace-nowrap">({items.length} siswa)</span>
                </div>

                {/* Tombol aksi — grid 2×2 di mobile, satu baris di desktop */}
                <div className="grid grid-cols-3 sm:flex sm:flex-row items-center gap-1.5 sm:gap-3">
                  <button
                    className="text-xs text-blue-600 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none sm:hover:bg-transparent sm:hover:underline"
                    onClick={() => {
                      setBatchNisData({ items, className });
                      setBatchNisInputs(items.map((s: any) => s.nis || ""));
                      setBatchNisPasteText("");
                      setBatchNisPasteOpen(false);
                      setBatchNisOpen(true);
                    }}
                  >
                    <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>NIS Massal</span>
                  </button>
                  <button
                    className="text-xs text-pink-600 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-pink-200 bg-pink-50 hover:bg-pink-100 transition-colors sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none sm:hover:bg-transparent sm:hover:underline"
                    onClick={() => {
                      setBatchGenderData({ items, className });
                      setBatchGenderValues(items.map((s: any) => s.gender || ""));
                      setBatchGenderPasteText("");
                      setBatchGenderPasteOpen(false);
                      setBatchGenderOpen(true);
                    }}
                  >
                    <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Gender Massal</span>
                  </button>
                  <button
                    className="text-xs text-purple-600 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none sm:hover:bg-transparent sm:hover:underline"
                    onClick={() => {
                      setBatchPhotoData({ items, className });
                      setBatchPhotoUrls(items.map((s: any) => s.photo_url || "").join("\n"));
                      setBatchPhotoOpen(true);
                    }}
                  >
                    <ImagePlus className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Foto Massal</span>
                  </button>
                  <button
                    className="text-xs text-primary flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none sm:hover:bg-transparent sm:hover:underline"
                    onClick={() => { setPrintDialogData({ items, className }); setPrintDialogOpen(true); }}
                  >
                    <Printer className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Cetak Semua Kartu</span>
                  </button>
                  <button
                    className="text-xs text-destructive flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none sm:hover:bg-transparent sm:hover:underline"
                    onClick={() => deleteAllMutation.mutate(cId)}
                  >
                    <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Hapus Semua</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 hidden sm:table-cell">No</TableHead>
                      <TableHead className="w-12">Foto</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="w-28 hidden sm:table-cell">NIS</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s: any, i: number) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{i + 1}</TableCell>
                        <TableCell>
                          {s.photo_url ? (
                            <img
                              src={convertGDriveLink(s.photo_url)}
                              alt={s.name}
                              className="w-9 h-9 rounded-full object-cover border border-border"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{s.name}</p>
                          {s.nis && <p className="sm:hidden text-xs text-muted-foreground mt-0.5">NIS: {s.nis}</p>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            {s.nis || <span className="text-xs italic">—</span>}
                            {s.gender && (
                              <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${s.gender === "L" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"}`}>
                                {s.gender}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => { setSinglePrintData({ student: s, className }); setSinglePrintDialogOpen(true); }}
                              title="Download Kartu Pelajar"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-warning" onClick={() => { setEditId(s.id); setEditName(s.name); setEditNis(s.nis || ""); setEditGender(s.gender || ""); setEditPhotoUrl(s.photo_url || ""); setEditClassId(s.class_id); setEditOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
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
          <DialogHeader><DialogTitle>Edit Siswa</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Siswa</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>NIS <span className="text-muted-foreground font-normal">(opsional)</span></Label>
              <Input
                value={editNis}
                onChange={(e) => setEditNis(e.target.value)}
                placeholder="Contoh: 1234567890"
              />
              <p className="text-xs text-muted-foreground">Jika diisi, NIS akan muncul di kartu pelajar dan dipakai sebagai data QR Code.</p>
            </div>
            <div className="space-y-2">
              <Label>Jenis Kelamin <span className="text-muted-foreground font-normal">(opsional)</span></Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih L/P" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L — Laki-laki</SelectItem>
                  <SelectItem value="P">P — Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={editClassId} onValueChange={setEditClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL Foto Siswa</Label>
              <Input
                value={editPhotoUrl}
                onChange={(e) => setEditPhotoUrl(e.target.value)}
                placeholder="https://... atau link Google Drive"
              />
              <p className="text-xs text-muted-foreground">
                Tempelkan URL foto langsung atau link Google Drive. Link GDrive akan otomatis dikonversi.
              </p>
              {editPhotoUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={convertGDriveLink(editPhotoUrl)}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                  />
                  <span className="text-xs text-muted-foreground">Preview foto</span>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={batchNisOpen} onOpenChange={setBatchNisOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-blue-600" />
              Input NIS — {batchNisData?.className}
            </DialogTitle>
          </DialogHeader>

          {/* Paste mode panel */}
          {batchNisPasteOpen ? (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <p className="text-xs text-muted-foreground">
                Tempel NIS satu per baris sesuai urutan siswa. Baris kosong tidak akan mengubah NIS siswa tersebut.
              </p>
              <Textarea
                className="flex-1 resize-none font-mono text-xs min-h-[200px]"
                placeholder={"1234567890\n1234567891\n1234567892\n..."}
                value={batchNisPasteText}
                onChange={(e) => setBatchNisPasteText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={applyPasteToNisInputs}>
                  Isi ke Daftar
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => { setBatchNisPasteOpen(false); setBatchNisPasteText(""); }}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {batchNisInputs.filter(v => v.trim()).length} dari {batchNisData?.items.length || 0} siswa terisi NIS
                </p>
                <button
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => setBatchNisPasteOpen(true)}
                >
                  <Hash className="h-3 w-3" />Paste semua sekaligus
                </button>
              </div>

              {/* Inline input per siswa */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {batchNisData?.items.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 py-1 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground text-xs w-6 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium truncate min-w-0">{s.name}</span>
                    <Input
                      className="w-36 flex-shrink-0 h-8 text-xs font-mono"
                      placeholder="Ketik NIS..."
                      value={batchNisInputs[i] || ""}
                      onChange={(e) => {
                        const next = [...batchNisInputs];
                        next[i] = e.target.value;
                        setBatchNisInputs(next);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleBatchNisSave}
                  disabled={batchNisMutation.isPending}
                >
                  {batchNisMutation.isPending ? "Menyimpan..." : "Simpan Semua"}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setBatchNisOpen(false)}>
                  Batal
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={batchPhotoOpen} onOpenChange={setBatchPhotoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-purple-600" />
              Input Foto Massal — {batchPhotoData?.className}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Isi satu URL foto per baris sesuai urutan nama siswa di bawah. Bisa URL langsung atau link Google Drive.
          </p>
          <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
            <div className="w-52 flex-shrink-0 overflow-y-auto rounded border border-border bg-muted/30 p-2 text-xs space-y-1">
              {batchPhotoData?.items.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}.</span>
                  {s.photo_url ? (
                    <img
                      src={convertGDriveLink(s.photo_url)}
                      alt={s.name}
                      className="w-6 h-6 rounded-full object-cover border border-border flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] text-muted-foreground flex-shrink-0">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate font-medium">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col gap-1 min-h-0">
              <Label className="text-xs text-muted-foreground">URL Foto (1 baris = 1 siswa, sesuai urutan kiri)</Label>
              <Textarea
                className="flex-1 resize-none font-mono text-xs"
                placeholder={"https://link-foto-siswa-1.jpg\nhttps://link-foto-siswa-2.jpg\n..."}
                value={batchPhotoUrls}
                onChange={(e) => setBatchPhotoUrls(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {batchPhotoUrls.split("\n").filter(l => l.trim()).length} dari {batchPhotoData?.items.length || 0} baris terisi
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleBatchPhotoSave}
              disabled={batchPhotoMutation.isPending}
            >
              {batchPhotoMutation.isPending ? "Menyimpan..." : `Simpan Semua (${batchPhotoData?.items.length || 0} Siswa)`}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setBatchPhotoOpen(false)}>
              Batal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchGenderOpen} onOpenChange={setBatchGenderOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-pink-600" />
              Input Jenis Kelamin — {batchGenderData?.className}
            </DialogTitle>
          </DialogHeader>

          {batchGenderPasteOpen ? (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <p className="text-xs text-muted-foreground">
                Tempel L atau P satu per baris sesuai urutan siswa di bawah. Baris kosong tidak mengubah nilai yang sudah ada.
              </p>
              <div className="flex gap-2 flex-1 min-h-0 overflow-hidden">
                {/* Nama siswa — referensi urutan */}
                <div className="w-44 flex-shrink-0 overflow-y-auto rounded border border-border bg-muted/30 p-2 text-xs space-y-0">
                  {batchGenderData?.items.map((s: any, i: number) => {
                    const pastedLines = batchGenderPasteText.split(/\r?\n|\r/);
                    const val = (pastedLines[i] || "").trim().toUpperCase();
                    const valid = val === "L" || val === "P";
                    return (
                      <div key={s.id} className="flex items-center gap-1.5 py-0.5 border-b border-border/30 last:border-0">
                        <span className="text-muted-foreground w-5 text-right flex-shrink-0 text-[10px]">{i + 1}.</span>
                        <span className="flex-1 truncate font-medium text-[11px]">{s.name}</span>
                        {valid && (
                          <span className={`text-[10px] font-bold px-1 rounded ${val === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Textarea input */}
                <div className="flex-1 flex flex-col gap-1 min-h-0">
                  <Label className="text-[11px] text-muted-foreground">Ketik atau tempel L/P (1 baris = 1 siswa)</Label>
                  <Textarea
                    className="flex-1 resize-none font-mono text-xs"
                    placeholder={"L\nP\nL\nP\n..."}
                    value={batchGenderPasteText}
                    onChange={(e) => setBatchGenderPasteText(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {batchGenderPasteText.split(/\r?\n|\r/).filter(l => ["L","l","P","p"].includes(l.trim())).length} dari {batchGenderData?.items.length || 0} baris terisi (L/P)
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-pink-600 hover:bg-pink-700 text-white" onClick={applyPasteToGenderValues}>
                  Isi ke Daftar
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => { setBatchGenderPasteOpen(false); setBatchGenderPasteText(""); }}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition-colors"
                    onClick={() => setBatchGenderValues(prev => prev.map(() => "L"))}
                  >Semua L</button>
                  <button
                    className="text-xs font-bold px-3 py-1 rounded-full bg-pink-100 text-pink-700 hover:bg-pink-200 border border-pink-300 transition-colors"
                    onClick={() => setBatchGenderValues(prev => prev.map(() => "P"))}
                  >Semua P</button>
                  <button
                    className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 border border-border transition-colors"
                    onClick={() => setBatchGenderValues(prev => prev.map(() => ""))}
                  >Hapus Semua</button>
                </div>
                <button
                  className="text-xs text-pink-600 hover:underline flex items-center gap-1"
                  onClick={() => setBatchGenderPasteOpen(true)}
                >
                  Paste L/P sekaligus
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {batchGenderValues.filter(v => v === "L" || v === "P").length} dari {batchGenderData?.items.length || 0} siswa terisi
              </p>

              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 min-h-0">
                {batchGenderData?.items.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground text-xs w-6 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium truncate min-w-0">{s.name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        className={`w-9 h-8 rounded-lg text-sm font-bold border-2 transition-all ${batchGenderValues[i] === "L" ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-transparent border-blue-200 text-blue-500 hover:bg-blue-50"}`}
                        onClick={() => setBatchGenderValues(prev => { const n = [...prev]; n[i] = n[i] === "L" ? "" : "L"; return n; })}
                      >L</button>
                      <button
                        className={`w-9 h-8 rounded-lg text-sm font-bold border-2 transition-all ${batchGenderValues[i] === "P" ? "bg-pink-500 border-pink-500 text-white shadow-md" : "bg-transparent border-pink-200 text-pink-500 hover:bg-pink-50"}`}
                        onClick={() => setBatchGenderValues(prev => { const n = [...prev]; n[i] = n[i] === "P" ? "" : "P"; return n; })}
                      >P</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white"
                  onClick={handleBatchGenderSave}
                  disabled={batchGenderMutation.isPending}
                >
                  {batchGenderMutation.isPending ? "Menyimpan..." : "Simpan Semua"}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setBatchGenderOpen(false)}>
                  Batal
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-xs rounded-2xl text-center">
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center">
              <Info className="h-8 w-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Cetak Kartu Pelajar</h2>
            <p className="text-sm text-muted-foreground">
              Mencetak {printDialogData?.items.length || 0} kartu. Layout: 8 Kartu per Halaman (A4).
            </p>
            <div className="flex gap-3 w-full">
              <Button
                className="flex-1 bg-gradient-to-r from-[hsl(152,60%,45%)] to-[hsl(142,71%,45%)] text-white"
                onClick={() => {
                  if (printDialogData) downloadAllCards(printDialogData.items, printDialogData.className);
                  setPrintDialogOpen(false);
                }}
              >
                Cetak Sekarang
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setPrintDialogOpen(false)}>
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={singlePrintDialogOpen} onOpenChange={setSinglePrintDialogOpen}>
        <DialogContent className="max-w-xs rounded-2xl text-center">
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center">
              <Info className="h-8 w-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Cetak Kartu Pelajar</h2>
            <p className="text-sm text-muted-foreground">
              Mencetak 1 kartu untuk {singlePrintData?.student?.name || ""}.
            </p>
            <div className="flex gap-3 w-full">
              <Button
                className="flex-1 bg-gradient-to-r from-[hsl(152,60%,45%)] to-[hsl(142,71%,45%)] text-white"
                onClick={() => {
                  if (singlePrintData) downloadCard(singlePrintData.student, singlePrintData.className);
                  setSinglePrintDialogOpen(false);
                }}
              >
                Cetak Sekarang
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSinglePrintDialogOpen(false)}>
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
