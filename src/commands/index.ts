import { help } from "#/commands/help";
import { loop } from "#/commands/loop";
import { nowplaying } from "#/commands/nowplaying";
import { pause } from "#/commands/pause";
import { ping } from "#/commands/ping";
import { play } from "#/commands/play";
import { playNext } from "#/commands/playnext";
import { playNow } from "#/commands/playnow";
import { queue } from "#/commands/queue";
import { resume } from "#/commands/resume";
import { shuffle } from "#/commands/shuffle";
import { skip } from "#/commands/skip";
import { skipTo } from "#/commands/skipto";
import { stop } from "#/commands/stop";
import type { Command } from "#/types";

export const commands: Command[] = [
	ping,
	play,
	playNext,
	playNow,
	pause,
	resume,
	skip,
	skipTo,
	stop,
	nowplaying,
	queue,
	shuffle,
	loop,
	help,
];

const byName = new Map<string, Command>(
	commands.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [n, c])),
);

export function findCommand(name: string): Command | undefined {
	return byName.get(name.toLowerCase());
}
