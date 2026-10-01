import type { Tunables } from "@guttasjefen/db/settings";
import { useState } from "react";
import { saveTunables } from "#/lib/settings.functions";

export function CommandSettings({ tunables }: { tunables: Tunables }) {
	const [prefix, setPrefix] = useState(tunables.commands.prefix); // "-"

	const save = () =>
		saveTunables({
			data: { ...tunables, commands: { ...tunables.commands, prefix } },
		});

	return (
		<div>
			<input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
			<button type="button" onClick={save}>
				Save
			</button>
		</div>
	);
}
