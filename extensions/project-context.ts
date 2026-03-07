import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

const MEMORY_DIR = join(homedir(), ".pi", "agent", "memory");

function getMemoryPath(cwd: string): string {
	const projectName = basename(cwd);
	return join(MEMORY_DIR, `${projectName}.md`);
}

function readMemory(cwd: string): string {
	const path = getMemoryPath(cwd);
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf-8");
}

function readProjectConfig(cwd: string): string {
	const configFiles = [
		"AGENTS.md",
		"CLAUDE.md",
		".pi/project.md",
		"package.json",
		"go.mod",
		"Cargo.toml",
		"pyproject.toml",
	];

	const sections: string[] = [];

	for (const file of configFiles) {
		const path = join(cwd, file);
		if (!existsSync(path)) continue;

		const content = readFileSync(path, "utf-8");
		// For JSON files, only include key fields
		if (file === "package.json") {
			try {
				const pkg = JSON.parse(content);
				sections.push(
					`## ${file}\n- name: ${pkg.name}\n- description: ${pkg.description || "n/a"}\n- scripts: ${Object.keys(pkg.scripts || {}).join(", ") || "none"}`,
				);
			} catch {
				sections.push(`## ${file}\n(parse error)`);
			}
		} else {
			// Truncate large files
			const truncated = content.length > 2000 ? `${content.slice(0, 2000)}\n...(truncated)` : content;
			sections.push(`## ${file}\n${truncated}`);
		}
	}

	return sections.join("\n\n");
}

export default function (pi: ExtensionAPI) {
	pi.on(
		"before_agent_start",
		async (event: BeforeAgentStartEvent, ctx): Promise<BeforeAgentStartEventResult> => {
			const memory = readMemory(ctx.cwd);
			const projectConfig = readProjectConfig(ctx.cwd);

			const contextParts: string[] = [];

			if (projectConfig) {
				contextParts.push(`# Project Context\n${projectConfig}`);
			}

			if (memory) {
				contextParts.push(`# Persistent Memory\n${memory}`);
			}

			if (contextParts.length === 0) return {};

			const contextBlock = contextParts.join("\n\n---\n\n");

			return {
				systemPrompt: `${event.systemPrompt}\n\n${contextBlock}`,
			};
		},
	);

	pi.on("session_shutdown", async (_event, ctx) => {
		// Extract and save learned patterns
		// This is a placeholder — in practice, the agent would analyze the
		// conversation to extract patterns. For now, we ensure the memory
		// directory exists so skills and manual saves work.
		mkdirSync(MEMORY_DIR, { recursive: true });
	});

	pi.on("session_start", async (_event, ctx) => {
		mkdirSync(MEMORY_DIR, { recursive: true });
		const memoryPath = getMemoryPath(ctx.cwd);
		if (existsSync(memoryPath)) {
			ctx.ui.setStatus("memory", `memory: ${basename(memoryPath)}`);
		}
	});
}
