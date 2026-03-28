/**
 * Project Context Extension
 *
 * Auto-detects project type and injects context into the system prompt.
 * Reads AGENTS.md, CLAUDE.md, package.json, go.mod, etc. and appends
 * a summary to every agent turn.
 */

import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface ProjectInfo {
	type: string;
	name: string;
	configFiles: string[];
	agentInstructions: string;
}

const CONFIG_FILES = [
	{ file: "AGENTS.md", category: "agent" },
	{ file: "CLAUDE.md", category: "agent" },
	{ file: ".pi/AGENTS.md", category: "agent" },
	{ file: "package.json", category: "node" },
	{ file: "go.mod", category: "go" },
	{ file: "Cargo.toml", category: "rust" },
	{ file: "pyproject.toml", category: "python" },
	{ file: "Makefile", category: "build" },
	{ file: "docker-compose.yml", category: "docker" },
	{ file: "docker-compose.dev.yml", category: "docker" },
	{ file: "buf.yaml", category: "proto" },
];

async function tryRead(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return null;
	}
}

async function detectProject(cwd: string): Promise<ProjectInfo> {
	const found: string[] = [];
	const categories = new Set<string>();
	let agentInstructions = "";
	let name = basename(cwd);

	for (const { file, category } of CONFIG_FILES) {
		const content = await tryRead(join(cwd, file));
		if (content !== null) {
			found.push(file);
			categories.add(category);

			if (category === "agent" && !agentInstructions) {
				agentInstructions = content.slice(0, 2000);
			}

			if (file === "package.json") {
				try {
					const pkg = JSON.parse(content);
					if (pkg.name) name = pkg.name;
				} catch {}
			}

			if (file === "go.mod") {
				const match = content.match(/^module\s+(\S+)/m);
				if (match) name = match[1];
			}
		}
	}

	let type = "Unknown";
	if (categories.has("go") && categories.has("node")) type = "Multi-language (Go + Node)";
	else if (categories.has("go")) type = "Go module";
	else if (categories.has("node")) type = "Node.js";
	else if (categories.has("rust")) type = "Rust";
	else if (categories.has("python")) type = "Python";

	return { type, name, configFiles: found, agentInstructions };
}

export default function (pi: ExtensionAPI) {
	let projectInfo: ProjectInfo | null = null;

	pi.on("session_start", async (_event, ctx) => {
		projectInfo = await detectProject(ctx.cwd);
		if (projectInfo.configFiles.length > 0) {
			ctx.ui.notify(
				`Project: ${projectInfo.name} (${projectInfo.type})`,
				"info",
			);
		}
	});

	pi.on("before_agent_start", async (event) => {
		if (!projectInfo || projectInfo.configFiles.length === 0) return;

		const contextBlock = [
			"\n\n## Project Context (auto-detected by plder)",
			`**Type**: ${projectInfo.type}`,
			`**Name**: ${projectInfo.name}`,
			`**Config files**: ${projectInfo.configFiles.join(", ")}`,
		];

		if (projectInfo.agentInstructions) {
			contextBlock.push("");
			contextBlock.push("### Agent Instructions");
			contextBlock.push(projectInfo.agentInstructions);
		}

		return { systemPrompt: event.systemPrompt + contextBlock.join("\n") };
	});
}
