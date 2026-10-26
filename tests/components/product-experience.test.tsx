import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryImage } from "@/lib/gallery";
import type { ProductDetailDTO } from "@/server/catalog";

const addToCartAction = vi.fn();
vi.mock("@/app/(store)/actions", () => ({ addToCartAction: (...args: unknown[]) => addToCartAction(...args) }));

const { ProductExperience } = await import("@/components/product/product-experience");

const image = (id: string, variantId: string | null, sortOrder: number, isPrimary = false): GalleryImage => ({
  id,
  variantId,
  sortOrder,
  isPrimary,
  alt: `alt ${id}`,
  src: `/media/${id}.webp`,
  srcSet: `/media/${id}.webp 640w`,
  thumbSrc: `/media/${id}-thumb.webp`,
  width: 640,
  height: 800,
});

const variant = (id: string, colorName: string, extra: Partial<ProductDetailDTO["variants"][number]> = {}) => ({
  id,
  colorName,
  colorHex: "#7A1F35",
  sku: `SKU-${id.toUpperCase()}`,
  regularCents: 16500,
  saleCents: null,
  unitCents: 16500,
  stock: 5,
  isActive: true,
  ...extra,
});

function shawl(): ProductDetailDTO {
  return {
    id: "p1",
    slug: "pashmina",
    name: "Pashmina Shawl",
    shortDescription: "Soft.",
    description: null,
    currency: "USD",
    seoTitle: null,
    seoDescription: null,
    specifications: [],
    category: { id: "c1", name: "Shawls", slug: "shawls", parent: null },
    updatedAt: new Date().toISOString(),
    variants: [
      variant("cream", "Cream", { stock: 0 }),
      variant("burgundy", "Burgundy", { stock: 2 }),
      variant("emerald", "Emerald Green", { regularCents: 17900, unitCents: 17900, stock: 7 }),
    ],
    images: [
      image("bur-1", "burgundy", 0, true),
      image("bur-2", "burgundy", 1),
      image("bur-3", "burgundy", 2),
      image("emr-1", "emerald", 0, true),
      image("emr-2", "emerald", 1),
      image("crm-1", "cream", 0, true),
      image("shared", null, 0, true),
    ],
  };
}

const mainImageId = () => screen.getByTestId("gallery-main-image").getAttribute("data-image-id");
const thumbIds = () => screen.getAllByTestId("gallery-thumbnail").map((t) => t.getAttribute("data-image-id"));
const swatch = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  addToCartAction.mockReset();
  window.history.replaceState(null, "", "/product/pashmina");
});

