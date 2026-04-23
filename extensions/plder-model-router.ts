import type { ExtensionAPI, InputEvent, InputEventResult } from "@mariozechner/pi-coding-agent";

/**
 * Smart model routing by task type.
 *
 * Primary (Anthropic), fallback to tier-matched GLM when PI_ANTHROPIC_UNAVAILABLE is set:
 * - Exploration/simple questions  -> Haiku      -> GLM-4.7-Flash (free)
 * - Code generation/editing       -> Sonnet     -> GLM-4.7       (coding-optimized)
 * - Complex reasoning/debug       -> Opus       -> GLM-5         (flagship)
 * - Vision tasks (images)         -> GLM-5V-Turbo (always, Anthropic has no vision here)
 */

interface ModelTarget {
	provider: string;
	id: string;
}

// Anthropic primaries
const HAIKU: ModelTarget    = { provider: "anthropic", id: "claude-haiku-4-5-20251001" };
const SONNET: ModelTarget   = { provider: "anthropic", id: "claude-sonnet-4-6" };
const OPUS: ModelTarget     = { provider: "anthropic", id: "claude-opus-4-6" };

// GLM tier-matched fallbacks
const GLM_FLASH: ModelTarget  = { provider: "zai", id: "glm-4.7-flash" };
const GLM_CODE: ModelTarget   = { provider: "zai", id: "glm-4.7" };
const GLM_REASON: ModelTarget = { provider: "zai", id: "glm-5" };
const GLM_VISION: ModelTarget = { provider: "zai", id: "glm-5v-turbo" };

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

function classifyTask(text: string, hasImages: boolean): { primary: ModelTarget; fallback: ModelTarget; type: TaskType } {
	if (hasImages)                                              return { primary: GLM_VISION,  fallback: GLM_VISION, type: "vision" };
	if (REASONING_PATTERNS.some((p) => p.test(text)))          return { primary: OPUS,        fallback: GLM_REASON, type: "reasoning" };
	if (EXPLORATION_PATTERNS.some((p) => p.test(text)))        return { primary: HAIKU,       fallback: GLM_FLASH,  type: "exploration" };
	return                                                            { primary: SONNET,       fallback: GLM_CODE,   type: "code" };
}

const TASK_LABEL: Record<TaskType, string> = {
	vision:      "vision",
	reasoning:   "reasoning",
	exploration: "explore",
	code:        "code",
};

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event: InputEvent, ctx): Promise<InputEventResult> => {
		const { primary, fallback, type } = classifyTask(event.text, (event.images?.length ?? 0) > 0);

		const anthropicUnavailable = process.env.PI_ANTHROPIC_UNAVAILABLE === "1";
		const target = (anthropicUnavailable && primary.provider === "anthropic") ? fallback : primary;

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
