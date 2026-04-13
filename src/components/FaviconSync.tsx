import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

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

  useEffect(() => {
    const raw = webConfig?.logo_url;
    const appTitle = webConfig?.app_title || "E-ABSENSI";

    // ── Judul tab: hanya nama aplikasi, tanpa sub judul ──────────────────
    document.title = appTitle;

    // ── Favicon (statis) ─────────────────────────────────────────────────
    if (raw) {
      // Gunakan proxy agar gambar selalu bisa dimuat (hindari CORS / redirect GDrive)
      const proxyHref = `/api/proxy-image?url=${encodeURIComponent(convertGDriveLink(raw))}`;
      setOrCreateLink("icon",            proxyHref, "image/png");
      setOrCreateLink("shortcut icon",   proxyHref, "image/png");
      setOrCreateLink("apple-touch-icon", proxyHref);
      // Open Graph image
      const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (ogImg) ogImg.content = convertGDriveLink(raw);
    } else {
      setOrCreateLink("icon",            "/favicon.svg", "image/svg+xml");
      setOrCreateLink("shortcut icon",   "/favicon.ico", "image/x-icon");
      setOrCreateLink("apple-touch-icon", "/favicon.ico");
    }
  }, [webConfig?.logo_url, webConfig?.app_title]);

  return null;
};

export default FaviconSync;
