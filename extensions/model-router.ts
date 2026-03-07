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

const CHEAP_MODEL = "glm-4.5-flash";
const CODE_MODEL = "claude-sonnet-4-20250514";
const REASONING_MODEL = "claude-opus-4-20250514";
const VISION_MODEL = "glm-4.5v";

const EXPLORATION_PATTERNS = [
	/\b(what|where|which|how many|list|find|search|show|explain|describe)\b/i,
	/\b(what is|what are|tell me about|summarize)\b/i,
	/\?$/,
];

const REASONING_PATTERNS = [
	/\b(debug|diagnose|why does|why is|root cause|investigate)\b/i,
	/\b(architect|design|trade-?off|approach|strategy)\b/i,
	/\b(complex|tricky|subtle|edge case)\b/i,
	/\b(review|analyze|evaluate|compare)\b/i,
];

function classifyTask(text: string, hasImages: boolean): string {
	if (hasImages) return VISION_MODEL;

	if (REASONING_PATTERNS.some((p) => p.test(text))) return REASONING_MODEL;

	if (EXPLORATION_PATTERNS.some((p) => p.test(text))) return CHEAP_MODEL;

	// Default to code model for implementation tasks
	return CODE_MODEL;
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event: InputEvent, ctx): Promise<InputEventResult> => {
		const targetModelId = classifyTask(event.text, (event.images?.length ?? 0) > 0);
		const currentModel = ctx.model;

		if (currentModel && currentModel.id === targetModelId) {
			return { action: "continue" };
		}

		const allModels = ctx.modelRegistry.getModels();
		const targetModel = allModels.find((m) => m.id === targetModelId);

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
