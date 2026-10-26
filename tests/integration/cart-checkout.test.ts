import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addToCart, getCartView, removeCartItem, updateCartItem } from "@/server/cart";
import { createPendingOrder, markOrderPaid } from "@/server/checkout/orders";
import { makeCategory, resetDb } from "../support/factories";

async function publishedProduct() {
  const category = await makeCategory();
  const product = await prisma.product.create({
    data: {
      name: "Shawl",
      slug: "shawl",
      categoryId: category.id,
      basePriceCents: 10000,
      status: "PUBLISHED",
      publishedAt: new Date(),
      variants: {
        create: [
          { colorName: "Burgundy", sku: "S-BUR", stock: 3 },
          { colorName: "Royal Blue", sku: "S-RBL", stock: 5, priceCents: 12500 },
          { colorName: "Cream", sku: "S-CRM", stock: 0 },
        ],
      },
    },
    include: { variants: true },
  });
  const v = Object.fromEntries(product.variants.map((x) => [x.colorName, x]));
  return { product, burgundy: v["Burgundy"], blue: v["Royal Blue"], cream: v["Cream"] };
}

beforeEach(resetDb);

describe("cart", () => {
  it("keeps the selected colour and quantity and prices it from the database", async () => {
    const { blue } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: blue.id, quantity: 2 });
    const cart = await getCartView(token);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ colorName: "Royal Blue", sku: "S-RBL", quantity: 2, unitCents: 12500, lineCents: 25000 });
    expect(cart.subtotalCents).toBe(25000);
  });

  it("ignores any client-supplied price", async () => {
    const { burgundy } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 1, priceCents: 1, unitCents: 1 });
    expect((await getCartView(token)).subtotalCents).toBe(10000);
  });

  it("reflects price changes made after the item was added", async () => {
    const { burgundy } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 1 });
    await prisma.productVariant.update({ where: { id: burgundy.id }, data: { priceCents: 9000 } });
    expect((await getCartView(token)).subtotalCents).toBe(9000);
  });

  it("rejects out-of-stock colours and quantities above stock", async () => {
    const { burgundy, cream } = await publishedProduct();
    await expect(addToCart(null, { variantId: cream.id, quantity: 1 })).rejects.toThrow(/out of stock/);
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 2 });
    await expect(addToCart(token, { variantId: burgundy.id, quantity: 2 })).rejects.toThrow(/Only 3 available/);
    expect((await getCartView(token)).lines[0].quantity).toBe(2);
  });

  it("rejects unknown variants and unpublished products", async () => {
    const { product, burgundy } = await publishedProduct();
    await expect(addToCart(null, { variantId: "does-not-exist", quantity: 1 })).rejects.toThrow(/no longer available/);
    await prisma.product.update({ where: { id: product.id }, data: { status: "DRAFT" } });
    await expect(addToCart(null, { variantId: burgundy.id, quantity: 1 })).rejects.toThrow(/no longer available/);
  });

  it("updates and removes items only within the visitor's own cart", async () => {
    const { burgundy, blue } = await publishedProduct();
    const mine = await addToCart(null, { variantId: burgundy.id, quantity: 1 });
    const theirs = await addToCart(null, { variantId: blue.id, quantity: 1 });
    const theirItem = (await getCartView(theirs.token)).lines[0];

    await expect(updateCartItem(mine.token, { itemId: theirItem.id, quantity: 3 })).rejects.toThrow(/not in your bag/);
    await removeCartItem(mine.token, theirItem.id);
    expect((await getCartView(theirs.token)).lines).toHaveLength(1);

    const myItem = (await getCartView(mine.token)).lines[0];
    await expect(updateCartItem(mine.token, { itemId: myItem.id, quantity: 9 })).rejects.toThrow(/Only 3/);
    await updateCartItem(mine.token, { itemId: myItem.id, quantity: 3 });
    expect((await getCartView(mine.token)).lines[0].quantity).toBe(3);
    await updateCartItem(mine.token, { itemId: myItem.id, quantity: 0 });
    expect((await getCartView(mine.token)).lines).toHaveLength(0);
  });

  it("flags lines whose stock dropped below the cart quantity", async () => {
    const { burgundy } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 3 });
    await prisma.productVariant.update({ where: { id: burgundy.id }, data: { stock: 1 } });
    const cart = await getCartView(token);
    expect(cart.hasIssues).toBe(true);
    expect(cart.lines[0].issue).toBe("Only 1 left");
  });
});

describe("checkout", () => {
  it("revalidates stock and prices on the server when creating an order", async () => {
    const { burgundy, blue } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 2 });
    await addToCart(token, { variantId: blue.id, quantity: 1 });
    await prisma.storeSettings.create({ data: { id: "store", flatShippingCents: 1000, taxRateBasisPoints: 1000 } });

    const { order } = await createPendingOrder(token);
    expect(order.status).toBe("PENDING");
    expect(order.subtotalCents).toBe(32500);
    expect(order.shippingCents).toBe(1000);
    expect(order.taxCents).toBe(3250);
    expect(order.totalCents).toBe(36750);
    expect(order.items.map((i) => [i.sku, i.unitPriceCents, i.quantity]).sort()).toEqual([
      ["S-BUR", 10000, 2],
      ["S-RBL", 12500, 1],
    ]);

    await prisma.productVariant.update({ where: { id: burgundy.id }, data: { stock: 1 } });
    await expect(createPendingOrder(token)).rejects.toThrow(/Only 1/);
  });

  it("marks orders paid once, decrementing stock and clearing the cart", async () => {
    const { burgundy } = await publishedProduct();
    const { token } = await addToCart(null, { variantId: burgundy.id, quantity: 2 });
    const { order, cartId } = await createPendingOrder(token);
    const first = await markOrderPaid(order.id, { provider: "stripe", cartId, amountTotal: order.totalCents });
    const replay = await markOrderPaid(order.id, { provider: "stripe", cartId });
    expect(first.alreadyProcessed).toBe(false);
    expect(replay.alreadyProcessed).toBe(true);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: burgundy.id } })).stock).toBe(1);
    expect((await prisma.product.findFirstOrThrow()).totalStock).toBe(6);
    expect((await getCartView(token)).lines).toHaveLength(0);
  });
});
