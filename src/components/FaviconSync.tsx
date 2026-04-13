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
    // URL logo sekolah (Google Drive) atau fallback ke favicon.svg bawaan
    const logoHref = raw
      ? convertGDriveLink(raw) + `?v=${Date.now()}`
      : "/favicon.svg";

    const isSvg    = logoHref.includes("/favicon.svg");
    const mimeType = isSvg ? "image/svg+xml" : "image/png";

    // 1. Favicon reguler (desktop & Android Chrome tab)
    setOrCreateLink("icon", logoHref, mimeType);
    // 2. Shortcut icon (IE / beberapa browser lama)
    setOrCreateLink("shortcut icon", isSvg ? "/favicon.ico" : logoHref, isSvg ? "image/x-icon" : "image/png");
    // 3. Apple Touch Icon — iOS Safari (tab + home screen)
    setOrCreateLink("apple-touch-icon", isSvg ? "/favicon.ico" : logoHref);
    // 4. Perbarui title & Open Graph image jika logo tersedia
    if (raw) {
      const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (ogImg) ogImg.content = convertGDriveLink(raw);
    }
  }, [webConfig?.logo_url]);

  return null;
};

export default FaviconSync;
