"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Activity, Smartphone, BookOpen } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Trade", icon: LineChart },
  { href: "/market", label: "Live Flow", icon: Activity },
  { href: "/guide", label: "MT5 Guide", icon: Smartphone },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export default function BottomNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 bg-gradient-to-t from-[#09090e] via-[#09090e]/90 to-transparent">
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative flex flex-1 flex-col items-center rounded-full px-2 py-2.5 transition-all duration-300 ${
                active ? "bg-violet-400/10" : "hover:bg-white/5"
              }`}
            >
              <Icon 
                size={20} 
                strokeWidth={active ? 2 : 1.5} 
                className={active ? "text-violet-300" : "text-slate-400"} 
              />
              <span className={`mt-1 text-[10px] font-medium tracking-wide ${active ? "text-violet-100" : "text-slate-500"}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}