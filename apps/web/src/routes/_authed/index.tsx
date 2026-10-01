import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "#/components/SettingsPanel";

const Home = () => {
	return <SettingsPanel />;
};

export const Route = createFileRoute("/_authed/")({ component: Home });