describe("product page variant gallery", () => {
  it("selects the first in-stock colour by default and shows its main image", () => {
    render(<ProductExperience product={shawl()} />);
    expect(swatch("Burgundy")).toHaveAttribute("aria-checked", "true");
    expect(mainImageId()).toBe("bur-1");
    expect(thumbIds()).toEqual(["bur-1", "bur-2", "bur-3", "shared"]);
  });

  it("opens on the colour requested in the URL", () => {
    render(<ProductExperience product={shawl()} initialVariantId="emerald-green" />);
    expect(screen.getByTestId("selected-color")).toHaveTextContent("Emerald Green");
    expect(mainImageId()).toBe("emr-1");
  });

  it("updates the main image when a thumbnail is clicked", async () => {
    render(<ProductExperience product={shawl()} />);
    await userEvent.click(screen.getAllByTestId("gallery-thumbnail")[2]);
    expect(mainImageId()).toBe("bur-3");
    expect(screen.getAllByTestId("gallery-thumbnail")[2]).toHaveAttribute("aria-current", "true");
  });

  it("moves with next/previous buttons and wraps around", async () => {
    render(<ProductExperience product={shawl()} />);
    await userEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(mainImageId()).toBe("bur-2");
    await userEvent.click(screen.getByRole("button", { name: "Previous image" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous image" }));
    expect(mainImageId()).toBe("shared");
  });

  it("supports arrow keys, Home and End", () => {
    render(<ProductExperience product={shawl()} />);
    const carousel = screen.getByRole("region", { name: "Pashmina Shawl in Burgundy" });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(mainImageId()).toBe("bur-2");
    fireEvent.keyDown(carousel, { key: "End" });
    expect(mainImageId()).toBe("shared");
    fireEvent.keyDown(carousel, { key: "Home" });
    expect(mainImageId()).toBe("bur-1");
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(mainImageId()).toBe("shared");
  });

  it("changes image on horizontal swipe but not on vertical scroll", () => {
    render(<ProductExperience product={shawl()} />);
    const carousel = screen.getByRole("region", { name: /Pashmina Shawl in Burgundy/ });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 200, clientY: 110 }] });
    expect(mainImageId()).toBe("bur-2");
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 300, clientY: 105 }] });
    expect(mainImageId()).toBe("bur-1");
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 150, clientY: 400 }] });
    expect(mainImageId()).toBe("bur-1");
  });

  it("switches gallery, SKU, price and stock when a colour is selected and resets the image index", async () => {
    render(<ProductExperience product={shawl()} />);
    await userEvent.click(screen.getByRole("button", { name: "Next image" }));
    await userEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(mainImageId()).toBe("bur-3");

    await userEvent.click(swatch("Emerald Green"));
    expect(swatch("Emerald Green")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("selected-color")).toHaveTextContent("Emerald Green");
    expect(mainImageId()).toBe("emr-1");
    expect(thumbIds()).toEqual(["emr-1", "emr-2", "shared"]);
    expect(thumbIds()).not.toContain("bur-1");
    expect(screen.getByTestId("variant-sku")).toHaveTextContent("SKU-EMERALD");
    expect(screen.getByTestId("product-price")).toHaveTextContent("$179.00");
    expect(screen.getByTestId("variant-stock")).toHaveTextContent("In stock");
    expect(window.location.search).toBe("?color=emerald-green");
  });

  it("shows out-of-stock state and blocks adding to the bag", async () => {
    render(<ProductExperience product={shawl()} />);
    await userEvent.click(swatch("Cream"));
    expect(screen.getByTestId("variant-stock")).toHaveTextContent("Out of stock");
    const button = screen.getByTestId("add-to-cart");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Out of stock");
    await userEvent.click(button);
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it("shows a low stock warning and caps the quantity at available stock", async () => {
    render(<ProductExperience product={shawl()} lowStockThreshold={3} />);
    expect(screen.getByTestId("variant-stock")).toHaveTextContent("Only 2 left");
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    await userEvent.click(increase);
    expect(screen.getByLabelText("Quantity", { selector: "input" })).toHaveValue(2);
    expect(increase).toBeDisabled();
  });

  it("adds the selected colour and quantity to the bag", async () => {
    addToCartAction.mockResolvedValue({ ok: true, data: { quantity: 2 } });
    render(<ProductExperience product={shawl()} />);
    await userEvent.click(swatch("Emerald Green"));
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await act(async () => {
      await userEvent.click(screen.getByTestId("add-to-cart"));
    });
    expect(addToCartAction).toHaveBeenCalledWith("emerald", 2);
    expect(await screen.findByTestId("cart-message")).toHaveTextContent("Added 2 × Pashmina Shawl (Emerald Green)");
  });

  it("shows server errors from adding to the bag", async () => {
    addToCartAction.mockResolvedValue({ ok: false, error: "Only 2 available in Burgundy." });
    render(<ProductExperience product={shawl()} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId("add-to-cart"));
    });
    expect(await screen.findByTestId("cart-message")).toHaveTextContent("Only 2 available");
  });

  it("lets keyboard users move between colours with arrow keys", async () => {
    render(<ProductExperience product={shawl()} />);
    const group = screen.getByRole("radiogroup", { name: /Colour/ });
    const burgundy = within(group).getByRole("radio", { name: /^Burgundy/ });
    expect(burgundy).toHaveAttribute("tabindex", "0");
    expect(within(group).getByRole("radio", { name: /^Cream/ })).toHaveAttribute("tabindex", "-1");
    burgundy.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(swatch("Emerald Green")).toHaveAttribute("aria-checked", "true");
    expect(swatch("Emerald Green")).toHaveFocus();
    expect(mainImageId()).toBe("emr-1");
  });

  it("labels sold-out swatches for screen readers", () => {
    render(<ProductExperience product={shawl()} />);
    expect(screen.getByRole("radio", { name: "Cream (sold out)" })).toBeInTheDocument();
  });

  it("falls back gracefully when a colour has no images of its own", async () => {
    const p = shawl();
    p.images = p.images.filter((i) => i.variantId !== "emerald");
    render(<ProductExperience product={p} />);
    await userEvent.click(swatch("Emerald Green"));
    expect(mainImageId()).toBe("shared");
    expect(screen.queryAllByTestId("gallery-thumbnail")).toHaveLength(0);
  });

  it("does not show cart controls in admin preview mode", () => {
    render(<ProductExperience product={shawl()} mode="preview" />);
    expect(screen.queryByTestId("add-to-cart")).not.toBeInTheDocument();
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
  });
});
