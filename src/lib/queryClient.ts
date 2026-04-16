import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getSupabaseToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60_000,
    },
  },
});

export type WebConfig = {
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
  google_refresh_token: string | null;
  google_connected_email: string | null;
  google_drive_folder_id: string | null;
  gdrive_auto_backup_enabled: boolean;
  gdrive_auto_backup_time: string;
  gdrive_auto_backup_schedule: string;
  gdrive_auto_backed_up_date: string | null;
  school_city: string | null;
  updated_at: string | null;
};

const DEFAULT_WEB_CONFIG: WebConfig = {
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
  google_refresh_token: null,
  google_connected_email: null,
  google_drive_folder_id: null,
  gdrive_auto_backup_enabled: false,
  gdrive_auto_backup_time: "23:00",
  gdrive_auto_backup_schedule: "monthly",
  gdrive_auto_backed_up_date: null,
  school_city: null,
  updated_at: null,
};

let webConfigPromise: Promise<WebConfig> | null = null;

export async function getWebConfig(): Promise<WebConfig> {
  if (!webConfigPromise) {
    webConfigPromise = fetch("/api/web-config")
      .then(r => r.ok ? r.json() : DEFAULT_WEB_CONFIG)
      .catch(() => DEFAULT_WEB_CONFIG);
  }
  return webConfigPromise;
}

export function invalidateWebConfig() {
  webConfigPromise = null;
}

export async function apiRequest(method: string, url: string, body?: unknown) {
  const token = await getSupabaseToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
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
