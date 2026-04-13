import { useState, useEffect, useRef, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";
import bgSchool1 from "@/assets/bg-school-1.jpg";
import bgSchool2 from "@/assets/bg-school-2.jpg";
import { GraduationCap, Star } from "lucide-react";

const INTERVAL_MS = 6000;
const TRANSITION_MS = 900;

// ── Ticker bawah layar (desktop only) ─────────────────────────────────────────
const TickerBar = ({ text }: { text: string }) => {
  // Duplikat teks agar loop terasa seamless
  const repeated = Array(6).fill(text).join("   ✦   ");
  return (
    <div
      className="hidden md:flex fixed bottom-0 left-0 right-0 h-8 items-center overflow-hidden border-t border-white/10 select-none"
      style={{
        zIndex: 10,
        background: "linear-gradient(90deg, rgba(10,10,30,0.82) 0%, rgba(20,20,50,0.88) 100%)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="ticker-track whitespace-nowrap text-white/80 text-[11px] font-medium tracking-widest uppercase">
        {repeated}
      </div>
    </div>
  );
};

const PublicLayout = () => {
  const [bgIndex, setBgIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const bgImages = useMemo(() => {
    if (webConfig?.bg_images) {
      try {
        const parsed: string[] = JSON.parse(webConfig.bg_images);
        const urls = parsed.filter(Boolean).map(convertGDriveLink);
        if (urls.length > 0) return urls;
      } catch {}
    }
    const urls: string[] = [];
    if (webConfig?.bg_url_1) urls.push(convertGDriveLink(webConfig.bg_url_1));
    if (webConfig?.bg_url_2) urls.push(convertGDriveLink(webConfig.bg_url_2));
    if (webConfig?.bg_url_3) urls.push(convertGDriveLink(webConfig.bg_url_3));
    if (webConfig?.bg_url_4) urls.push(convertGDriveLink(webConfig.bg_url_4));
    return urls.length > 0 ? urls : [bgSchool1, bgSchool2];
  }, [webConfig?.bg_images, webConfig?.bg_url_1, webConfig?.bg_url_2, webConfig?.bg_url_3, webConfig?.bg_url_4]);

  useEffect(() => {
    setBgIndex(0);
    setPrevIndex(null);
  }, [bgImages]);

  useEffect(() => {
    if (bgImages.length <= 1) return;
    const interval = setInterval(() => {
      setBgIndex(current => {
        const next = (current + 1) % bgImages.length;
        setPrevIndex(current);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setPrevIndex(null), TRANSITION_MS + 100);
        return next;
      });
    }, INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bgImages]);

  const bgStyle = (url: string): React.CSSProperties => ({
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  });

  const appTitle    = webConfig?.app_title    || "E-ABSENSI";
  const appSubtitle = webConfig?.app_subtitle || "Sistem Absensi Sekolah";
  const tickerText  = `${appTitle}  —  ${appSubtitle}  —  Selamat datang di sistem absensi digital`;

  return (
    // Kontainer fixed ke viewport → background fixed berjalan smooth, konten scrollable di dalamnya
    <div className="fixed inset-0 overflow-y-auto overscroll-none" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

      {/* Gambar lama — animasi keluar */}
      {prevIndex !== null && (
        <div
          key={`prev-${prevIndex}`}
          className="fixed inset-0 bg-slide-out"
          style={{ ...bgStyle(bgImages[prevIndex]), zIndex: 0, willChange: "transform" }}
        />
      )}

      {/* Gambar baru — animasi masuk */}
      <div
        key={`curr-${bgIndex}`}
        className={`fixed inset-0${prevIndex !== null ? " bg-slide-in" : ""}`}
        style={{ ...bgStyle(bgImages[bgIndex]), zIndex: 1, willChange: "transform" }}
      />

      {/* Overlay gelap — GPU layer sendiri */}
      <div className="fixed inset-0 bg-black/50" style={{ zIndex: 2, willChange: "transform" }} />

      {/* Konten halaman — min-h-full agar tetap bisa scroll jika konten lebih panjang dari viewport */}
      <div
        className="relative min-h-full flex items-center justify-center py-6 px-4 md:pb-10"
        style={{ zIndex: 3 }}
      >
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>

      {/* Ticker teks berjalan — hanya tampil di desktop */}
      <TickerBar text={tickerText} />
    </div>
  );
};

export default PublicLayout;
