import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) return <Link href="/" className={cn("focus-ring inline-flex items-center gap-2 overflow-hidden", className)} aria-label="AgroTruck, accueil">
    <span data-brand-surface className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
      <Image src="/brand/agrotruck-mark.png" alt="" width={1080} height={585} className="h-11 w-auto max-w-none object-contain" priority />
    </span>
    <span data-brand-surface className="inline-flex rounded-md bg-white px-1"><Image src="/brand/agrotruck-wordmark.png" alt="AgroTruck" width={1360} height={155} className="h-6 w-auto object-contain" priority /></span>
  </Link>;
  return <Link href="/" className={cn("focus-ring inline-flex items-center overflow-hidden", className)} aria-label="AgroTruck, accueil">
    <Image src="/brand/agrotruck-lockup.png" alt="AgroTruck" width={1360} height={760} className="h-auto w-full object-contain" />
  </Link>;
}
