import { createDb } from "@guttasjefen/db";

export const db = createDb(process.env.DATABASE_URL ?? "");
