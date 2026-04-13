import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

// ── Konstanta animasi ───────────────────────────────────────────────────────
const SIZE         = 32;   // piksel favicon
const SLIDE_FRAMES = 24;   // frame slide-in dari kiri
const STAY_FRAMES  = 72;   // frame diam di tengah
const TOTAL_FRAMES = SLIDE_FRAMES + STAY_FRAMES;
const FPS          = 30;
const MS_PER_FRAME = 1000 / FPS;

// Easing: ease-out cubic agar slide terasa natural
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const setOrCreateLink = (rel: string, href: string, type?: string) => {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (type) el.type = type;
  el.href = href;
};

const FaviconSync = () => {
  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const rafRef    = useRef<number | null>(null);
  const frameRef  = useRef(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    const raw = webConfig?.logo_url;

    // ── Set apple-touch-icon & OG image (statis, tidak dianimasikan) ─────
    const staticHref = raw ? convertGDriveLink(raw) : "/favicon.svg";
    const isSvg      = staticHref.includes("favicon.svg");
    setOrCreateLink("apple-touch-icon", isSvg ? "/favicon.ico" : staticHref);
    setOrCreateLink("shortcut icon",    isSvg ? "/favicon.ico" : staticHref, isSvg ? "image/x-icon" : "image/png");
    if (raw) {
      const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (ogImg) ogImg.content = convertGDriveLink(raw);
    }

    // ── Buat canvas off-screen untuk animasi ────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Ambil link[rel="icon"] (atau buat baru) ──────────────────────────
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";

    const img = new Image();
    img.crossOrigin = "anonymous";

    const stop = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const drawFrame = (timestamp: number) => {
      if (timestamp - lastTsRef.current < MS_PER_FRAME) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastTsRef.current = timestamp;

      const frame = frameRef.current;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Hitung posisi X berdasarkan fase
      let x = 0;
      if (frame < SLIDE_FRAMES) {
        // Fase slide-in: dari -SIZE menuju 0 (muncul dari kiri)
        const t = frame / SLIDE_FRAMES;
        x = -SIZE + easeOut(t) * SIZE;
      }
      // Fase diam: x tetap 0

      // Gambar lingkaran putih tipis sebagai background agar logo terlihat di semua tema tab
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      ctx.restore();

      // Gambar logo
      ctx.drawImage(img, x, 0, SIZE, SIZE);

      // Perbarui favicon
      if (link) link.href = canvas.toDataURL("image/png");

      frameRef.current = (frame + 1) % TOTAL_FRAMES;
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    const startAnimation = () => {
      stop();
      frameRef.current = 0;
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    img.onload  = startAnimation;
    img.onerror = () => {
      // Gagal load logo → fallback favicon statis
      setOrCreateLink("icon", "/favicon.svg", "image/svg+xml");
    };

    // Gunakan proxy agar canvas tidak terkena CORS taint (untuk Google Drive URL)
    if (raw) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(convertGDriveLink(raw))}`;
    } else {
      // Tidak ada logo kustom → gunakan favicon SVG bawaan (same-origin, aman)
      img.src = "/favicon.svg";
    }

    return stop;
  }, [webConfig?.logo_url]);

  return null;
};

export default FaviconSync;
