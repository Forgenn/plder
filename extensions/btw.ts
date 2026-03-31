/**
 * /btw Extension
 *
 * Ask a quick side question without interrupting the main conversation.
 *
 * Mechanics (mirroring Claude Code's implementation):
 * - Fires a separate API call using the full conversation context (prompt cache reuse)
 * - No tools — answer from what's already in the context window only
 * - Response is ephemeral — never added to conversation history
 * - Works while the agent is mid-turn (non-blocking)
 *
 * Usage:
 *   /btw what does the --force flag do?
 *   /btw what's the difference between Promise.all and Promise.allSettled?
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Mirrors Claude Code's exact system-reminder content
const SIDE_QUESTION_REMINDER = `

<system-reminder>
This is a side question from the user. You must answer this question directly in a single response.

IMPORTANT CONTEXT:
- You are a separate, lightweight instance spawned to answer this one question
- The main conversation continues uninterrupted in the background
- You share the conversation context but are a completely separate instance
- Do NOT reference being interrupted or what you were "previously doing" — that framing is incorrect

CRITICAL CONSTRAINTS:
- You have NO tools available — you cannot read files, run commands, search, or take any actions
- This is a one-off response — there will be no follow-up turns
- You can ONLY provide information based on what you already know from the conversation context
- NEVER say things like "Let me try...", "I'll now...", "Let me check...", or promise to take any action
- If you don't know the answer, say so — do not offer to look it up or investigate

Simply answer the question with the information you have.
</system-reminder>`;

interface AnthropicPayload {
	model: string;
	system?: any;
	messages: Array<{ role: string; content: any }>;
	tools?: any[];
	tool_choice?: any;
	max_tokens?: number;
	[key: string]: any;
}

export default function (pi: ExtensionAPI) {
	// Cache the last provider-ready Anthropic payload (full context, right format)
	let cachedPayload: AnthropicPayload | null = null;
	let btwActive = false;

	// Capture the API payload as-is (Anthropic format, already has cache_control etc.)
	pi.on("before_provider_request", (event) => {
		// Don't overwrite cache with our own btw call (shouldn't happen, but guard anyway)
		if (!btwActive) {
			cachedPayload = event.payload as AnthropicPayload;
		}
	});

	// Auto-dismiss widget when a new real agent turn starts
	pi.on("agent_start", async (_event, ctx) => {
		ctx.ui.setWidget("btw", undefined);
	});

	pi.registerCommand("btw", {
		description: "Ask a quick side question without interrupting the main conversation",
		handler: async (args, ctx) => {
			const question = args.trim();

			if (!question) {
				ctx.ui.notify("Usage: /btw <your question>", "info");
				return;
			}

			const apiKey = process.env.ANTHROPIC_API_KEY;
			if (!apiKey) {
				ctx.ui.notify("/btw: ANTHROPIC_API_KEY not set", "error");
				return;
			}

			// Build the btw payload:
			// - Reuse the full cached message history for prompt cache hits
			// - Append the question (with system-reminder) as the last user message
			// - Strip tools entirely
			const baseMessages: AnthropicPayload["messages"] = cachedPayload?.messages ?? [];
			const model = cachedPayload?.model ?? ctx.model?.id ?? "claude-opus-4-6";

			// If last message is an incomplete/in-progress assistant message, drop it
			// (mirrors Claude Code's F9z cleanup)
			const cleanMessages = [...baseMessages];
			const last = cleanMessages.at(-1);
			if (last?.role === "assistant" && !last.content) {
				cleanMessages.pop();
			}

			const payload: Omit<AnthropicPayload, "tools" | "tool_choice"> = {
				model,
				max_tokens: 1024,
				...(cachedPayload?.system ? { system: cachedPayload.system } : {}),
				messages: [
					...cleanMessages,
					{ role: "user", content: question + SIDE_QUESTION_REMINDER },
				],
				// No tools — intentionally omitted
			};

			ctx.ui.setWidget("btw", [
				"  ⚡ /btw  " + question,
				"  Answering…",
			]);

			btwActive = true;

			try {
				const res = await fetch("https://api.anthropic.com/v1/messages", {
					method: "POST",
					headers: {
						"x-api-key": apiKey,
						"anthropic-version": "2023-06-01",
						"content-type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!res.ok) {
					const errText = await res.text().catch(() => res.statusText);
					ctx.ui.setWidget("btw", [
						"  ⚡ /btw  " + question,
						"  ✗ Error " + res.status + ": " + errText.slice(0, 120),
						"",
						"  (send any message to dismiss)",
					]);
					return;
				}

				const data = (await res.json()) as any;
				const answer: string =
					data.content
						?.filter((b: any) => b.type === "text")
						.map((b: any) => b.text as string)
						.join("") ?? "(no response)";

				const lines = [
					"  ⚡ /btw  " + question,
					"",
					...answer.split("\n").map((l) => "  " + l),
					"",
					"  (send any message to dismiss)",
				];

				ctx.ui.setWidget("btw", lines);
			} catch (err: any) {
				ctx.ui.setWidget("btw", [
					"  ⚡ /btw  " + question,
					"  ✗ " + (err?.message ?? "Request failed"),
					"",
					"  (send any message to dismiss)",
				]);
			} finally {
				btwActive = false;
			}
		},
	});
}
