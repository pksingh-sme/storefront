"use client";

import { updateOrderStatusAction } from "@/app/admin/actions";
import type { OrderStatus } from "@/generated/prisma/client";
import { useActionRunner } from "./use-action-feedback";

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PENDING: [{ status: "CANCELLED", label: "Cancel" }],
  PAID: [
    { status: "FULFILLED", label: "Mark fulfilled" },
    { status: "REFUNDED", label: "Mark refunded" },
  ],
  FULFILLED: [{ status: "REFUNDED", label: "Mark refunded" }],
};

export function OrderStatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { pending, feedback, run } = useActionRunner();
  return (
    <span className="flex items-center gap-3 text-xs">
      {(NEXT[status] ?? []).map((n) => (
        <button
          key={n.status}
          type="button"
          disabled={pending}
          className="underline underline-offset-4"
          onClick={() => {
            if (n.status === "REFUNDED" && !confirm("Issue the refund in your payment provider's dashboard first. Mark as refunded?")) return;
            run(() => updateOrderStatusAction(orderId, n.status));
          }}
        >
          {n.label}
        </button>
      ))}
      {feedback?.tone === "error" ? <span className="text-danger">{feedback.text}</span> : null}
    </span>
  );
}
