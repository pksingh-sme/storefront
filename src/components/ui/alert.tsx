import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-line bg-cream text-charcoal",
    success: "border-success/30 bg-[#eef5f0] text-success",
    error: "border-danger/30 bg-[#fbefef] text-danger",
    warning: "border-warning/30 bg-[#fbf3e6] text-warning",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "gold"; children: ReactNode }) {
  const tones = {
    neutral: "bg-cream text-charcoal",
    success: "bg-[#e5f0e9] text-success",
    warning: "bg-[#f8ecd8] text-warning",
    danger: "bg-[#f6e3e3] text-danger",
    gold: "bg-[#f1e7d2] text-gold-deep",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}
