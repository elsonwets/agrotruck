"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock3, LockKeyhole, Mail, MessageCircle, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { configureOwnerType, createTruck } from "@/app/actions/partners";
import { authClient } from "@/lib/auth-client";
import { PartnerForm } from "./partner-form";
import { useRouter } from "next/navigation";

export function PartnerOnboarding() {
  const { data: session, isPending } = authClient.useSession();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [configuredType, setConfiguredType] = useState<"individual"|"company"|null>(null);
  const [saveError, setSaveError] = useState("");
  const router = useRouter();

  const accountEmail = verifiedEmail ?? session?.user.email ?? null;
  if (isPending) return <div className="mx-auto h-64 max-w-xl animate-pulse rounded-[24px] bg-primary/5" aria-label="A verificar a sessão" />;
  if (!accountEmail) return process.env.NEXT_PUBLIC_WHATSAPP_AUTH_ENABLED === "true" ? <PhoneVerification/> : <EmailVerification onVerified={setVerifiedEmail} />;
  const storedType = session?.user.accountType === "company" ? "company" : "individual";
  const accountType = configuredType ?? storedType;
  if (!session?.user.accountTypeConfigured && !configuredType) return <OwnerTypeChoice onConfigured={setConfiguredType}/>;
  return <>{saveError && <div role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{saveError}</div>}<PartnerForm verifiedEmail={accountEmail} accountType={accountType} onCompleted={async (truck) => { setSaveError(""); const result = await createTruck(truck); if (!result.success) { setSaveError(result.error); return; } setCreated(true); }} /><Dialog open={created} onOpenChange={setCreated}><DialogContent><span className="grid size-12 place-items-center rounded-full bg-warning/20 text-primary"><Clock3 className="size-6"/></span><DialogHeader className="mt-5"><DialogTitle>Truck enviado para validação</DialogTitle><DialogDescription>O truck está guardado, mas ainda não está online. Depois do pagamento em dinheiro, o administrador deve validá-lo. Receberá então o controlo para o colocar online no dashboard.</DialogDescription></DialogHeader><div className="mt-6 rounded-2xl border border-primary/10 bg-primary/[.04] p-4"><div className="flex items-center gap-3 text-sm font-semibold text-primary"><CheckCircle2 className="size-5"/>Dados guardados com segurança</div></div><Button className="mt-6 w-full" onClick={()=>router.push("/dashboard")}>Abrir o dashboard</Button></DialogContent></Dialog></>;
}

function OwnerTypeChoice({onConfigured}:{onConfigured:(type:"individual"|"company")=>void}){
  const [loading,setLoading]=useState<"individual"|"company"|null>(null); const [error,setError]=useState("");
  async function choose(type:"individual"|"company"){setLoading(type);setError("");const result=await configureOwnerType(type);setLoading(null);if(!result.success){setError(result.error);return;}onConfigured(result.data.accountType)}
  return <section className="mx-auto max-w-2xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.17em] text-danger">Primeira configuração</p><h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-.035em] text-primary md:text-4xl">Como deseja cadastrar os seus trucks?</h2><p className="mx-auto mt-3 max-w-xl text-sm font-light leading-6 text-muted-foreground">Escolha uma vez. O perfil, o limite de frota e o preço ficarão associados à sua conta.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><TypeCard icon={<UserRound/>} title="Particular" price="50 000 FCFA / truck" detail="Até 5 trucks" loading={loading==="individual"} onClick={()=>choose("individual")}/><TypeCard icon={<Building2/>} title="Empresa" price="1 000 000 FCFA" detail="5 trucks ou mais" loading={loading==="company"} onClick={()=>choose("company")}/></div>{error&&<p role="alert" className="mt-4 text-center text-sm text-danger">{error}</p>}</section>
}
function TypeCard({icon,title,price,detail,loading,onClick}:{icon:React.ReactNode;title:string;price:string;detail:string;loading:boolean;onClick:()=>void}){return <button type="button" onClick={onClick} disabled={loading} className="focus-ring group rounded-[24px] border border-primary/10 bg-white p-6 text-left shadow-[0_18px_55px_rgba(11,61,46,.06)] transition hover:-translate-y-1 hover:border-primary/30"><span className="grid size-12 place-items-center rounded-2xl bg-primary/8 text-primary transition group-hover:bg-primary group-hover:text-white [&_svg]:size-6">{icon}</span><h3 className="mt-8 font-heading text-2xl font-bold">{title}</h3><p className="mt-2 text-sm font-bold text-primary">{price}</p><p className="mt-1 text-xs text-muted-foreground">{detail} · pagamento vitalício</p><span className="mt-7 block text-sm font-bold text-danger">{loading?"A guardar…":"Escolher este perfil →"}</span></button>}

