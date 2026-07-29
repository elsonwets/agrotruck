"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTruck } from "@/app/actions/partners";
import { authClient } from "@/lib/auth-client";
import { PartnerForm } from "./partner-form";
import { useRouter } from "next/navigation";

export function PartnerOnboarding() {
  const { data: session, isPending } = authClient.useSession();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [saveError, setSaveError] = useState("");
  const router = useRouter();

  const accountEmail = verifiedEmail ?? session?.user.email ?? null;
  if (isPending) return <div className="mx-auto h-64 max-w-xl animate-pulse rounded-[24px] bg-primary/5" aria-label="A verificar a sessão" />;
  if (!accountEmail) return <EmailVerification onVerified={setVerifiedEmail} />;
  return <>{saveError && <div role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{saveError}</div>}<PartnerForm verifiedEmail={accountEmail} onCompleted={async (truck) => { setSaveError(""); const result = await createTruck(truck); if (!result.success) { setSaveError(result.error); return; } setCreated(true); }} /><Dialog open={created} onOpenChange={setCreated}><DialogContent><span className="grid size-12 place-items-center rounded-full bg-warning/20 text-primary"><Clock3 className="size-6"/></span><DialogHeader className="mt-5"><DialogTitle>Truck enviado para validação</DialogTitle><DialogDescription>O truck está guardado, mas ainda não está online. Depois do pagamento, a AgroTruck deve validá-lo. Receberá então o controlo para o colocar online no seu dashboard.</DialogDescription></DialogHeader><div className="mt-6 rounded-2xl border border-primary/10 bg-primary/[.04] p-4"><div className="flex items-center gap-3 text-sm font-semibold text-primary"><CheckCircle2 className="size-5"/>Dados guardados com segurança</div></div><Button className="mt-6 w-full" onClick={()=>router.push("/dashboard")}>Abrir o dashboard</Button></DialogContent></Dialog></>;
}

function EmailVerification({ onVerified }: { onVerified: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("agrotruck-otp-pending-email");
    const sentAt = Number(sessionStorage.getItem("agrotruck-otp-sent-at"));
    if (!pendingEmail || !sentAt || Date.now() - sentAt > 10 * 60 * 1000) {
      sessionStorage.removeItem("agrotruck-otp-pending-email");
      sessionStorage.removeItem("agrotruck-otp-sent-at");
      return;
    }
    queueMicrotask(() => {
      setEmail(pendingEmail);
      setCodeSent(true);
    });
  }, []);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const result = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail, type: "sign-in" });
    setLoading(false);
    if (result.error) { setError(result.error.message ?? "Não foi possível enviar o código."); return; }
    sessionStorage.setItem("agrotruck-otp-pending-email", normalizedEmail);
    sessionStorage.setItem("agrotruck-otp-sent-at", String(Date.now()));
    setEmail(normalizedEmail);
    setCodeSent(true);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await authClient.signIn.emailOtp({ email: email.trim().toLowerCase(), otp: code, name: email.split("@")[0] });
    setLoading(false);
    if (result.error) { setError(result.error.message ?? "O código expirou ou não está correto."); return; }
    sessionStorage.removeItem("agrotruck-otp-pending-email");
    sessionStorage.removeItem("agrotruck-otp-sent-at");
    onVerified(email.trim().toLowerCase());
  }

  return <div className="mx-auto max-w-xl rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_22px_65px_rgba(17,17,17,.07)] md:p-9">
    <span className="grid size-12 place-items-center rounded-full bg-primary/8 text-primary">{codeSent ? <LockKeyhole className="size-5" /> : <Mail className="size-5" />}</span>
    <h2 className="mt-6 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">{codeSent ? "Confirme o seu email" : "Comece pelo seu email"}</h2>
    <p className="mt-2 text-sm font-light leading-6 text-muted-foreground">{codeSent ? `Introduza o código de 6 dígitos enviado para ${email}.` : "Antes de cadastrar um truck, precisamos verificar o seu endereço de email."}</p>
    {!codeSent ? <form className="mt-7" onSubmit={sendCode} noValidate><Label htmlFor="owner-email">Email</Label><Input id="owner-email" type="email" autoComplete="email" placeholder="nome@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={error ? "email-error" : undefined} /><Error id="email-error" message={error} /><Button type="submit" size="lg" className="mt-5 w-full" disabled={loading}>{loading ? "A enviar…" : "Enviar código por email"}</Button></form>
      : <form className="mt-7" onSubmit={verifyCode} noValidate><Label htmlFor="verification-code">Código de confirmação</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="text-center text-xl font-semibold tracking-[.35em]" aria-describedby="code-help" /><p id="code-help" className="mt-2 text-xs text-muted-foreground">O código expira dentro de 10 minutos.</p><Error message={error} /><Button type="submit" size="lg" className="mt-5 w-full" disabled={loading || code.length !== 6}>{loading ? "A confirmar…" : "Confirmar e continuar"}</Button><button type="button" onClick={() => { sessionStorage.removeItem("agrotruck-otp-pending-email"); sessionStorage.removeItem("agrotruck-otp-sent-at"); setCodeSent(false); setCode(""); setError(""); }} className="focus-ring mt-4 w-full text-sm font-medium text-primary">Modificar o email</button></form>}
  </div>;
}

function Error({ message, id }: { message?: string; id?: string }) { return message ? <p id={id} role="alert" className="mt-2 text-xs font-medium text-danger">{message}</p> : null; }
