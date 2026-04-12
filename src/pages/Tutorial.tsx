import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cloud, Server, Smartphone, ChevronDown, ChevronUp,
  ExternalLink, Copy, Check, HardDriveUpload, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const CopyBox = ({ code }: { code: string }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "✅ Disalin!" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-slate-900 border border-slate-700 mt-2">
      <pre className="text-emerald-400 text-xs p-3 pr-10 overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

const StepItem = ({ number, title, children }: { number: number; title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white text-xs font-bold flex items-center justify-center shadow">
          {number}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
};

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 px-3 py-2 mt-2">
    <span className="text-blue-500 mt-0.5 flex-shrink-0">💡</span>
    <span className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{children}</span>
  </div>
);

const Warn = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2 mt-2">
    <span className="mt-0.5 flex-shrink-0">⚠️</span>
    <span className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{children}</span>
  </div>
);

const ol = (items: string[]) => (
  <ol className="list-decimal list-inside space-y-1.5 pl-1">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ol>
);

const Tutorial = () => {
  const [activeTab, setActiveTab] = useState<"google-drive" | "about">("google-drive");

  const tabs = [
    { id: "google-drive" as const, label: "Setup Backup Google Drive", icon: HardDriveUpload },
    { id: "about" as const, label: "Tentang Fitur Backup", icon: BookOpen },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tutorial & Panduan</h1>
        <p className="text-sm text-muted-foreground">Panduan langkah demi langkah untuk pemula</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Google Drive Setup ── */}
      {activeTab === "google-drive" && (
        <div className="space-y-6">
          {/* Intro */}
          <div className="rounded-xl bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-200 dark:border-violet-800/50 p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Panduan ini akan memandu Anda menghubungkan E-Absensi dengan Google Drive agar data absensi dapat dibackup secara otomatis. Setup ini hanya perlu dilakukan <strong>satu kali saja</strong>.
            </p>
          </div>

          {/* TAHAP A */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full">
                <Cloud className="h-4 w-4" />
                <span className="text-sm font-bold">TAHAP A</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pengaturan di Google Cloud</span>
            </div>

            <StepItem number={1} title="Buka Google Cloud Console">
              {ol([
                'Buka browser, ketik alamat: console.cloud.google.com',
                'Login menggunakan akun Google (bisa akun sekolah atau pribadi).',
                'Jika baru pertama kali, centang dan setujui syarat & ketentuan yang muncul.',
              ])}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open("https://console.cloud.google.com", "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka console.cloud.google.com
                </Button>
              </div>
            </StepItem>

            <StepItem number={2} title="Buat Project Baru">
              {ol([
                'Di pojok kiri atas (sebelah logo Google Cloud), klik menu dropdown nama project (atau klik tulisan "Select a project").',
                'Klik tombol "NEW PROJECT" di pojok kanan atas jendela yang muncul.',
                'Isi nama project, contoh: e-absensi-sekolah.',
                'Klik "CREATE".',
                'Tunggu beberapa detik, lalu klik notifikasi project yang baru saja dibuat agar Anda masuk ke dalam project tersebut.',
              ])}
            </StepItem>

            <StepItem number={3} title="Aktifkan Google Drive API">
              {ol([
                'Di menu sebelah kiri (garis tiga), cari dan klik "APIs & Services" → "Library".',
                'Di kolom pencarian, ketik: Google Drive API.',
                'Klik hasil "Google Drive API" tersebut.',
                'Klik tombol biru "ENABLE".',
                'Tunggu sampai halaman berubah dan pastikan statusnya sudah aktif. ✅',
              ])}
            </StepItem>

            <StepItem number={4} title="Atur Google Auth Platform & Buat Client ID">
              <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">Menu Branding:</p>
              {ol([
                'Di menu kiri, klik "APIs & Services" → "OAuth consent screen". Anda akan masuk ke halaman Google Auth Platform.',
                'Klik tombol "Get started".',
                'Isi App name (contoh: E-Absensi).',
                'Pilih User support email (email Anda).',
                'Scroll ke bawah, isi Developer contact information (email Anda lagi).',
                'Klik "Save" atau Lanjut.',
              ])}

              <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide mt-3 mb-1">Menu Audience:</p>
              {ol([
                'Di deretan menu kiri, klik "Audience".',
                'Pilih opsi "External" (Wajib, agar bisa dilogin oleh akun Google apa saja).',
                'Klik "Save".',
              ])}

              <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wide mt-3 mb-1">Menu Clients (Membuat ID):</p>
              {ol([
                'Di deretan menu kiri, klik "Clients".',
                'Klik tombol "Create OAuth client" (di kanan atas) atau "Create Client".',
                'Pilih Application type: Web application.',
                'Isi Name (contoh: e-absensi-web).',
                'Di bagian "Authorized redirect URIs", klik tulisan biru "+ ADD URI".',
                'Isi dengan link sistem sekolah Anda:',
              ])}
              <CopyBox code="https://domain-sekolah-kamu.com/api/auth/google/callback" />
              <p className="text-xs mt-2">7. Scroll ke bawah dan klik "CREATE".</p>
              <Warn>Ganti <strong>domain-sekolah-kamu.com</strong> dengan alamat domain/IP server E-Absensi yang sebenarnya. Harus sama persis dengan yang nanti diisi di file .env.</Warn>
            </StepItem>

            <StepItem number={5} title="Salin Client ID dan Client Secret">
              <p>Setelah klik CREATE di Langkah 4, akan muncul popup berisi:</p>
              <ul className="mt-2 space-y-1 pl-4">
                <li>• <strong>Your Client ID</strong> → contoh: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">123456789-abc.apps.googleusercontent.com</code></li>
                <li>• <strong>Your Client Secret</strong> → contoh: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">GOCSPX-xxxxxxxxxxxxxxx</code></li>
              </ul>
              <div className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2">
                <p className="text-xs text-emerald-800 dark:text-emerald-300">✅ <strong>Salin kedua kode tersebut. Simpan sementara di Notepad (jangan ditutup dulu halamannya).</strong></p>
              </div>
              <Tip>Jika popup tidak sengaja tertutup, Anda bisa melihatnya lagi dengan mengklik nama client yang baru dibuat di menu Clients.</Tip>
            </StepItem>
          </div>

          {/* TAHAP B */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-full">
                <Server className="h-4 w-4" />
                <span className="text-sm font-bold">TAHAP B</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pengaturan di Server Aplikasi</span>
            </div>

            <StepItem number={6} title="Tambahkan ke File .env Server">
              {/* Apa itu .env */}
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-2 mb-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">📄 Apa itu file .env?</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  File <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">.env</code> adalah file konfigurasi rahasia yang berisi kode-kode penting untuk server (seperti password, API key, dsb). File ini <strong>tidak terlihat langsung</strong> karena namanya diawali titik (.) — ini normal di sistem Linux/server.
                </p>
              </div>

              {/* Lokasi file */}
              <p className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">📍 Di Mana Letak File .env?</p>
              <p className="mb-2">File <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">.env</code> ada di <strong>folder utama (root) proyek E-Absensi</strong> — satu tingkat dengan folder <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">server/</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">client/</code>, dan <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">shared/</code>.</p>

              <div className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs space-y-0.5 mb-3">
                <div className="text-yellow-400">📁 e-absensi/  ← folder utama proyek</div>
                <div className="text-emerald-400 pl-4">📄 .env  ← INI DIA yang perlu diedit</div>
                <div className="text-slate-500 pl-4">📄 .env.example  ← contoh/template</div>
                <div className="text-slate-500 pl-4">📁 server/</div>
                <div className="text-slate-500 pl-4">📁 client/</div>
                <div className="text-slate-500 pl-4">📁 shared/</div>
              </div>

              {/* Cara menemukan berdasarkan jenis hosting */}
              <p className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">🖥️ Cara Membuka File .env (Pilih Sesuai Jenis Server)</p>

              <div className="space-y-2">
                {/* VPS Linux */}
                <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center gap-2">
                    <span className="text-blue-600 font-bold text-xs">① VPS / Server Linux (SSH/Terminal)</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-xs">
                    <p>Buka terminal/SSH, masuk ke folder proyek, lalu jalankan:</p>
                    <CopyBox code={`cd /home/user/e-absensi\nls -la         # untuk melihat file tersembunyi (.env)\nnano .env      # untuk mengedit`} />
                    <p className="text-muted-foreground">Jika file <code>.env</code> belum ada, buat dulu dengan: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">cp .env.example .env</code></p>
                  </div>
                </div>

                {/* cPanel */}
                <div className="rounded-lg border border-orange-200 dark:border-orange-800/50 overflow-hidden">
                  <div className="bg-orange-50 dark:bg-orange-950/30 px-3 py-2 flex items-center gap-2">
                    <span className="text-orange-600 font-bold text-xs">② cPanel / Panel Hosting</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-xs">
                    {ol([
                      'Login ke cPanel hosting Anda.',
                      'Buka menu "File Manager".',
                      'Masuk ke folder tempat E-Absensi diupload (biasanya di public_html/ atau folder khusus).',
                      'Di pojok kanan atas File Manager, centang opsi "Show Hidden Files (dotfiles)".',
                      'Cari file bernama .env → klik kanan → Edit.',
                    ])}
                  </div>
                </div>

                {/* Replit */}
                <div className="rounded-lg border border-violet-200 dark:border-violet-800/50 overflow-hidden">
                  <div className="bg-violet-50 dark:bg-violet-950/30 px-3 py-2 flex items-center gap-2">
                    <span className="text-violet-600 font-bold text-xs">③ Replit (Platform Online)</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-xs">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Di Replit TIDAK perlu file .env!</p>
                    {ol([
                      'Di sidebar kiri Replit, klik ikon 🔒 "Secrets".',
                      'Klik tombol "New Secret".',
                      'Key: GOOGLE_CLIENT_ID → Value: paste Client ID dari Langkah 5.',
                      'Tambah secret lagi: Key: GOOGLE_CLIENT_SECRET → Value: paste Client Secret.',
                      'Tambah lagi: Key: GOOGLE_REDIRECT_URI → Value: isi URL callback.',
                      'Klik "Add Secret" → selesai, tidak perlu restart manual.',
                    ])}
                  </div>
                </div>

                {/* Windows lokal */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-300 font-bold text-xs">④ Komputer Lokal (Windows)</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-xs">
                    {ol([
                      'Buka Windows Explorer → masuk ke folder proyek e-absensi.',
                      'Di address bar Explorer, ketik: %appdata% lalu tekan Enter (opsional, hanya untuk mencari).',
                      'Di folder proyek, aktifkan "Show hidden items" (View → Hidden items ✓).',
                      'Cari file .env → klik kanan → Open with → pilih Notepad atau VS Code.',
                    ])}
                    <Tip>Jika file tidak terlihat di Windows Explorer, buka VS Code → File → Open Folder → arahkan ke folder proyek → file .env akan terlihat di panel kiri.</Tip>
                  </div>
                </div>
              </div>

              {/* Isi yang harus ditambahkan */}
              <p className="font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mt-3 mb-1">✏️ Isi yang Perlu Ditambahkan</p>
              <p className="mb-1">Setelah file <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">.env</code> terbuka, tambahkan/ubah baris ini:</p>
              <CopyBox code={`GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxx\nGOOGLE_REDIRECT_URI=https://absensi.smpn1contoh.sch.id/api/auth/google/callback`} />
              <Warn>Pastikan domain di GOOGLE_REDIRECT_URI <strong>sama persis</strong> dengan yang Anda isi di Google Cloud pada Langkah 4. Tidak boleh ada perbedaan satu huruf pun.</Warn>
              <Tip>Tidak tahu domain/alamat server Anda? Lihat di address bar browser saat membuka aplikasi E-Absensi. Contoh: jika URL-nya <strong>https://absensi.smpn1contoh.sch.id</strong>, maka GOOGLE_REDIRECT_URI diisi <strong>https://absensi.smpn1contoh.sch.id/api/auth/google/callback</strong></Tip>
            </StepItem>

            <StepItem number={7} title="Restart Server">
              {ol([
                'Restart server aplikasi E-Absensi Anda.',
                '(Jika pakai panel hosting: klik Restart NodeJS. Jika di komputer lokal: matikan terminal dan nyalakan ulang.)',
                'Tunggu beberapa detik sampai server berjalan kembali.',
              ])}
            </StepItem>
          </div>

          {/* TAHAP C */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full">
                <Smartphone className="h-4 w-4" />
                <span className="text-sm font-bold">TAHAP C</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hubungkan & Atur Aplikasi</span>
            </div>

            <StepItem number={8} title="Hubungkan Akun Google di Aplikasi">
              {ol([
                'Login ke E-Absensi sebagai Admin.',
                'Buka menu Konfigurasi WebApps.',
                'Scroll ke bagian "Backup Google Drive".',
                'Sekarang sudah muncul tombol "Hubungkan Google Drive" (tidak lagi tampil pesan merah).',
                'Klik tombol tersebut → browser akan membuka halaman login Google.',
                'Pilih akun Google yang ingin dipakai untuk menyimpan file backup.',
                'Klik "Allow / Izinkan / Continue" pada layar persetujuan.',
                'Browser akan otomatis kembali ke halaman Konfigurasi aplikasi.',
              ])}
              <div className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2">
                <p className="text-xs text-emerald-800 dark:text-emerald-300">✅ Jika berhasil, akan muncul status <strong>"Terhubung"</strong> beserta email akun Google Anda.</p>
              </div>
            </StepItem>

            <StepItem number={9} title="Atur Backup Otomatis (Opsional)">
              {ol([
                'Setelah terhubung, scroll sedikit ke bawah di halaman yang sama.',
                'Aktifkan toggle "Backup Otomatis" (geser ke kanan, jadi biru).',
                'Pilih Jadwal Backup:',
              ])}
              <ul className="pl-6 mt-1 space-y-1 text-xs">
                <li>• <strong>Akhir Bulan</strong> → backup otomatis setiap tanggal terakhir bulan.</li>
                <li>• <strong>Setiap Hari</strong> → backup otomatis tiap hari.</li>
              </ul>
              {ol([
                'Atur Jam Backup (sangat disarankan jam malam saat tidak ramai, contoh: 23:00).',
                'Klik "Simpan Pengaturan Backup".',
              ])}
              <div className="mt-3 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border border-emerald-200 dark:border-emerald-800/50 p-3">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">🎉 Selesai! Sistem sudah terhubung dengan Google Drive.</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Setiap backup otomatis akan membuat folder baru di Drive berisi PDF rekap absensi per kelas. Contoh:</p>
                <div className="mt-2 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-0.5 pl-2">
                  <div>📁 E-Absensi Backup 2026-03 (Maret 2026)</div>
                  <div className="pl-4">📄 Rekap_7A_2026-03.pdf</div>
                  <div className="pl-4">📄 Rekap_8B_2026-03.pdf</div>
                  <div className="pl-4">📄 Rekap_9A_2026-03.pdf</div>
                </div>
              </div>
            </StepItem>
          </div>
        </div>
      )}

      {/* ── TAB: Tentang Fitur Backup ── */}
      {activeTab === "about" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDriveUpload className="h-5 w-5 text-blue-500" />
                Apa itu Fitur Backup?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>Fitur backup menyimpan data absensi ke Google Drive agar aman meskipun server bermasalah, data direset, atau terjadi hal tak terduga.</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "☁️", title: "Backup Manual\nper Bulan", color: "blue",
                desc: "Di Rekap Bulanan → klik Export → Backup ke Google Drive. Upload PDF rekap bulan yang sedang ditampilkan.",
                badge: "Rekap Bulanan",
              },
              {
                icon: "💾", title: "Backup Manual\nSemua Data", color: "orange",
                desc: "Di Kelola & Reset Data → pilih tahun → klik Backup ke Google Drive. Berguna sebagai pengaman sebelum reset data.",
                badge: "Kelola & Reset Data",
              },
              {
                icon: "🔄", title: "Backup\nOtomatis", color: "emerald",
                desc: "Aktifkan di Konfigurasi WebApps. Pilih jadwal (Akhir Bulan / Setiap Hari) dan jam backup. Sistem akan berjalan sendiri.",
                badge: "Konfigurasi WebApps",
              },
            ].map((item, i) => (
              <Card key={i} className={`border-${item.color}-200 dark:border-${item.color}-800/50`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="text-3xl">{item.icon}</div>
                  <p className="font-semibold text-sm whitespace-pre-line">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hasil Backup di Google Drive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-slate-900 p-4 font-mono text-sm space-y-1">
                <div className="text-yellow-400">📁 My Drive</div>
                <div className="pl-4 text-blue-400">📁 E-Absensi Backup 2026-03 (Maret 2026)</div>
                <div className="pl-8 text-emerald-400">📄 Rekap_7A_2026-03.pdf</div>
                <div className="pl-8 text-emerald-400">📄 Rekap_7B_2026-03.pdf</div>
                <div className="pl-8 text-emerald-400">📄 Rekap_8A_2026-03.pdf</div>
                <div className="pl-8 text-emerald-400">📄 Rekap_9A_2026-03.pdf</div>
                <div className="pl-4 text-blue-400">📁 E-Absensi Backup 2026-04 (April 2026)</div>
                <div className="pl-8 text-slate-500">...dan seterusnya setiap bulan</div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Setiap folder berisi file PDF rekap absensi per kelas untuk bulan tersebut, dengan tabel lengkap hadir, sakit, izin, dan alpa per siswa.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Tutorial;
