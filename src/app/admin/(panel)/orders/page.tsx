import { Card, PageHeader } from "@/components/admin/page-header";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { Alert, Badge } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { paymentsEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { items: true } });
  return (
    <>
      <PageHeader title="Orders" description="Orders are created at checkout and marked paid only by the payment provider's verified webhook." />
      {!paymentsEnabled() ? (
        <Alert tone="warning" className="mb-4">
          Online payments are not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable checkout (see docs/DEPLOYMENT.md).
        </Alert>
      ) : null}
      <Card>
        {orders.length === 0 ? <p className="text-sm text-stone">No orders yet.</p> : null}
        <ul className="divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id} className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-medium">{o.number}</p>
                <Badge tone={o.status === "PAID" || o.status === "FULFILLED" ? "success" : o.status === "PENDING" ? "neutral" : "warning"}>{o.status.toLowerCase()}</Badge>
                <p className="text-sm text-stone">{o.createdAt.toLocaleString()}</p>
                <p className="ml-auto text-sm font-medium">{formatMoney(o.totalCents, o.currency)}</p>
                <OrderStatusControl orderId={o.id} status={o.status} />
              </div>
              <ul className="mt-2 text-sm text-stone">
                {o.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity} × {i.productName} — {i.variantName} ({i.sku}) @ {formatMoney(i.unitPriceCents, o.currency)}
                  </li>
                ))}
              </ul>
              {o.email ? <p className="mt-1 text-xs text-stone">{o.email}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
