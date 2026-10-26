-- Data-integrity constraints that Prisma schema language cannot express.

-- Money and stock must never be negative.
ALTER TABLE "Product" ADD CONSTRAINT "Product_basePrice_nonneg" CHECK ("basePriceCents" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_salePrice_valid" CHECK ("salePriceCents" IS NULL OR ("salePriceCents" >= 0 AND "salePriceCents" < "basePriceCents"));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_nonneg" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_salePrice_nonneg" CHECK ("salePriceCents" IS NULL OR "salePriceCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonneg" CHECK ("stock" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_colorHex_format" CHECK ("colorHex" IS NULL OR "colorHex" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPrice_nonneg" CHECK ("unitPriceCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totals_nonneg" CHECK ("subtotalCents" >= 0 AND "shippingCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_singleton" CHECK ("id" = 'store');

-- At most one main image per gallery (a gallery is the product's shared images or one variant's images).
CREATE UNIQUE INDEX "ProductImage_one_primary_per_gallery"
  ON "ProductImage" ("productId", COALESCE("variantId", ''))
  WHERE "isPrimary";

-- Case-insensitive search support on product names.
CREATE INDEX "Product_name_lower_idx" ON "Product" (lower("name"));
