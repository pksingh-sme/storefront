import { Card, PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/db";

export const metadata = { title: "Activity log" };

export default async function ActivityPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } });
  return (
    <>
      <PageHeader title="Activity log" description="The latest 200 administrative changes." />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-stone">
              <tr>
                <th scope="col" className="py-2 pr-4">
                  When
                </th>
                <th scope="col" className="py-2 pr-4">
                  Who
                </th>
                <th scope="col" className="py-2 pr-4">
                  Action
                </th>
                <th scope="col" className="py-2">
                  Item
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone">{l.createdAt.toLocaleString()}</td>
                  <td className="py-2 pr-4">{l.actor?.email ?? "system"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{l.action}</td>
                  <td className="py-2 text-xs text-stone">
                    {l.entityType} {l.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
