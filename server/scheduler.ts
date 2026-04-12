import { storage } from "./storage";
import { buildWAPreview, sendWAMessage, getClassPrefix } from "./waHelper";
import { createDriveFolder, uploadBufferToDrive } from "./googleDrive";
import { generateMonthlyRecapPdf } from "./pdfGenerator";

let isSending = false;
let isBackingUp = false;

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

async function runAutoSend() {
  if (isSending) return;

  try {
    const config = await storage.getWebConfig();
    if (!config?.wa_auto_send_enabled) return;
    if (!config.wa_token) return;

    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = wibNow.toISOString().slice(0, 10);
    const nowTime = wibNow.toISOString().slice(11, 16);

    if (nowTime !== config.wa_auto_send_time) return;
    if (config.wa_auto_sent_date === todayStr) return;

    isSending = true;

    await storage.updateWebConfig(config.id, { wa_auto_sent_date: todayStr });
    console.log(`[AutoSend WA] Memulai pengiriman pukul ${nowTime} WIB...`);

    const allClasses = await storage.getClasses();
    const scope = config.wa_auto_send_scope || "all";

    let classesToProcess = allClasses;
    if (scope !== "all") {
      classesToProcess = allClasses.filter(c => getClassPrefix(c.name) === scope);
    }

    if (classesToProcess.length === 0) {
      console.log("[AutoSend WA] Tidak ada kelas yang sesuai scope:", scope);
      return;
    }

    const provider = config.wa_provider || "fonnte";
    const token = config.wa_token;
    const globalTarget = config.wa_target_number || "";

    // Urutkan kelas berdasarkan nama (A → Z) agar isi pesan konsisten
    classesToProcess.sort((a, b) => a.name.localeCompare(b.name, "id"));

    const classIds = classesToProcess.map(c => c.id);

    // Tentukan target: jika hanya 1 kelas gunakan wa_group_id-nya, selainnya gunakan globalTarget
    const target = classesToProcess.length === 1
      ? (classesToProcess[0].wa_group_id || globalTarget)
      : globalTarget;

    if (!target) {
      console.log("[AutoSend WA] Tidak ada nomor target WA yang dikonfigurasi, dibatalkan.");
      return;
    }

    try {
      const { message } = await buildWAPreview(classIds, todayStr);
      if (!message) {
        console.log("[AutoSend WA] Pesan kosong, dilewati.");
        return;
      }
      const { ok, data } = await sendWAMessage(token, provider, target, message);
      if (ok) {
        console.log(`[AutoSend WA] ✅ Berhasil kirim 1 pesan (${classIds.length} kelas) ke: ${target}`);
      } else {
        console.error("[AutoSend WA] ❌ Gagal kirim:", data);
      }
    } catch (e: any) {
      console.error("[AutoSend WA] Error kirim pesan:", e.message);
    }

    console.log(`[AutoSend WA] Selesai — 1 pesan dikirim untuk ${classIds.length} kelas.`);
  } catch (e: any) {
    console.error("[AutoSend WA] Error:", e.message);
  } finally {
    isSending = false;
  }
}

async function runAutoBackup() {
  if (isBackingUp) return;

  try {
    const config = await storage.getWebConfig();
    if (!config?.gdrive_auto_backup_enabled) return;
    if (!config.google_refresh_token) return;

    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = wibNow.toISOString().slice(0, 10);
    const nowTime = wibNow.toISOString().slice(11, 16);

    if (nowTime !== config.gdrive_auto_backup_time) return;
    if (config.gdrive_auto_backed_up_date === todayStr) return;

    const schedule = config.gdrive_auto_backup_schedule || "monthly";

    if (schedule === "monthly") {
      const lastDayOfMonth = new Date(wibNow.getFullYear(), wibNow.getMonth() + 1, 0);
      const lastDayStr = String(lastDayOfMonth.getDate()).padStart(2, "0");
      const todayDay = todayStr.slice(8, 10);
      if (todayDay !== lastDayStr) return;
    }

    isBackingUp = true;
    await storage.updateWebConfig(config.id, { gdrive_auto_backed_up_date: todayStr });

    const year = wibNow.getFullYear();
    const month = wibNow.getMonth() + 1;
    const monthLabel = MONTHS_ID[month - 1];
    const label = schedule === "daily"
      ? `${todayStr}`
      : `${year}-${String(month).padStart(2, "0")} (${monthLabel} ${year})`;

    const folderName = `E-Absensi Backup ${label}`;
    console.log(`[AutoBackup Drive] Membuat folder: "${folderName}"...`);

    const folderId = await createDriveFolder(folderName);
    console.log(`[AutoBackup Drive] Folder dibuat (id: ${folderId})`);

    const schoolName = config.app_subtitle || config.app_title || "Sekolah";
    const allClasses = await storage.getClasses();

    let successCount = 0;
    let failCount = 0;

    for (const cls of allClasses) {
      try {
        console.log(`[AutoBackup Drive] Generate PDF kelas "${cls.name}"...`);
        const pdfBuffer = await generateMonthlyRecapPdf(cls.id, year, month, schoolName);
        const safeClassName = cls.name.replace(/[/\\?%*:|"<>]/g, "-");
        const filename = `Rekap_${safeClassName}_${year}-${String(month).padStart(2, "0")}.pdf`;
        await uploadBufferToDrive(pdfBuffer, filename, "application/pdf", folderId);
        console.log(`[AutoBackup Drive] ✓ Upload "${filename}" selesai`);
        successCount++;
      } catch (e: any) {
        console.error(`[AutoBackup Drive] ✗ Gagal kelas "${cls.name}":`, e.message);
        failCount++;
      }
    }

    console.log(`[AutoBackup Drive] Selesai — Berhasil: ${successCount} kelas, Gagal: ${failCount} kelas`);
  } catch (e: any) {
    console.error("[AutoBackup Drive] Error:", e.message);
  } finally {
    isBackingUp = false;
  }
}

export function startScheduler() {
  console.log("[AutoSend WA] Scheduler dimulai, cek setiap menit.");
  setInterval(async () => {
    await runAutoSend();
    await runAutoBackup();
  }, 60 * 1000);
}
