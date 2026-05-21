import { storage } from "./storage";
import { buildWAPreview, sendWAMessage, getClassPrefix } from "./waHelper";
let isSending = false;

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

export function startScheduler() {
  console.log("[AutoSend WA] Scheduler dimulai, cek setiap menit.");
  setInterval(async () => {
    await runAutoSend();
  }, 60 * 1000);
}
