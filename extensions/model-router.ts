/**
 * Model Router Extension
 *
 * Claude is default for everything. GLM is emergency fallback only.
 * Notifies user when Claude is rate limited and provides /model commands
 * for manual switching.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const MODEL_ALIASES: Record<string, { provider: string; model: string }> = {
	opus: { provider: "anthropic", model: "claude-opus-4-6" },
	claude: { provider: "anthropic", model: "claude-opus-4-6" },
	sonnet: { provider: "anthropic", model: "claude-sonnet-4-6" },
	haiku: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
	glm: { provider: "zai", model: "glm-5" },
	"glm-code": { provider: "zai", model: "glm-4.7" },
	"glm-flash": { provider: "zai", model: "glm-4.7-flash" },
};

export default function (pi: ExtensionAPI) {
	pi.registerCommand("model", {
		description: "Show or switch the current model",
		getArgumentCompletions: (prefix) => {
			const aliases = Object.keys(MODEL_ALIASES);
			const matches = aliases.filter((a) => a.startsWith(prefix));
			return matches.length > 0
				? matches.map((a) => ({
						value: a,
						label: `${a} (${MODEL_ALIASES[a].provider}:${MODEL_ALIASES[a].model})`,
					}))
				: null;
		},
		handler: async (args, ctx) => {
			const alias = args.trim().toLowerCase();

			if (!alias) {
				const current = ctx.model;
				ctx.ui.notify(
					current
						? `Current model: ${current.name} (${current.provider})`
						: "No model selected",
					"info",
				);
				return;
			}

			const target = MODEL_ALIASES[alias];
			if (!target) {
				ctx.ui.notify(
					`Unknown model alias "${alias}". Available: ${Object.keys(MODEL_ALIASES).join(", ")}`,
					"warning",
				);
				return;
			}

			const model = ctx.modelRegistry.find(target.provider, target.model);
			if (!model) {
				ctx.ui.notify(
					`Model ${target.provider}:${target.model} not found. Is the provider configured?`,
					"error",
				);
				return;
			}

			const success = await pi.setModel(model);
			if (success) {
				ctx.ui.notify(`Switched to ${model.name}`, "info");
			} else {
				ctx.ui.notify(`Failed to switch to ${model.name}`, "error");
			}
		},
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!event.error) return;

		const errorStr = String(event.error);
		const isRateLimit =
			errorStr.includes("status 429") || errorStr.includes("status: 429") ||
			errorStr.includes("status 529") || errorStr.includes("status: 529") ||
			errorStr.includes("rate limit") || errorStr.includes("rate_limit") ||
			errorStr.includes("overloaded");

		if (isRateLimit) {
			ctx.ui.notify(
				"Claude rate limited. Use /model glm to switch to GLM, or wait.",
				"warning",
			);
		}
	});
}
