import { useState, useEffect, useRef, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import bgSchool1 from "@/assets/bg-school-1.jpg";
import bgSchool2 from "@/assets/bg-school-2.jpg";

const INTERVAL_MS = 6000;
const TRANSITION_MS = 900;

const PublicLayout = () => {
  const [bgIndex, setBgIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: () => fetch("/api/web-config").then(r => r.json()),
    staleTime: 5 * 60_000,
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

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden">

      {/* Gambar lama — animasi keluar ke kanan */}
      {prevIndex !== null && (
        <div
          key={`prev-${prevIndex}`}
          className="fixed inset-0 bg-slide-out"
          style={{ ...bgStyle(bgImages[prevIndex]), zIndex: 0, willChange: "transform" }}
        />
      )}

      {/* Gambar baru — animasi masuk dari kiri hanya saat ada transisi (bukan load pertama) */}
      <div
        key={`curr-${bgIndex}`}
        className={`fixed inset-0${prevIndex !== null ? " bg-slide-in" : ""}`}
        style={{ ...bgStyle(bgImages[bgIndex]), zIndex: 1, willChange: "transform" }}
      />

      {/* Overlay gelap */}
      <div className="fixed inset-0 bg-black/50" style={{ zIndex: 2 }} />

      {/* Konten halaman */}
      <div className="relative w-full max-w-sm mx-4 py-6" style={{ zIndex: 3 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default PublicLayout;
