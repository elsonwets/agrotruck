"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function AdminNotificationBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch("/api/admin/pending-count", { cache: "no-store" });
      if (response.ok && active) setCount(((await response.json()) as { count: number }).count);
    }
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <Link href="/admin/trucks" className="focus-ring relative grid size-10 place-items-center rounded-full border border-primary/10 text-primary transition hover:bg-primary/5" aria-label={`${count} trucks aguardam validação`}><Bell className="size-4"/>{count>0&&<span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{count>99?"99+":count}</span>}</Link>;
}
