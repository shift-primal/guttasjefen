// Guttasjefen's chat personality: everything the rest of the bot needs to know about it
import { reset } from "#/personality/chat";
import { dials } from "#/personality/dials";
import { lore } from "#/personality/lore";
import type { Command } from "#/types";

export { chatHelp, maybeReply } from "#/personality/chat";
export { DIALS_ID_PREFIX } from "#/personality/config";
export { handleDials } from "#/personality/dials";

export const personalityCommands: Command[] = [dials, lore, reset];
