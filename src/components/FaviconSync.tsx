import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

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
    const href = raw ? convertGDriveLink(raw) : "/favicon.svg";

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = href.endsWith(".svg") ? "image/svg+xml" : "image/png";
    link.href = href + (href.startsWith("/favicon") ? "" : `?v=${Date.now()}`);
  }, [webConfig?.logo_url]);

  return null;
};

export default FaviconSync;
