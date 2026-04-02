import dotenv from "dotenv";
dotenv.config({ path: process.env.E2E_ENV_FILE || process.env.DOTENV_CONFIG_PATH || ".env.local" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