function PhoneVerification() {
  const [phone, setPhone] = useState("+245");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const pendingPhone = sessionStorage.getItem("agrotruck-otp-pending-phone");
    const sentAt = Number(sessionStorage.getItem("agrotruck-otp-sent-at"));
    if (pendingPhone && sentAt && Date.now() - sentAt < 10 * 60 * 1000) queueMicrotask(() => { setPhone(pendingPhone); setCodeSent(true); });
  }, []);

  async function sendCode(event:React.FormEvent){event.preventDefault();setLoading(true);setError("");const normalized=`+${phone.replace(/\D/g,"")}`;const result=await authClient.phoneNumber.sendOtp({phoneNumber:normalized});setLoading(false);if(result.error){setError(result.error.message??"Não foi possível enviar o código por WhatsApp.");return;}sessionStorage.setItem("agrotruck-otp-pending-phone",normalized);sessionStorage.setItem("agrotruck-otp-sent-at",String(Date.now()));setPhone(normalized);setCodeSent(true)}
  async function verifyCode(event:React.FormEvent){event.preventDefault();setLoading(true);setError("");const result=await authClient.phoneNumber.verify({phoneNumber:phone,code,disableSession:false});setLoading(false);if(result.error){setError(result.error.message??"Código inválido ou expirado.");return;}sessionStorage.removeItem("agrotruck-otp-pending-phone");sessionStorage.removeItem("agrotruck-otp-sent-at");window.location.assign("/devenir-partenaire")}

  return <div className="mx-auto max-w-xl rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_22px_65px_rgba(17,17,17,.07)] md:p-9"><span className="grid size-12 place-items-center rounded-full bg-[#25D366]/12 text-[#168548]">{codeSent?<LockKeyhole className="size-5"/>:<MessageCircle className="size-5"/>}</span><h2 className="mt-6 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">{codeSent?"Código recebido por WhatsApp":"Entre com o seu telefone"}</h2><p className="mt-2 text-sm font-light leading-6 text-muted-foreground">{codeSent?`Introduza o código enviado para ${phone}.`:"Use um número WhatsApp com indicativo do país."}</p>{!codeSent?<form className="mt-7" onSubmit={sendCode}><Label htmlFor="owner-phone">Número WhatsApp</Label><Input id="owner-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+245 955 000 000"/><Error message={error}/><Button type="submit" size="lg" variant="whatsapp" className="mt-5 w-full" disabled={loading}>{loading?"A enviar…":"Receber código no WhatsApp"}</Button></form>:<form className="mt-7" onSubmit={verifyCode}><Label htmlFor="phone-code">Código de confirmação</Label><Input id="phone-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,""))} className="text-center text-xl font-semibold tracking-[.35em]"/><Error message={error}/><Button type="submit" size="lg" className="mt-5 w-full" disabled={loading||code.length!==6}>{loading?"A confirmar…":"Confirmar e entrar"}</Button><button type="button" onClick={()=>{setCodeSent(false);setCode("");setError("")}} className="focus-ring mt-4 w-full text-sm font-medium text-primary">Modificar o número</button></form>}</div>;
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
