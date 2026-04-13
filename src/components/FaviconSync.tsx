import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

// ── Konstanta ────────────────────────────────────────────────────────────────
const SIZE         = 32;          // ukuran favicon (px)
const FPS          = 12;          // frame per detik (rendah = hemat CPU)
const SLIDE_FRAMES = 14;          // jumlah frame selama slide masuk dari kiri
const STAY_FRAMES  = 40;          // jumlah frame diam di tengah
const TOTAL        = SLIDE_FRAMES + STAY_FRAMES;

// ease-out: lambat menjelang akhir slide → terasa natural
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

// ── Komponen ─────────────────────────────────────────────────────────────────
const FaviconSync = () => {
  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = webConfig?.logo_url;

    // ── Set tag statis (apple-touch-icon, og:image) ──────────────────────
    const staticHref = raw ? convertGDriveLink(raw) : "/favicon.svg";
    const isSvg      = !raw;
    setOrCreateLink("apple-touch-icon", isSvg ? "/favicon.ico" : staticHref);
    setOrCreateLink("shortcut icon",    isSvg ? "/favicon.ico" : staticHref,
                                        isSvg ? "image/x-icon" : "image/png");
    if (raw) {
      const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (ogImg) ogImg.content = staticHref;
    }

    // ── Canvas untuk animasi ─────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;

    const stopTimer = () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    // Dapatkan / buat elemen link favicon
    const getFaviconLink = () => {
      let el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!el) {
        el = document.createElement("link");
        el.rel = "icon";
        document.head.appendChild(el);
      }
      el.type = "image/png";
      return el;
    };

    const img = new Image();
    // Tidak perlu crossOrigin — proxy sudah same-origin, canvas tidak tainted

    img.onload = () => {
      // Pra-render semua frame ke dalam array data URL agar setInterval ringan
      const frames: string[] = [];
      for (let f = 0; f < TOTAL; f++) {
        ctx.clearRect(0, 0, SIZE, SIZE);

        let x = 0;
        if (f < SLIDE_FRAMES) {
          // Fase slide: x dari -SIZE ke 0 dengan ease-out
          x = -SIZE * (1 - easeOut(f / SLIDE_FRAMES));
        }
        // Fase diam: x = 0 (logo penuh di tengah)
        ctx.drawImage(img, x, 0, SIZE, SIZE);
        frames.push(canvas.toDataURL("image/png"));
      }

      let frameIdx = 0;
      stopTimer();

      // setInterval berjalan meski tab tidak aktif (berbeda dengan rAF)
      timerRef.current = setInterval(() => {
        // Hapus favicon lama dan buat baru setiap frame → paksa Chrome refresh
        const old = document.querySelector("link[rel='icon']");
        if (old) old.remove();
        const link = document.createElement("link");
        link.rel  = "icon";
        link.type = "image/png";
        link.href = frames[frameIdx];
        document.head.appendChild(link);
        frameIdx = (frameIdx + 1) % TOTAL;
      }, Math.round(1000 / FPS));
    };

    img.onerror = () => {
      // Gagal load gambar → favicon SVG statis
      setOrCreateLink("icon", "/favicon.svg", "image/svg+xml");
    };

    // Muat logo via proxy agar tidak kena CORS taint di canvas
    if (raw) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(convertGDriveLink(raw))}`;
    } else {
      // Tidak ada logo kustom → pakai favicon SVG bawaan (same-origin)
      img.src = "/favicon.svg";
    }

    return stopTimer;
  }, [webConfig?.logo_url]);

  return null;
};

export default FaviconSync;
