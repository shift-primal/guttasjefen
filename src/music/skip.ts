import {
	type GuildQueue,
	QueueRepeatMode,
	type Track,
	useMainPlayer,
} from "discord-player";

export function skipCurrent(queue: GuildQueue): boolean {
	return advance(queue, () => queue.node.skip());
}

export function skipToTrack(queue: GuildQueue, track: Track): boolean {
	return advance(queue, () => queue.node.skipTo(track));
}

// In track-repeat mode discord-player answers any skip by replaying the
// current track, so the repeat mode is lifted until the track has finished.
function advance(queue: GuildQueue, action: () => boolean): boolean {
	if (queue.repeatMode !== QueueRepeatMode.TRACK) return action();

	const events = useMainPlayer().events;
	const restore = () => {
		clearTimeout(fallback);
		events.off("playerFinish", onFinish);
		queue.setRepeatMode(QueueRepeatMode.TRACK);
	};
	const onFinish = (finished: GuildQueue) => {
		if (finished.guild.id === queue.guild.id) setImmediate(restore);
	};
	const fallback = setTimeout(restore, 3000);

	queue.setRepeatMode(QueueRepeatMode.OFF);
	events.on("playerFinish", onFinish);

	const skipped = action();
	if (!skipped) restore();
	return skipped;
}
