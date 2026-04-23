/**
 * Running Shells Indicator
 *
 * Tracks two kinds of processes:
 *  - Blocking: bash tool calls currently executing (agent is waiting)
 *  - Background: processes explicitly started via run_background tool
 *
 * Shows a widget above the editor. ↓ opens an inspect/kill overlay.
 */

import { spawn } from "node:child_process";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { truncateToWidth } from "@mariozechner/pi-tui";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlockingShell {
	toolCallId: string;
	command: string;
	startedAt: number;
}

interface BackgroundProcess {
	pid: number;
	label: string;
	command: string;
	startedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(startedAt: number): string {
	const s = Math.floor((Date.now() - startedAt) / 1000);
	if (s < 60) return `${s}s`;
	return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function truncCmd(cmd: string, max = 55): string {
	const single = cmd.replace(/\s+/g, " ").trim();
	return single.length > max ? single.slice(0, max - 1) + "…" : single;
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const blocking = new Map<string, BlockingShell>();
	const background = new Map<number, BackgroundProcess>();
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let lastCtx: ExtensionContext | null = null;

	// ── Widget ──────────────────────────────────────────────────────────────

	function updateWidget(ctx: ExtensionContext) {
		lastCtx = ctx;
		if (!ctx.hasUI) return;

		const hasAny = blocking.size > 0 || background.size > 0;
		if (!hasAny) {
			ctx.ui.setWidget("running-shells", undefined);
			return;
		}

		ctx.ui.setWidget("running-shells", (_tui, theme) => {
			const lines: string[] = [];

			if (blocking.size > 0) {
				const label = blocking.size === 1 ? "1 shell running" : `${blocking.size} shells running`;
				lines.push(theme.fg("warning", `⏵⏵ ${label}`));
				for (const s of blocking.values()) {
					lines.push(`  ${theme.fg("dim", truncCmd(s.command))}  ${theme.fg("dim", elapsed(s.startedAt))}`);
				}
			}

			if (background.size > 0) {
				const label = background.size === 1 ? "1 background" : `${background.size} background`;
				lines.push(theme.fg("accent", `◉ ${label}`));
				for (const p of background.values()) {
					lines.push(
						`  ${theme.fg("muted", p.label)}  ${theme.fg("dim", truncCmd(p.command))}  ${theme.fg("dim", elapsed(p.startedAt))}`,
					);
				}
			}

			lines.push(theme.fg("dim", "  ↓ to manage"));

			return {
				render: (width: number) => lines.map((l) => truncateToWidth(l, width)),
				invalidate: () => {},
			};
		});
	}

	// ── Background polling ──────────────────────────────────────────────────

	function startPolling(ctx: ExtensionContext) {
		if (pollInterval) return;
		pollInterval = setInterval(() => {
			let changed = false;
			for (const [pid] of background) {
				if (!isAlive(pid)) {
					background.delete(pid);
					changed = true;
				}
			}
			const ctx = lastCtx;
			if (changed && ctx) updateWidget(ctx);
			if (background.size === 0) {
				clearInterval(pollInterval!);
				pollInterval = null;
			}
		}, 5000);
	}

	// ── Blocking: track tool execution ──────────────────────────────────────

	pi.on("tool_execution_start", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		blocking.set(event.toolCallId, {
			toolCallId: event.toolCallId,
			command: (event.args as any)?.command ?? "(unknown)",
			startedAt: Date.now(),
		});
		updateWidget(ctx);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		blocking.delete(event.toolCallId);
		updateWidget(ctx);
	});

	// ── Background: run_background tool ─────────────────────────────────────

	pi.registerTool({
		name: "run_background",
		label: "Run Background",
		description:
			"Spawn a long-running process that keeps running after this turn (dev servers, watchers, build daemons). Returns immediately with the PID.",
		promptGuidelines: [
			"Use run_background instead of bash for: dev servers, file watchers, `npm run dev`, port-forwards, any process that should stay alive after the current turn.",
			"Use regular bash for commands that produce output you need to read (builds, tests, scripts).",
			"Always provide a short human-friendly label (e.g. 'dev server', 'file watcher', 'port-forward').",
		],
		parameters: Type.Object({
			command: Type.String({ description: "Shell command to run" }),
			label: Type.String({ description: "Short human-friendly name, e.g. 'dev server'" }),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const child = spawn(params.command, [], {
				shell: true,
				detached: true,
				stdio: "ignore",
			});
			child.unref();

			const pid = child.pid;
			if (!pid) throw new Error("Failed to spawn process — no PID returned");

			background.set(pid, {
				pid,
				label: params.label,
				command: params.command,
				startedAt: Date.now(),
			});

			startPolling(ctx);
			updateWidget(ctx);

			return {
				content: [{ type: "text", text: `Started '${params.label}' (PID ${pid})\nCommand: ${params.command}` }],
				details: { pid, label: params.label, command: params.command },
			};
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("run_background ")) +
					theme.fg("accent", args.label ?? "") +
					theme.fg("dim", `  ${truncCmd(args.command ?? "", 40)}`),
				0,
				0,
			);
		},

		renderResult(result, _opts, theme) {
			const d = result.details as { pid: number; label: string } | undefined;
			if (!d) return new Text(theme.fg("error", "Failed to start"), 0, 0);
			return new Text(
				theme.fg("accent", "◉ ") + theme.fg("muted", d.label) + theme.fg("dim", `  PID ${d.pid}`),
				0,
				0,
			);
		},
	});

