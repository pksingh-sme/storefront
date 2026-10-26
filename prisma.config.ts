import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Read lazily so `prisma generate` (run on npm install and in Docker builds) works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
