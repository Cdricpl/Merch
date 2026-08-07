import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createConcert } from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";

export function NewConcertModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createConcert(name.trim(), date);
      toast.success("Concert créé");
      onCreated(id);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="font-display text-xl">Nouveau concert</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex : Durbuy Rock)"
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="w-full rounded-md primary-action text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "Création…" : "Créer"}
        </button>
      </div>
    </div>,
    document.body
  );
}
