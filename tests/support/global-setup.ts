import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-env";

export default function setup() {
  // Apply migrations to the dedicated test database.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
