import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./index";

config({ path: ["../../.env.local", "../../.env"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
await migrate(db, { migrationsFolder: "drizzle" });
await db.$client.end();
console.log("Migrations applied");
