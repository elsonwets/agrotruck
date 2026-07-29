import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account/account-form";
import { requireDatabase } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "A minha conta", description: "Consulte e atualize o seu perfil AgroTruck." };
export default async function AccountPage(){const session=await auth.api.getSession({headers:await headers()});if(!session)redirect("/devenir-partenaire");const [user]=await requireDatabase().select().from(users).where(eq(users.id,session.user.id)).limit(1);if(!user)redirect("/devenir-partenaire");return <div className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell"><p className="text-xs font-bold uppercase tracking-[.18em] text-danger">A minha conta</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-.04em] md:text-5xl">Os seus dados, num só lugar.</h1><p className="mt-3 max-w-2xl font-light text-muted-foreground">Atualize os contactos apresentados aos clientes e controle a segurança da sua sessão.</p><div className="mt-10"><AccountForm profile={{email:user.email,name:user.name,phone:user.phone??"",whatsapp:user.whatsapp??"",city:user.city??"",companyName:user.companyName??"",accountType:user.accountType}}/></div></div></div>}
