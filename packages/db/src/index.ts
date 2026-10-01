import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export * from "drizzle-orm/sql";
export * from "./schema";
export * from "./store/examples";
export * from "./store/guilds";
export * from "./store/jobs";
export * from "./store/listen";
export * from "./store/lore";
export * from "./store/profiles";
export * from "./store/settings";

export const createDb = (url: string) => drizzle(url, { schema });

export type Db = ReturnType<typeof createDb>;
