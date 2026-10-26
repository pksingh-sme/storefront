import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/server/catalog";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const settings = await getSettings();
  const threshold = settings.lowStockThreshold;
  const [counts, lowStock, outOfStock, recent, orderStats, recentOrders] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { isActive: true, stock: { gt: 0, lte: threshold } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, stock: 0 },
      include: { product: { select: { id: true, name: true } } },
      take: 10,
    }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, status: true, updatedAt: true } }),
    prisma.order.aggregate({ where: { status: { in: ["PAID", "FULFILLED"] } }, _count: { _all: true }, _sum: { totalCents: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, status: true, totalCents: true, currency: true, createdAt: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);
  const outCount = await prisma.productVariant.count({ where: { isActive: true, stock: 0 } });
  const lowCount = await prisma.productVariant.count({ where: { isActive: true, stock: { gt: 0, lte: threshold } } });

  const stats = [
    { label: "Total products", value: total, href: "/admin/products" },
    { label: "Published", value: count("PUBLISHED"), href: "/admin/products?status=PUBLISHED" },
    { label: "Drafts", value: count("DRAFT"), href: "/admin/products?status=DRAFT" },
    { label: "Low stock colours", value: lowCount, href: "#stock" },
    { label: "Out of stock colours", value: outCount, href: "#stock" },
    { label: "Paid orders", value: orderStats._count._all, href: "/admin/orders" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome back. Low stock means ${threshold} or fewer left.`} actions={<ButtonLink href="/admin/products/new">New product</ButtonLink>} />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block border border-line bg-white p-4 hover:border-charcoal">
              <p className="text-xs text-stone">{s.label}</p>
              <p className="mt-1 font-display text-3xl">{s.value}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-stone">Revenue from paid orders: {formatMoney(orderStats._sum.totalCents ?? 0, settings.currency)}</p>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card title="Stock alerts">
          <div id="stock" />
          {outOfStock.length + lowStock.length === 0 ? (
            <p className="text-sm text-stone">All active colours are well stocked.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {[...outOfStock, ...lowStock].map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/products/${v.product.id}#variants`} className="hover:underline">
                    {v.product.name} — {v.colorName} <span className="text-stone">({v.sku})</span>
                  </Link>
                  {v.stock === 0 ? <Badge tone="danger">Out of stock</Badge> : <Badge tone="warning">{v.stock} left</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently updated products">
          <ul className="divide-y divide-line text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/products/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
                <span className="flex items-center gap-3 text-xs text-stone">
                  <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "DRAFT" ? "neutral" : "warning"}>{p.status.toLowerCase()}</Badge>
                  {p.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent orders">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-stone">No orders yet. Orders appear here once online checkout is configured.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span>{o.number}</span>
                  <span className="flex items-center gap-3">
                    <Badge tone={o.status === "PAID" ? "success" : "neutral"}>{o.status.toLowerCase()}</Badge>
                    {formatMoney(o.totalCents, o.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
