import { reset } from "#/commands/chat/reset";
import { help } from "#/commands/general/help";
import { ping } from "#/commands/general/ping";
import { loop } from "#/commands/music/loop";
import { nowplaying } from "#/commands/music/nowplaying";
import { pause } from "#/commands/music/pause";
import { play, playNext, playNow } from "#/commands/music/play";
import { queue } from "#/commands/music/queue";
import { remove } from "#/commands/music/remove";
import { resume } from "#/commands/music/resume";
import { shuffle } from "#/commands/music/shuffle";
import { skip } from "#/commands/music/skip";
import { skipTo } from "#/commands/music/skipto";
import { stop } from "#/commands/music/stop";
import type { Command } from "#/types";

export const commands: Command[] = [
	play,
	playNext,
	playNow,
	pause,
	resume,
	skip,
	skipTo,
	remove,
	stop,
	nowplaying,
	queue,
	shuffle,
	loop,
	reset,
  help,
  ping,
];

const byName = new Map<string, Command>(
	commands.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [n, c])),
);

export function findCommand(name: string): Command | undefined {
	return byName.get(name.toLowerCase());
}
