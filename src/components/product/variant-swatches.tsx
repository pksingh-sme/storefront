"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type SwatchOption = { id: string; colorName: string; colorHex: string | null; stock: number; isActive?: boolean };

/**
 * Colour picker implemented as an ARIA radio group with roving focus: Tab enters the
 * group on the selected colour, arrow keys move between colours and select them.
 */
export function VariantSwatches({
  options,
  selectedId,
  onSelect,
}: {
  options: SwatchOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((o) => o.id === selectedId);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(options[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <p className="text-sm" id="colour-label">
        <span className="text-stone">Colour: </span>
        <span className="font-medium" data-testid="selected-color">
          {selected?.colorName}
        </span>
      </p>
      <div role="radiogroup" aria-labelledby="colour-label" className="mt-3 flex flex-wrap gap-3">
        {options.map((o, i) => {
          const isSelected = o.id === selectedId;
          const soldOut = o.stock <= 0;
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${o.colorName}${soldOut ? " (sold out)" : ""}${o.isActive === false ? " (hidden from customers)" : ""}`}
              tabIndex={isSelected || (!selectedId && i === 0) ? 0 : -1}
              title={o.colorName}
              data-testid="color-swatch"
              data-color={o.colorName}
              onClick={() => onSelect(o.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative grid size-11 place-items-center rounded-full border transition",
                isSelected ? "border-charcoal ring-1 ring-charcoal ring-offset-2 ring-offset-ivory" : "border-line hover:border-charcoal/60",
                o.isActive === false && "opacity-50",
              )}
            >
              <span
                aria-hidden="true"
                className="block size-8 rounded-full border border-charcoal/15"
                style={{ backgroundColor: o.colorHex ?? "#e8ddcc" }}
              />
              {!o.colorHex ? (
                <span aria-hidden="true" className="absolute text-[0.6rem] font-medium">
                  {o.colorName.slice(0, 2)}
                </span>
              ) : null}
              {soldOut ? (
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="block h-px w-10 -rotate-45 bg-charcoal/70" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
