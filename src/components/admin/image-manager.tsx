"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  deleteImageAction,
  finalizeImageUploadAction,
  reorderImagesAction,
  requestImageUploadAction,
  setPrimaryImageAction,
  updateImageAction,
} from "@/app/admin/actions";
import { Alert, Badge } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ALLOWED_IMAGE_TYPES } from "@/lib/validation/upload";
import { precheckImage, sendToStorage } from "./upload";
import { useActionRunner } from "./use-action-feedback";

export type AdminImage = {
  id: string;
  variantId: string | null;
  altText: string;
  thumbSrc: string;
  src: string;
  isPrimary: boolean;
  sortOrder: number;
};

type VariantOption = { id: string; colorName: string; colorHex: string | null };

type PendingFile = {
  key: string;
  file: File;
  preview: string;
  alt: string;
  status: "ready" | "uploading" | "processing" | "done" | "error";
  error?: string;
};

function ordered(images: AdminImage[]) {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

function Uploader({
  productId,
  variantId,
  galleryName,
  maxUploadMb,
  onUploaded,
}: {
  productId: string;
  variantId: string | null;
  galleryName: string;
  maxUploadMb: number;
  onUploaded: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (list: FileList | File[]) => {
    const next = Array.from(list).map((file) => {
      const error = precheckImage(file, maxUploadMb);
      return {
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        alt: "",
        status: error ? ("error" as const) : ("ready" as const),
        error: error ?? undefined,
      };
    });
    setFiles((prev) => [...prev, ...next]);
  };

  const update = (key: string, patch: Partial<PendingFile>) => setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const uploadAll = async () => {
    setBusy(true);
    let uploaded = 0;
    for (const item of files.filter((f) => f.status === "ready")) {
      try {
        update(item.key, { status: "uploading" });
        const req = await requestImageUploadAction(productId, variantId, { fileName: item.file.name, contentType: item.file.type, size: item.file.size });
        if (!req.ok || !req.data) throw new Error(req.ok ? "Upload failed." : req.error);
        await sendToStorage(req.data.upload, item.file);
        update(item.key, { status: "processing" });
        const fin = await finalizeImageUploadAction(req.data.imageId, item.alt || null);
        if (!fin.ok) throw new Error(fin.error);
        update(item.key, { status: "done" });
        uploaded++;
      } catch (error) {
        update(item.key, { status: "error", error: error instanceof Error ? error.message : "Upload failed." });
      }
    }
    setBusy(false);
    if (uploaded) {
      setFiles((prev) => {
        prev.filter((f) => f.status === "done").forEach((f) => URL.revokeObjectURL(f.preview));
        return prev.filter((f) => f.status !== "done");
      });
      onUploaded();
    }
  };

  const ready = files.filter((f) => f.status === "ready").length;

  return (
    <div className="mt-4">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn("border border-dashed px-4 py-5 text-center text-sm transition", dragging ? "border-charcoal bg-cream" : "border-sand bg-ivory")}
      >
        <label htmlFor={inputId} className="cursor-pointer">
          <span className="underline underline-offset-4">Choose images</span> or drop them here
          <span className="block text-xs text-stone">
            JPEG, PNG, WebP or AVIF · up to {maxUploadMb} MB each · added to {galleryName}
          </span>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="sr-only"
          data-testid={`upload-input-${variantId ?? "shared"}`}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length ? (
        <div className="mt-3 space-y-3">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((f) => (
              <li key={f.key} className="border border-line bg-white p-2 text-xs" data-testid="pending-upload">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt="" className="aspect-[4/5] w-full bg-cream object-cover" />
                <p className="mt-1 truncate" title={f.file.name}>
                  {f.file.name}
                </p>
                {f.status === "error" ? (
                  <p className="text-danger" role="alert">
                    {f.error}
                  </p>
                ) : f.status === "ready" ? (
                  <label className="mt-1 block">
                    <span className="sr-only">Alt text for {f.file.name}</span>
                    <input
                      value={f.alt}
                      onChange={(e) => update(f.key, { alt: e.target.value })}
                      placeholder="Describe the image (alt text)"
                      maxLength={250}
                      className="w-full border border-line px-2 py-1"
                    />
                  </label>
                ) : (
                  <p className="text-stone" role="status">
                    {f.status === "uploading" ? "Uploading…" : f.status === "processing" ? "Optimising…" : "Done"}
                  </p>
                )}
                {f.status === "ready" || f.status === "error" ? (
                  <button
                    type="button"
                    className="mt-1 underline"
                    onClick={() => {
                      URL.revokeObjectURL(f.preview);
                      setFiles((prev) => prev.filter((x) => x.key !== f.key));
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={uploadAll} disabled={busy || ready === 0} data-testid={`upload-submit-${variantId ?? "shared"}`}>
            {busy ? "Uploading…" : `Upload ${ready} image${ready === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ImageTile({
  image,
  index,
  count,
  variants,
  onMove,
  onDragStart,
  onDrop,
}: {
  image: AdminImage;
  index: number;
  count: number;
  variants: VariantOption[];
  onMove: (dir: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const { pending, feedback, run } = useActionRunner();
  const [alt, setAlt] = useState(image.altText);
  const [over, setOver] = useState(false);

  return (
    <li
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", image.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
      className={cn("flex flex-col border bg-white p-2 text-xs", over ? "border-charcoal" : "border-line", pending && "opacity-60")}
      data-testid="admin-image"
      data-image-id={image.id}
    >
      <div className="relative cursor-grab active:cursor-grabbing">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.thumbSrc} alt={image.altText || "Product image"} className="aspect-[4/5] w-full bg-cream object-cover" draggable={false} />
        <span className="absolute left-1 top-1">{image.isPrimary ? <Badge tone="gold">Main image</Badge> : <Badge>#{index + 1}</Badge>}</span>
      </div>
      <label className="mt-2 block">
        <span className="text-stone">Alt text</span>
        <input
          value={alt}
          maxLength={250}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => {
            if (alt !== image.altText) run(() => updateImageAction(image.id, { altText: alt || null, variantId: image.variantId }));
          }}
          className="mt-0.5 w-full border border-line px-2 py-1"
        />
      </label>
      <label className="mt-2 block">
        <span className="text-stone">Belongs to</span>
        <select
          value={image.variantId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => updateImageAction(image.id, { altText: alt || null, variantId: e.target.value || null }))}
          className="mt-0.5 w-full border border-line bg-white px-1 py-1"
          data-testid="image-assign"
        >
          <option value="">All colours (shared)</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.colorName} only
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type="button" aria-label="Move earlier" disabled={index === 0 || pending} onClick={() => onMove(-1)} className="px-1 disabled:opacity-30">
          ←
        </button>
        <button type="button" aria-label="Move later" disabled={index === count - 1 || pending} onClick={() => onMove(1)} className="px-1 disabled:opacity-30">
          →
        </button>
        {!image.isPrimary ? (
          <button type="button" disabled={pending} onClick={() => run(() => setPrimaryImageAction(image.id))} className="underline">
            Set as main
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Remove this image? This cannot be undone.")) run(() => deleteImageAction(image.id));
          }}
          className="ml-auto text-danger underline"
        >
          Remove
        </button>
      </div>
      {feedback?.tone === "error" ? (
        <p role="alert" className="mt-1 text-danger">
          {feedback.text}
        </p>
      ) : null}
    </li>
  );
}

function Gallery({
  productId,
  variantId,
  title,
  swatch,
  images,
  variants,
  maxUploadMb,
}: {
  productId: string;
  variantId: string | null;
  title: string;
  swatch?: string | null;
  images: AdminImage[];
  variants: VariantOption[];
  maxUploadMb: number;
}) {
  const [order, setOrder] = useState(() => ordered(images));
  const [dragId, setDragId] = useState<string | null>(null);
  const { feedback, run } = useActionRunner();
  const router = useRouter();
  const refresh = () => router.refresh();

  // Re-sync with the server's order after a refresh.
  const [lastImages, setLastImages] = useState(images);
  if (images !== lastImages) {
    setLastImages(images);
    setOrder(ordered(images));
  }

  const persist = (next: AdminImage[]) => {
    setOrder(next);
    run(() => reorderImagesAction(productId, variantId, next.map((i) => i.id)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    persist(next);
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((i) => i.id !== dragId);
    const dragged = order.find((i) => i.id === dragId);
    const at = next.findIndex((i) => i.id === targetId);
    if (!dragged || at < 0) return;
    next.splice(at, 0, dragged);
    setDragId(null);
    persist(next);
  };

  return (
    <section className="border border-line p-4" aria-label={`${title} images`} data-testid={`gallery-${variantId ?? "shared"}`}>
      <div className="flex items-center gap-2">
        {swatch !== undefined ? <span aria-hidden="true" className="size-4 rounded-full border border-charcoal/20" style={{ backgroundColor: swatch ?? "#ddd" }} /> : null}
        <h3 className="font-sans text-sm font-semibold tracking-normal">{title}</h3>
        <span className="text-xs text-stone">
          {order.length} image{order.length === 1 ? "" : "s"}
        </span>
      </div>
      {variantId === null ? <p className="mt-1 text-xs text-stone">Shared images appear after the selected colour&apos;s own images, for every colour.</p> : null}
      {feedback?.tone === "error" ? (
        <Alert tone="error" className="mt-3">
          {feedback.text}
        </Alert>
      ) : null}
      {order.length ? (
        <>
          <p className="mt-2 text-xs text-stone">Drag to reorder, or use the arrows. The main image is shown first.</p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {order.map((img, i) => (
              <ImageTile
                key={img.id}
                image={img}
                index={i}
                count={order.length}
                variants={variants}
                onMove={(dir) => move(i, dir)}
                onDragStart={() => setDragId(img.id)}
                onDrop={() => dropOn(img.id)}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-stone">No images yet.</p>
      )}
      <Uploader productId={productId} variantId={variantId} galleryName={title} maxUploadMb={maxUploadMb} onUploaded={refresh} />
    </section>
  );
}

export function ImageManager({
  productId,
  productName,
  variants,
  images,
  maxUploadMb,
}: {
  productId: string;
  productName: string;
  variants: VariantOption[];
  images: AdminImage[];
  maxUploadMb: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone">
        Upload images to each colour so customers only see photos of the colour they select. Use &quot;shared&quot; images for details that apply to every colour of {productName}.
      </p>
      {variants.length === 0 ? <Alert tone="info">Add a colour above to upload colour-specific images.</Alert> : null}
      {variants.map((v) => (
        <Gallery
          key={v.id}
          productId={productId}
          variantId={v.id}
          title={v.colorName}
          swatch={v.colorHex}
          images={images.filter((i) => i.variantId === v.id)}
          variants={variants}
          maxUploadMb={maxUploadMb}
        />
      ))}
      <Gallery productId={productId} variantId={null} title="Shared (all colours)" images={images.filter((i) => i.variantId === null)} variants={variants} maxUploadMb={maxUploadMb} />
    </div>
  );
}
