"use client";

import { useState } from "react";
import { CheckCircle2, LockKeyhole, Mail, Plus, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { availabilityLabels } from "@/types/truck";
import { confirmEmailVerification, createTruck, requestEmailVerification, updateTruckAvailability } from "@/app/actions/partners";
import { PartnerForm, type PartnerFormData } from "./partner-form";

export function PartnerOnboarding() {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<PartnerFormData[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [saveError, setSaveError] = useState("");

  if (!verifiedEmail) return <EmailVerification onVerified={setVerifiedEmail} />;
  if (showForm) return <>{saveError && <div role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{saveError}</div>}<PartnerForm verifiedEmail={verifiedEmail} onCompleted={async (truck) => { setSaveError(""); const result = await createTruck(truck); if (!result.success) { setSaveError(result.error); return; } setTrucks((current) => [...current, truck]); setShowForm(false); }} /></>;
  return <FleetManager trucks={trucks} onChange={setTrucks} onAdd={() => setShowForm(true)} email={verifiedEmail} />;
}

function EmailVerification({ onVerified }: { onVerified: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await requestEmailVerification(email);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setPreviewCode(result.data.previewCode ?? "");
    setCodeSent(true);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await confirmEmailVerification(email, code);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    onVerified(email.trim().toLowerCase());
  }

  return <div className="mx-auto max-w-xl rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_22px_65px_rgba(17,17,17,.07)] md:p-9">
    <span className="grid size-12 place-items-center rounded-full bg-primary/8 text-primary">{codeSent ? <LockKeyhole className="size-5" /> : <Mail className="size-5" />}</span>
    <h2 className="mt-6 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">{codeSent ? "Confirme o seu email" : "Comece pelo seu email"}</h2>
    <p className="mt-2 text-sm font-light leading-6 text-muted-foreground">{codeSent ? `Introduza o código de 6 dígitos enviado para ${email}.` : "Antes de cadastrar um truck, precisamos verificar o seu endereço de email."}</p>
    {!codeSent ? <form className="mt-7" onSubmit={sendCode} noValidate><Label htmlFor="owner-email">Email</Label><Input id="owner-email" type="email" autoComplete="email" placeholder="nome@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={error ? "email-error" : undefined} /><Error id="email-error" message={error} /><Button type="submit" size="lg" className="mt-5 w-full" disabled={loading}>{loading ? "A enviar…" : "Enviar código por email"}</Button></form>
      : <form className="mt-7" onSubmit={verifyCode} noValidate><Label htmlFor="verification-code">Código de confirmação</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="text-center text-xl font-semibold tracking-[.35em]" aria-describedby="code-help" /><p id="code-help" className="mt-2 text-xs text-muted-foreground">{previewCode ? <>Mode de démonstration — code généré par Neon : <strong className="text-foreground">{previewCode}</strong></> : "Le code expire dans 10 minutes."}</p><Error message={error} /><Button type="submit" size="lg" className="mt-5 w-full" disabled={loading}>{loading ? "A confirmar…" : "Confirmar e continuar"}</Button><button type="button" onClick={() => { setCodeSent(false); setCode(""); setError(""); setPreviewCode(""); }} className="focus-ring mt-4 w-full text-sm font-medium text-primary">Modificar o email</button></form>}
  </div>;
}

function FleetManager({ trucks, onChange, onAdd, email }: { trucks: PartnerFormData[]; onChange: (trucks: PartnerFormData[]) => void; onAdd: () => void; email: string }) {
  const [statusError, setStatusError] = useState("");
  async function updateStatus(index: number, availability: string) {
    const previous = trucks[index].availability;
    onChange(trucks.map((truck, truckIndex) => truckIndex === index ? { ...truck, availability } : truck));
    const result = await updateTruckAvailability(email, trucks[index].registration, availability);
    if (!result.success) {
      onChange(trucks.map((truck, truckIndex) => truckIndex === index ? { ...truck, availability: previous } : truck));
      setStatusError(result.error);
    } else setStatusError("");
  }
  return <div>
    <div className="rounded-[20px] border border-primary/15 bg-primary p-6 text-white md:flex md:items-center md:justify-between md:p-8"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10"><CheckCircle2 className="size-6 text-warning" /></span><div><h2 className="font-heading text-2xl font-bold">Truck cadastrado</h2><p className="mt-1 text-sm font-light text-white/70">Conta verificada com {email}</p></div></div><Button type="button" onClick={onAdd} className="mt-5 bg-warning text-[#111] shadow-none hover:bg-[#ffd52b] md:mt-0"><Plus className="size-4" /> Adicionar outro truck</Button></div>
    <div className="mt-8 flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-heading text-xl font-semibold">Gestão dos meus trucks</h2></div>{statusError && <p role="alert" className="mt-3 text-sm text-danger">{statusError}</p>}
    <div className="mt-4 space-y-3">{trucks.map((truck, index) => <article key={`${truck.registration}-${index}`} className="grid gap-5 rounded-[20px] border border-primary/10 bg-white p-5 md:grid-cols-[1fr_220px] md:items-center"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Truck className="size-5" /></span><div><h3 className="font-heading text-lg font-semibold">{truck.brand} {truck.model}</h3><p className="mt-1 text-sm font-light text-muted-foreground">{truck.capacity} toneladas · {truck.registration} · {truck.city}</p><p className="mt-2 text-xs text-muted-foreground">{truck.acceptedMaterials.slice(0, 3).join(" · ")}</p></div></div><div><Label htmlFor={`fleet-status-${index}`}>Disponibilidade</Label><Select id={`fleet-status-${index}`} value={truck.availability} onChange={(event) => updateStatus(index, event.target.value)}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div></article>)}</div>
  </div>;
}

function Error({ message, id }: { message?: string; id?: string }) { return message ? <p id={id} role="alert" className="mt-2 text-xs font-medium text-danger">{message}</p> : null; }
