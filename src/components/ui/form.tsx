import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full border border-line bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-stone/70 transition-colors focus:border-charcoal focus:outline-none focus-visible:outline-2 focus-visible:outline-gold-deep aria-[invalid=true]:border-danger disabled:bg-cream";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "appearance-auto pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-charcoal", className)} {...props} />;
}

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {errors[0]}
    </p>
  );
}

/** Label + control + hint + error, wired together with aria attributes. */
export function Field({
  name,
  label,
  hint,
  errors,
  children,
  className,
  idPrefix,
}: {
  idPrefix?: string;
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  errors?: string[];
  children: (props: { id: string; name: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = `${idPrefix ?? "field"}-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, name, "aria-invalid": errors?.length ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-charcoal" {...props} />
      <span>{label}</span>
    </label>
  );
}
