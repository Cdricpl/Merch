import { useState } from "react";
import { LOGO_URL } from "../lib/assets";

// ⚠️ Change ce mot de passe puis re-deploy pour le changer partout.
// C'est un simple verrou d'entrée, pas une vraie protection cryptographique.
const PASSCODE = "6600";

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
      try { localStorage.setItem(LS_KEY, "1"); } catch { /* mode privé : il faudra ressaisir le code */ }
      setOk(true);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="h-full flex items-center justify-center px-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img
            src={LOGO_URL}
            alt="Ardenne Heavy"
            className="mx-auto h-20 w-auto object-contain"
          />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Merchandising</p>
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
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
