import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export * from "drizzle-orm/sql";
export * from "./schema";

export const createDb = (url: string) => drizzle(url, { schema });

export type Db = ReturnType<typeof createDb>;
