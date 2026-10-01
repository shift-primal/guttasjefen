import { readSetting, writeSetting } from "@guttasjefen/db";
import { tunablesSchema } from "@guttasjefen/db/settings";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/lib/auth-middleware";
import { db } from "#/lib/db";

export const getTunables = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(() => readSetting(db, "tunables")); // returns Tunables, defaults filled in

export const saveTunables = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(tunablesSchema)
	.handler(({ data, context }) =>
		writeSetting(db, "tunables", data, `web:${context.session.user.id}`),
	);
