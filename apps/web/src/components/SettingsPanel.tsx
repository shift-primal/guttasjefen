import { CommandSettings } from "#/components/CommandSettings";
import { getTunables } from "#/lib/settings.functions";

export const SettingsPanel = () => {
	return (
		<div>
			<p>Settings</p>
			<CommandSettings tunables={tunables} />
		</div>
	);
};
