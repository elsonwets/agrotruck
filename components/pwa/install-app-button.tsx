"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
export function InstallAppButton() {
  const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null); const [help,setHelp]=useState(false); const [installed,setInstalled]=useState(false);
  useEffect(()=>{const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?:boolean}).standalone;if(standalone)queueMicrotask(()=>setInstalled(true));const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};const done=()=>setInstalled(true);window.addEventListener("beforeinstallprompt",capture);window.addEventListener("appinstalled",done);return()=>{window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",done)}},[]);
  async function install(){if(!prompt){setHelp(true);return;}await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted")setInstalled(true);setPrompt(null)}
  return <>{<Button type="button" variant="secondary" className="w-full" onClick={install} disabled={installed}><Download className="size-4"/>{installed?"Aplicação instalada":"Instalar AgroTruck"}</Button>}<Dialog open={help} onOpenChange={setHelp}><DialogContent><span className="grid size-12 place-items-center rounded-full bg-primary/8 text-primary"><Share2 className="size-5"/></span><DialogHeader className="mt-5"><DialogTitle>Instalar AgroTruck</DialogTitle><DialogDescription>No iPhone ou iPad, abra o menu Partilhar e escolha “Adicionar ao ecrã principal”. No Chrome, abra o menu do navegador e escolha “Instalar aplicação”.</DialogDescription></DialogHeader><Button className="mt-6 w-full" onClick={()=>setHelp(false)}>Compreendi</Button></DialogContent></Dialog></>;
}
