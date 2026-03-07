import type { ExtensionAPI, InputEvent, InputEventResult } from "@mariozechner/pi-coding-agent";

/**
 * Smart model routing by task type.
 *
 * Routing rules:
 * - Exploration/search/simple questions  -> GLM-4.5-Flash (zai, cheapest)
 * - Code generation/editing/refactoring  -> Claude Sonnet (anthropic)
 * - Complex reasoning/architecture/debug -> Claude Opus (anthropic)
 * - Vision tasks (images attached)       -> GLM-4.5V (zai)
 */

interface ModelTarget {
	provider: string;
	id: string;
}

const CHEAP: ModelTarget = { provider: "zai", id: "glm-4.5-flash" };
const CODE: ModelTarget = { provider: "anthropic", id: "claude-sonnet-4-20250514" };
const REASONING: ModelTarget = { provider: "anthropic", id: "claude-opus-4-20250514" };
const VISION: ModelTarget = { provider: "zai", id: "glm-4.5v" };

const EXPLORATION_PATTERNS = [
	/\b(what|where|which|how many|list|find|search|show|explain|describe)\b/i,
	/\b(what is|what are|tell me about|summarize)\b/i,
	/\?$/,
];

const REASONING_PATTERNS = [
	/\b(debug|diagnose|why does|why is|root cause|investigate)\b/i,
	/\b(architect|design|trade-?off|approach|strategy)\b/i,
	/\b(complex|tricky|subtle|edge case)\b/i,
];

function classifyTask(text: string, hasImages: boolean): ModelTarget {
	if (hasImages) return VISION;

	if (REASONING_PATTERNS.some((p) => p.test(text))) return REASONING;

	if (EXPLORATION_PATTERNS.some((p) => p.test(text))) return CHEAP;

	// Default to code model for implementation tasks
	return CODE;
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event: InputEvent, ctx): Promise<InputEventResult> => {
		const target = classifyTask(event.text, (event.images?.length ?? 0) > 0);
		const currentModel = ctx.model;

		if (currentModel && currentModel.id === target.id && currentModel.provider === target.provider) {
			return { action: "continue" };
		}

		const allModels = ctx.modelRegistry.getAvailable();
		const targetModel = allModels.find((m) => m.id === target.id && m.provider === target.provider);

		if (targetModel) {
			const success = await pi.setModel(targetModel);
			if (success) {
				ctx.ui.setStatus("router", `routed -> ${targetModel.name}`);
			}
		}

		return { action: "continue" };
	});

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("router", "model-router active");
	});
}
