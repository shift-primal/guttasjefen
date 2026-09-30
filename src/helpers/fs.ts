import { readFile } from "node:fs/promises";

export async function readOptional(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return "";
	}
}
