// Housekeeping: removes abandoned uploads (older than 24h) and expired carts.
// Schedule it daily, e.g. with cron: 0 3 * * * npm run storage:cleanup
import "dotenv/config";
import { prisma } from "@/lib/db";
import { purgeExpiredCarts } from "@/server/cart";
import { cleanupStaleUploads } from "@/server/images";

async function main() {
  const uploads = await cleanupStaleUploads();
  const carts = await purgeExpiredCarts();
  console.log(`Removed ${uploads.images} abandoned product uploads, ${uploads.assets} abandoned media uploads, ${carts} expired carts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
