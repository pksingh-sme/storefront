import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Price({
  cents,
  compareAtCents,
  currency,
  from,
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency: string;
  from?: boolean;
  className?: string;
}) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      {onSale ? <span className="sr-only">Sale price:</span> : null}
      <span className={cn(onSale && "text-danger")}>
        {from ? <span className="text-stone">From </span> : null}
        {formatMoney(cents, currency)}
      </span>
      {onSale ? (
        <>
          <span className="sr-only">Regular price:</span>
          <s className="text-stone">{formatMoney(compareAtCents!, currency)}</s>
        </>
      ) : null}
    </span>
  );
}
