/**
 * Auth Failover Extension
 *
 * OAuth primary, API key fallback, GLM emergency.
 * On Anthropic auth or quota failure, re-registers provider with API key.
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
	const msg = String(error).toLowerCase();
	return (
		msg.includes("401") ||
		msg.includes("403") ||
		msg.includes("unauthorized") ||
		msg.includes("forbidden") ||
		msg.includes("credential") ||
		msg.includes("authentication")
	);
}

function isQuotaError(error: unknown): boolean {
	const msg = String(error).toLowerCase();
	return (
		msg.includes("out of extra usage") ||
		msg.includes("api usage limit exceeded") ||
		msg.includes("quota exceeded")
	);
}

function isRateLimitError(error: unknown): boolean {
	const msg = String(error);
	return (
		msg.includes("status 429") || msg.includes("status: 429") ||
		msg.includes("status 529") || msg.includes("status: 529") ||
		msg.includes("rate limit") || msg.includes("rate_limit") ||
		msg.includes("overloaded")
	);
}

export default function (pi: ExtensionAPI) {
	let authMethod: AuthMethod = "oauth";
	let failoverAttempted = false;

	pi.on("session_start", async (_event, ctx) => {
		// Reset per-session state so quota recovery between sessions works
		failoverAttempted = false;
		delete process.env.PI_ANTHROPIC_UNAVAILABLE;

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
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!event.error || failoverAttempted) return;

		const isQuota = isQuotaError(event.error);
		const isRateLimit = isRateLimitError(event.error);
		// Pure auth error: true only when not also a quota error, to avoid
		// routing a quota failure to the API-key path (same account, same quota wall)
		const isAuth = !isQuota && isAuthError(event.error);

		if (!isAuth && !isQuota && !isRateLimit) return;

		failoverAttempted = true;

		// For pure auth errors, try API key fallback before GLM
		if (isAuth && authMethod === "oauth") {
			const apiKey = getApiKey();
			if (apiKey) {
				authMethod = "apikey";
				pi.registerProvider("anthropic", { apiKey });
				ctx.ui.setStatus("auth", ctx.ui.theme.fg("warning", "⚠ API key (OAuth failed)"));
				ctx.ui.notify("OAuth failed, switched to API key", "warning");
				return;
			}
		}

		// Quota, rate-limit, or auth with no API key → GLM
		if (authMethod !== "glm" && hasGlm()) {
			authMethod = "glm";
			process.env.PI_ANTHROPIC_UNAVAILABLE = "1";
			const glmModel = ctx.modelRegistry.find("zai", "glm-5");
			if (glmModel) {
				await pi.setModel(glmModel);
				const label = isQuota ? "⚠ GLM fallback (quota exceeded)" : "⚠ GLM fallback (Claude down)";
				const msg = isQuota ? "Claude quota exceeded, switched to GLM" : "Claude unavailable, switched to GLM";
				ctx.ui.setStatus("auth", ctx.ui.theme.fg("error", label));
				ctx.ui.notify(msg, "warning");
				return;
			}
		}

		ctx.ui.notify(
			"No fallback available. Set ANTHROPIC_API_KEY or ZAI_API_KEY.",
			"error",
		);
	});
}
