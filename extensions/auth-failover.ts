/**
 * Auth Failover Extension
 *
 * OAuth primary, API key fallback, GLM emergency.
 * On Anthropic auth failure, re-registers provider with API key.
 * If no API key available, falls back to GLM.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type AuthMethod = "oauth" | "apikey" | "glm";

async function readAuthJson(): Promise<Record<string, unknown> | null> {
	try {
		const path = join(homedir(), ".pi", "agent", "auth.json");
		const content = await readFile(path, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function getApiKey(): string | undefined {
	return process.env.ANTHROPIC_API_KEY;
}

function hasGlm(): boolean {
	return !!process.env.ZAI_API_KEY;
}

function isAuthError(error: unknown): boolean {
	const msg = String(error);
	return (
		msg.includes("401") ||
		msg.includes("403") ||
		msg.includes("unauthorized") ||
		msg.includes("forbidden") ||
		msg.includes("credential") ||
		msg.includes("authentication")
	);
}

export default function (pi: ExtensionAPI) {
	let authMethod: AuthMethod = "oauth";
	let failoverAttempted = false;

	pi.on("session_start", async (_event, ctx) => {
		const authJson = await readAuthJson();
		const hasOAuth = authJson && Object.values(authJson).some(
			(v) => typeof v === "string" && v.includes("sk-ant-oat"),
		);
		const hasApiKey = !!getApiKey();

		if (hasOAuth) {
			authMethod = "oauth";
		} else if (hasApiKey) {
			authMethod = "apikey";
			pi.registerProvider("anthropic", { apiKey: getApiKey()! });
			ctx.ui.notify("No OAuth token found, using API key", "info");
		} else if (hasGlm()) {
			authMethod = "glm";
			ctx.ui.notify("No Anthropic credentials, using GLM", "warning");
		}

		ctx.ui.setStatus(
			"auth",
			ctx.ui.theme.fg("accent", `Auth: ${authMethod}`),
		);
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!event.error || failoverAttempted) return;
		if (!isAuthError(event.error)) return;

		failoverAttempted = true;

		if (authMethod === "oauth") {
			const apiKey = getApiKey();
			if (apiKey) {
				authMethod = "apikey";
				pi.registerProvider("anthropic", { apiKey });
				ctx.ui.setStatus(
					"auth",
					ctx.ui.theme.fg("warning", "Auth: apikey (failover)"),
				);
				ctx.ui.notify("OAuth failed, switched to API key", "warning");
				return;
			}
		}

		if (authMethod !== "glm" && hasGlm()) {
			authMethod = "glm";
			const glmModel = ctx.modelRegistry.find("zai", "glm-4-plus");
			if (glmModel) {
				await pi.setModel(glmModel);
				ctx.ui.setStatus(
					"auth",
					ctx.ui.theme.fg("error", "Auth: glm (failover)"),
				);
				ctx.ui.notify("Claude unavailable, switched to GLM", "warning");
				return;
			}
		}

		ctx.ui.notify(
			"No fallback available. Set ANTHROPIC_API_KEY or ZAI_API_KEY.",
			"error",
		);
	});
}
