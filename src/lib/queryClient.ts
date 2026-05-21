import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60_000,
    },
  },
});

type WebConfig = {
  id: string;
  app_title: string;
  app_subtitle: string;
  logo_url: string | null;
  bg_url_1: string | null;
  bg_url_2: string | null;
  bg_url_3: string | null;
  bg_url_4: string | null;
  bg_images: string | null;
  school_start_date: string | null;
  wa_provider: string | null;
  wa_token: string | null;
  wa_target_number: string | null;
  wa_auto_send_enabled: boolean;
  wa_auto_send_time: string;
  wa_auto_send_scope: string | null;
  wa_auto_sent_date: string | null;
  school_city: string | null;
  updated_at: string | null;
};

let webConfigPromise: Promise<WebConfig> | null = null;

export function resetWebConfigCache() {
  webConfigPromise = null;
}

export async function getWebConfig() {
  if (!webConfigPromise) {
    webConfigPromise = fetch("/api/web-config", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch(() => ({
        id: "default",
        app_title: "E-ABSENSI",
        app_subtitle: "Sistem Absensi Sekolah",
        logo_url: null,
        bg_url_1: null,
        bg_url_2: null,
        bg_url_3: null,
        bg_url_4: null,
        bg_images: null,
        school_start_date: null,
        wa_provider: "fonnte",
        wa_token: null,
        wa_target_number: null,
        wa_auto_send_enabled: false,
        wa_auto_send_time: "14:00",
        wa_auto_send_scope: "all",
        wa_auto_sent_date: null,
        school_city: null,
        updated_at: null,
      }));
  }

  return webConfigPromise;
}

export async function apiRequest(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}
