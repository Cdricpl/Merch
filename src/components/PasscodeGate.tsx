import { useState } from "react";

// ⚠️ Change ce mot de passe puis re-deploy pour le changer partout.
// C'est un simple verrou d'entrée, pas une vraie protection cryptographique.
const PASSCODE = "ardenne";

const LS_KEY = "gate-ok-v1";

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (ok) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().toLowerCase() === PASSCODE.toLowerCase()) {
      try { localStorage.setItem(LS_KEY, "1"); } catch {}
      setOk(true);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="font-display text-3xl text-primary">Ardenne Heavy</h1>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Merch counter</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          placeholder="Mot de passe"
          autoFocus
          className={`w-full rounded-md bg-input border px-3 py-3 text-lg ${
            error ? "border-destructive" : "border-border"
          }`}
        />
        {error && <p className="text-xs text-destructive text-center">Mot de passe incorrect</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
