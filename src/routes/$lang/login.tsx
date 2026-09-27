import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GuestOnly } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Field, FormMessage, Input } from "~/components/ui/form";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import { useSession } from "~/lib/session";
import type { Lang } from "~/shared/domain";

export const Route = createFileRoute("/$lang/login")({
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/login", title: t.meta.login.title, description: t.meta.login.description });
  },
  component: () => <GuestOnly><LoginPage /></GuestOnly>,
});

function LoginPage() {
  const lang = useLang();
  const t = useT();
  const { signIn } = useSession();
  const login = useMutation(api.auth.login);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login({ phone, pin });
      if (result.ok) signIn(result.token); // GuestOnly redirige alors vers l'espace du compte
      else setError(t.errors[result.error] ?? t.common.genericError);
    } catch {
      setError(t.common.offlineAction);
    } finally {
      setBusy(false);
    }
  };

  return <div className="container-page flex justify-center py-12 sm:py-20">
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-muted">{t.auth.loginIntro}</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field id="login-phone" label={t.auth.phone}>
          <Input id="login-phone" type="tel" inputMode="tel" autoComplete="username" placeholder={t.auth.phonePlaceholder} value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </Field>
        <Field id="login-pin" label={t.auth.pin}>
          <Input id="login-pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} required />
        </Field>
        {error && <FormMessage>{error}</FormMessage>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? t.auth.loggingIn : t.auth.submitLogin}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t.auth.noAccount} <Link to="/$lang/signup" params={{ lang }} className="font-semibold text-brand-700 hover:underline">{t.auth.createAccount}</Link></p>
      <p className="mt-3 text-center text-xs text-muted">{t.auth.forgotPin}</p>
    </Card>
  </div>;
}
