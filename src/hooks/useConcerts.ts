import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Concert = { id: string; name: string; concert_date: string; is_active: boolean };

export function useConcerts(bandId: string) {
  const [concerts, setConcerts] = useState<Concert[]>([]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("concerts")
      .select("id, name, concert_date, is_active")
      .eq("band_id", bandId)
      .order("concert_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setConcerts((data ?? []) as Concert[]);
  }, [bandId]);

  useEffect(() => { reload(); }, [reload]);

  return { concerts, reload };
}
