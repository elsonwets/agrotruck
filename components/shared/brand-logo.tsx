import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) return <Link href="/" className={cn("focus-ring inline-flex items-center gap-2 overflow-hidden", className)} aria-label="AgroTruck, accueil">
    <Image src="/brand/agrotruck-mark-transparent.webp" alt="" width={1080} height={585} className="h-10 w-16 shrink-0 object-contain" priority />
    <Image src="/brand/agrotruck-wordmark-transparent.webp" alt="AgroTruck" width={1360} height={155} className="h-5 w-[112px] shrink-0 object-contain" priority />
  </Link>;
  return <Link href="/" className={cn("focus-ring inline-flex items-center overflow-hidden", className)} aria-label="AgroTruck, accueil">
    <Image src="/brand/agrotruck-lockup-transparent.webp" alt="AgroTruck" width={1360} height={760} className="h-auto w-full object-contain" />
  </Link>;
}
