import { createDb } from "@guttasjefen/db";
import { env } from "#/config/env";

export const db = createDb(env.DATABASE_URL);
