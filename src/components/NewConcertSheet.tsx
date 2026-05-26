import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NewConcertSheet({ bandId, onClose, onCreated }: { bandId: string; onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("concerts").insert({
      band_id: bandId, name: name.trim(), concert_date: date, is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await onCreated();
    toast.success("Concert créé !");
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl">Nouveau concert</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex: Durbuy Rock)"
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <button onClick={create} disabled={busy || !name.trim()} className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50">
          {busy ? "Création…" : "Créer"}
        </button>
      </div>
    </div>,
    document.body
  );
}
