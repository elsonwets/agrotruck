import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "~/lib/i18n";

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

// Bouton « Installer l'application » : visible seulement quand le navigateur propose l'installation.
export function InstallAppButton() {
  const t = useT();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return <p className="text-sm text-white/75">{t.footer.installed}</p>;
  if (!prompt) return null;
  return <button type="button" onClick={async () => { await prompt.prompt(); if ((await prompt.userChoice).outcome === "accepted") setInstalled(true); setPrompt(null); }}
    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15">
    <Download className="size-4" aria-hidden="true" />{t.footer.install}
  </button>;
}
