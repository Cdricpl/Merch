import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Concert = { id: string; name: string; concert_date: string; is_active: boolean };

const cacheKey = (bandId: string) => `cache:concerts:${bandId}`;

function readCache(bandId: string): Concert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(cacheKey(bandId));
    return raw ? (JSON.parse(raw) as Concert[]) : [];
  } catch {
    return [];
  }
}

function writeCache(bandId: string, data: Concert[]) {
  try { localStorage.setItem(cacheKey(bandId), JSON.stringify(data)); } catch {}
}

export function useConcerts(bandId: string) {
  const [concerts, setConcerts] = useState<Concert[]>(() => readCache(bandId));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("concerts")
      .select("id, name, concert_date, is_active")
      .eq("band_id", bandId)
      .order("concert_date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const result = (data ?? []) as Concert[];
    setConcerts(result);
    writeCache(bandId, result);
  }, [bandId]);

  useEffect(() => { reload(); }, [reload]);

  return { concerts, reload, loading };
}