	// ── Background: kill_background tool ────────────────────────────────────

	pi.registerTool({
		name: "kill_background",
		label: "Kill Background",
		description: "Kill a background process started with run_background, by PID or label.",
		parameters: Type.Object({
			pid: Type.Optional(Type.Number({ description: "PID to kill" })),
			label: Type.Optional(Type.String({ description: "Label to kill (kills first match)" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			let target: BackgroundProcess | undefined;

			if (params.pid) {
				target = background.get(params.pid);
			} else if (params.label) {
				target = [...background.values()].find((p) =>
					p.label.toLowerCase().includes(params.label!.toLowerCase()),
				);
			}

			if (!target) {
				throw new Error(`No background process found matching ${params.pid ?? params.label}`);
			}

			try {
				process.kill(target.pid, "SIGTERM");
			} catch {
				// Already dead — clean up anyway
			}
			background.delete(target.pid);
			updateWidget(ctx);

			return {
				content: [{ type: "text", text: `Killed '${target.label}' (PID ${target.pid})` }],
				details: { pid: target.pid, label: target.label },
			};
		},

		renderCall(args, theme) {
			const id = args.pid ? `PID ${args.pid}` : args.label ?? "?";
			return new Text(theme.fg("toolTitle", theme.bold("kill_background ")) + theme.fg("warning", id), 0, 0);
		},

		renderResult(result, _opts, theme) {
			const d = result.details as { label: string; pid: number } | undefined;
			return new Text(
				theme.fg("success", "✓ killed ") + theme.fg("muted", d?.label ?? "") + theme.fg("dim", ` PID ${d?.pid}`),
				0,
				0,
			);
		},
	});

	// ── ↓ key: inspect / kill overlay ───────────────────────────────────────

	pi.registerShortcut("down", {
		description: "Inspect running and background shells",
		handler: async (ctx) => {
			if (!ctx.hasUI || (blocking.size === 0 && background.size === 0)) return;

			await ctx.ui.custom(
				(tui, theme, _kb, done) => {
					const bgList = [...background.values()];

					function buildLines(width: number): string[] {
						const lines: string[] = [];

						lines.push(theme.fg("accent", theme.bold(" Running Processes ")));
						lines.push(theme.fg("dim", "─".repeat(width)));

						if (blocking.size > 0) {
							lines.push("");
							lines.push(theme.fg("warning", "Blocking"));
							for (const s of blocking.values()) {
								lines.push(`  ${theme.fg("muted", truncCmd(s.command, width - 4))}  ${theme.fg("dim", elapsed(s.startedAt))}`);
							}
						}

						if (bgList.length > 0) {
							lines.push("");
							lines.push(theme.fg("accent", "Background"));
							bgList.forEach((p, i) => {
								lines.push(
									`  ${theme.fg("accent", `[${i + 1}]`)} ${theme.fg("muted", p.label)}  ${theme.fg("dim", elapsed(p.startedAt))}`,
								);
								lines.push(`      ${theme.fg("dim", truncCmd(p.command, width - 6))}`);
							});
							lines.push("");
							lines.push(theme.fg("dim", "  press 1–9 to kill a background process"));
						}

						lines.push("");
						lines.push(theme.fg("dim", "  esc / any key to close"));
						return lines;
					}

					let cachedWidth: number | undefined;
					let cachedLines: string[] | undefined;

					return {
						render(width: number): string[] {
							if (cachedLines && cachedWidth === width) return cachedLines;
							cachedLines = buildLines(width).map((l) => truncateToWidth(l, width));
							cachedWidth = width;
							return cachedLines;
						},
						invalidate() {
							cachedWidth = undefined;
							cachedLines = undefined;
						},
						handleInput(data: string) {
							const n = parseInt(data, 10);
							if (!isNaN(n) && n >= 1 && n <= bgList.length) {
								const target = bgList[n - 1];
								try { process.kill(target.pid, "SIGTERM"); } catch {}
								background.delete(target.pid);
								if (lastCtx) updateWidget(lastCtx);
								done(undefined);
							} else {
								done(undefined);
							}
						},
					};
				},
				{ overlay: true },
			);
		},
	});

	// ── Cleanup ──────────────────────────────────────────────────────────────

	pi.on("session_switch", async (_event, ctx) => {
		blocking.clear();
		// Keep background processes alive across sessions — they're OS processes
		updateWidget(ctx);
	});

	pi.on("session_shutdown", async () => {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	});
}
