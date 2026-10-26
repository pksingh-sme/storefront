import { Card, PageHeader } from "@/components/admin/page-header";
import { NewProductForm } from "@/components/admin/new-product-form";
import { prisma } from "@/lib/db";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } });
  return (
    <>
      <PageHeader title="New product" description="Start with the basics. You'll add colours, images and descriptions on the next screen." />
      <Card className="max-w-xl">
        {categories.length === 0 ? <p className="text-sm text-danger">Create a category first under Categories.</p> : <NewProductForm categories={categories} />}
      </Card>
    </>
  );
}
