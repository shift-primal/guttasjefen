import type { PoolClient } from "pg";
import type { Db } from "../index";

export const CHANNELS = {
	setting: "setting_changed",
	example: "example_changed",
	botJob: "bot_job_created",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

const RELISTEN_MS = 5000;

// Each handler also gets null after every (re)connect, since notifications while disconnected are missed
export function listen(
	db: Db,
	handlers: Partial<Record<Channel, (payload: string | null) => void>>,
) {
	const entries = Object.entries(handlers) as [
		Channel,
		(payload: string | null) => void,
	][];

	async function connect() {
		let client: PoolClient | undefined;
		const retry = (error: unknown) => {
			console.error("[listen] Lost the connection, retrying:", error);
			client?.release(true);
			client = undefined;
			setTimeout(connect, RELISTEN_MS);
		};
		try {
			const connected = await db.$client.connect();
			client = connected;
			connected.on("notification", ({ channel, payload }) => {
				handlers[channel as Channel]?.(payload ?? "");
			});
			connected.once("error", retry);
			for (const [channel] of entries)
				await connected.query(`LISTEN ${channel}`);
			for (const [, handler] of entries) handler(null);
		} catch (error) {
			retry(error);
		}
	}
	void connect();
}
