import type { ExtensionAPI, InputEvent, InputEventResult } from "@mariozechner/pi-coding-agent";

/**
 * Smart model routing by task type.
 *
 * Routing rules:
 * - Exploration/search/simple questions  -> GLM-4.5-Flash (zai, cheapest)
 * - Code generation/editing/refactoring  -> Claude Sonnet 4.6 (anthropic)
 * - Complex reasoning/architecture/debug -> Claude Opus 4.6 (anthropic)
 * - Vision tasks (images attached)       -> GLM-4.5V (zai)
 */

interface ModelTarget {
	provider: string;
	id: string;
}

const CHEAP: ModelTarget = { provider: "zai", id: "glm-4.5-flash" };
const CODE: ModelTarget = { provider: "anthropic", id: "claude-sonnet-4-6" };
const REASONING: ModelTarget = { provider: "anthropic", id: "claude-opus-4-6" };
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

type TaskType = "vision" | "reasoning" | "exploration" | "code";

function classifyTask(text: string, hasImages: boolean): { target: ModelTarget; type: TaskType } {
	if (hasImages) return { target: VISION, type: "vision" };
	if (REASONING_PATTERNS.some((p) => p.test(text))) return { target: REASONING, type: "reasoning" };
	if (EXPLORATION_PATTERNS.some((p) => p.test(text))) return { target: CHEAP, type: "exploration" };
	return { target: CODE, type: "code" };
}

const TASK_LABEL: Record<TaskType, string> = {
	vision: "vision",
	reasoning: "reasoning",
	exploration: "explore",
	code: "code",
};

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event: InputEvent, ctx): Promise<InputEventResult> => {
		const { target, type } = classifyTask(event.text, (event.images?.length ?? 0) > 0);
		const currentModel = ctx.model;

		if (currentModel && currentModel.id === target.id && currentModel.provider === target.provider) {
			return { action: "continue" };
		}

		const allModels = ctx.modelRegistry.getAvailable();
		const targetModel = allModels.find((m) => m.id === target.id && m.provider === target.provider);

		if (targetModel) {
			await pi.setModel(targetModel);
			ctx.ui.notify(`model-router → ${targetModel.name} (${TASK_LABEL[type]})`, "info");
		}

		return { action: "continue" };
	});
}
