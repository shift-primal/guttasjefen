export function formatTime(
	date: Date,
	locale = "nb-NO",
	timeZone = "Europe/Oslo",
): string {
	return date.toLocaleTimeString(locale, {
		hour: "2-digit",
		minute: "2-digit",
		timeZone,
	});
}

export function formatDuration(duration: string): string | null {
	const shortened = duration.replace(/^0(?=\d)/, "");
	return shortened === "0:00" ? null : shortened;
}

export function elapsed(start: number): string {
	return `${((performance.now() - start) / 1000).toFixed(1)}s`;
}
