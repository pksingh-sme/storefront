"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { wrapIndex, type GalleryImage } from "@/lib/gallery";
import { cn } from "@/lib/cn";

const SWIPE_THRESHOLD = 40;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * Accessible image carousel for one colour's gallery. Parents should give it a `key`
 * of the selected colour so the active image resets whenever the colour changes.
 *
 * Keyboard: Left/Right arrows (and Home/End) move between images when the viewer or a
 * thumbnail has focus. Touch: swipe left/right. Enter/Space on the main image opens a
 * larger view.
 */
export function ProductGallery({ images, label }: { images: GalleryImage[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const regionId = useId();
  const count = images.length;
  const active = images[wrapIndex(index, count)];

  const go = useCallback((next: number) => setIndex(wrapIndex(next, count)), [count]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (zoomOpen && !dialog.open) dialog.showModal();
    if (!zoomOpen && dialog.open) dialog.close();
  }, [zoomOpen]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = index + 1;
    else if (e.key === "ArrowLeft") next = index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next === null) return;
    e.preventDefault();
    const target = wrapIndex(next, count);
    go(target);
    // When a thumbnail had focus, keep focus on the matching thumbnail.
    if ((e.target as HTMLElement).dataset.thumb !== undefined) thumbRefs.current[target]?.focus();
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only horizontal gestures count, so vertical page scrolling still works.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  if (!active) {
    return (
      <div className="grid aspect-[4/5] place-items-center bg-cream text-sm text-stone" data-testid="gallery-empty">
        Images coming soon
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4" data-testid="product-gallery">
      <section
        aria-roledescription="carousel"
        aria-label={label}
        className="relative flex-1"
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div id={regionId} className="relative aspect-[4/5] overflow-hidden bg-cream" aria-live="polite">
          <button
            type="button"
            className="group absolute inset-0 block size-full cursor-zoom-in"
            onClick={() => setZoomOpen(true)}
            aria-label={`Enlarge image ${wrapIndex(index, count) + 1} of ${count}: ${active.alt}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={active.id}
              src={active.src}
              srcSet={active.srcSet}
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt={active.alt}
              width={active.width ?? undefined}
              height={active.height ?? undefined}
              fetchPriority="high"
              data-testid="gallery-main-image"
              data-image-id={active.id}
              className="absolute inset-0 size-full object-cover motion-safe:animate-[fade_.35s_ease]"
            />
          </button>
          <p className="sr-only" data-testid="gallery-position">
            Image {wrapIndex(index, count) + 1} of {count}
          </p>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-controls={regionId}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ivory/90 text-charcoal shadow-sm transition hover:bg-ivory"
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-controls={regionId}
              aria-label="Next image"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ivory/90 text-charcoal shadow-sm transition hover:bg-ivory"
            >
              <Chevron direction="right" />
            </button>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden">
              {images.map((img, i) => (
                <span key={img.id} className={cn("h-1.5 rounded-full transition-all", i === wrapIndex(index, count) ? "w-5 bg-charcoal" : "w-1.5 bg-charcoal/30")} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      {count > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:w-20 lg:flex-col lg:overflow-visible" aria-label="Choose image" onKeyDown={onKeyDown}>
          {images.map((img, i) => {
            const selected = i === wrapIndex(index, count);
            return (
              <li key={img.id} className="shrink-0">
                <button
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  type="button"
                  data-thumb=""
                  data-testid="gallery-thumbnail"
                  data-image-id={img.id}
                  aria-label={`Show image ${i + 1} of ${count}`}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => go(i)}
                  className={cn(
                    "block w-16 border transition lg:w-20",
                    selected ? "border-charcoal" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumbSrc} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={`${label}: enlarged image`}
        onClose={() => setZoomOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setZoomOpen(false);
        }}
        onKeyDown={onKeyDown}
        className="m-auto max-h-[95vh] max-w-[95vw] bg-ivory p-0 backdrop:bg-ink/80"
      >
        {zoomOpen ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.src} srcSet={active.srcSet} sizes="95vw" alt={active.alt} className="max-h-[95vh] w-auto object-contain" />
            <button
              type="button"
              autoFocus
              onClick={() => setZoomOpen(false)}
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-ivory text-charcoal shadow"
              aria-label="Close enlarged image"
            >
              ✕
            </button>
            {count > 1 ? (
              <>
                <button type="button" onClick={() => go(index - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ivory/90">
                  <Chevron direction="left" />
                </button>
                <button type="button" onClick={() => go(index + 1)} aria-label="Next image" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ivory/90">
                  <Chevron direction="right" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
