import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "attendance_records"
  | "students"
  | "classes"
  | "guru_piket_assignments"
  | "attendance_settings"
  | "profiles"
  | "holidays"
  | "web_config";

// Shared singleton EventSource so all subscriptions share one SSE connection
let sharedES: EventSource | null = null;
let sharedESRefCount = 0;
const listeners = new Map<string, Set<(table: string) => void>>();

function getSharedES(): EventSource {
  if (!sharedES || sharedES.readyState === EventSource.CLOSED) {
    sharedES = new EventSource(`${supabase.supabaseUrl}/realtime/v1/websocket`);
    sharedES.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.table && data.table !== "connected") {
          listeners.forEach((callbacks) => {
            callbacks.forEach((cb) => cb(data.table));
          });
        }
      } catch {}
    };
    sharedES.onerror = () => {
      // Reconnect on error — browser EventSource auto-reconnects
    };
  }
  return sharedES;
}

export function useRealtimeSubscription(table: TableName, queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const idRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    const id = idRef.current;
    sharedESRefCount++;
    const es = getSharedES();

    const handler = (updatedTable: string) => {
      if (updatedTable === table) {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    };

    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id)!.add(handler);

    // Keep connection alive with a noop reference
    void es;

    return () => {
      listeners.delete(id);
      sharedESRefCount--;
      if (sharedESRefCount <= 0 && sharedES) {
        sharedES.close();
        sharedES = null;
        sharedESRefCount = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
