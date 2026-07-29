"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Save } from "lucide-react";
import { updateProfile } from "@/app/actions/account";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstallAppButton } from "@/components/pwa/install-app-button";

type Profile = { email:string; name:string; phone:string; whatsapp:string; city:string; companyName:string; accountType:string };
export function AccountForm({ profile }: { profile: Profile }) {
  const [values,setValues]=useState(profile); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(""); const router=useRouter();
  async function submit(event:React.FormEvent){event.preventDefault();setSaving(true);setNotice("");const result=await updateProfile(values);setSaving(false);setNotice(result.success?"Alterações guardadas.":result.error)}
  async function signOut(){await authClient.signOut();router.push("/");router.refresh()}
  return <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><form onSubmit={submit} className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_18px_55px_rgba(11,61,46,.05)] md:p-8"><h2 className="font-heading text-2xl font-bold">Informações do perfil</h2><p className="mt-2 text-sm font-light text-muted-foreground">Estes contactos são utilizados nas fichas públicas dos seus trucks.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Nome"><Input required value={values.name} onChange={e=>setValues({...values,name:e.target.value})}/></Field><Field label="Email"><Input value={values.email} readOnly className="bg-primary/[.035]"/></Field><Field label="Telefone"><Input required type="tel" value={values.phone} onChange={e=>setValues({...values,phone:e.target.value})}/></Field><Field label="WhatsApp"><Input required type="tel" value={values.whatsapp} onChange={e=>setValues({...values,whatsapp:e.target.value})}/></Field><Field label="Cidade"><Input required value={values.city} onChange={e=>setValues({...values,city:e.target.value})}/></Field>{values.accountType==="company"&&<Field label="Empresa"><Input value={values.companyName} onChange={e=>setValues({...values,companyName:e.target.value})}/></Field>}</div>{notice&&<p role="status" className="mt-5 text-sm font-medium text-primary">{notice}</p>}<Button className="mt-6" disabled={saving}><Save className="size-4"/>{saving?"A guardar…":"Guardar alterações"}</Button></form><aside className="space-y-5"><div className="rounded-[24px] bg-primary p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.15em] text-warning">Tipo de conta</p><h2 className="mt-3 font-heading text-2xl font-bold">{values.accountType==="company"?"Empresa":"Particular"}</h2><p className="mt-2 text-sm font-light text-white/65">Email confirmado · sessão protegida e renovada automaticamente.</p></div><div className="rounded-[24px] border border-primary/10 bg-white p-6"><h2 className="font-heading text-lg font-bold">Aplicação</h2><p className="mt-2 mb-5 text-sm font-light leading-6 text-muted-foreground">Instale AgroTruck no ecrã principal para um acesso mais rápido.</p><InstallAppButton/></div><div className="rounded-[24px] border border-primary/10 bg-white p-6"><h2 className="font-heading text-lg font-bold">Segurança</h2><p className="mt-2 text-sm font-light leading-6 text-muted-foreground">A sua sessão permanece ativa neste dispositivo. Termine-a apenas em dispositivos partilhados.</p><Button type="button" variant="secondary" className="mt-5 w-full" onClick={signOut}><LogOut className="size-4"/>Terminar sessão</Button></div></aside></div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><Label>{label}</Label>{children}</div>}
