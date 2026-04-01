/**
 * Running Shells Indicator
 *
 * Shows a widget above the editor when bash tool calls are executing,
 * displaying the count and a preview of each running command.
 * Pressing ↓ (when idle) shows an overlay to inspect running commands.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

interface RunningShell {
	toolCallId: string;
	command: string;
	startedAt: number;
}

const WIDGET_ID = "running-shells";

function truncateCommand(cmd: string, max = 60): string {
	const single = cmd.replace(/\s+/g, " ").trim();
	return single.length > max ? single.slice(0, max - 1) + "…" : single;
}

function updateWidget(ctx: ExtensionContext, running: Map<string, RunningShell>) {
	if (!ctx.hasUI) return;

	if (running.size === 0) {
		ctx.ui.setWidget(WIDGET_ID, undefined);
		return;
	}

	const theme = ctx.ui.theme;
	const count = running.size;
	const label = count === 1 ? "1 shell running" : `${count} shells running`;
	const shells = [...running.values()];

	ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
		const lines = shells.map((s, i) => {
			const idx = theme.fg("dim", `[${i + 1}]`);
			const cmd = theme.fg("muted", truncateCommand(s.command));
			const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
			const time = theme.fg("dim", `${elapsed}s`);
			return `  ${idx} ${cmd} ${time}`;
		});

		return {
			render: () => [
				theme.fg("warning", `⏵⏵ ${label}`) + theme.fg("dim", "  ↓ to inspect"),
				...lines,
			],
			invalidate: () => {},
		};
	});
}

export default function (pi: ExtensionAPI) {
	const running = new Map<string, RunningShell>();

	pi.on("tool_execution_start", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		running.set(event.toolCallId, {
			toolCallId: event.toolCallId,
			command: (event.args as any)?.command ?? "(unknown)",
			startedAt: Date.now(),
		});
		updateWidget(ctx, running);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		running.delete(event.toolCallId);
		updateWidget(ctx, running);
	});

	// Clear on new session
	pi.on("session_switch", async (_event, ctx) => {
		running.clear();
		updateWidget(ctx, running);
	});

	// ↓ key — show overlay with full command details
	pi.registerShortcut("down", {
		description: "Inspect running shells",
		handler: async (ctx) => {
			if (!ctx.hasUI || running.size === 0) return;

			const shells = [...running.values()];
			const theme = ctx.ui.theme;

			await ctx.ui.custom((tui, theme, _kb, done) => {
				const lines: string[] = [
					theme.fg("accent", theme.bold(`Running shells (${shells.length})`)),
					"",
					...shells.flatMap((s, i) => {
						const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
						return [
							theme.fg("warning", `[${i + 1}]`) + theme.fg("dim", ` started ${elapsed}s ago`),
							theme.fg("muted", s.command),
							"",
						];
					}),
					theme.fg("dim", "esc / any key to close"),
				];

				return {
					render: (width: number) => lines.map((l) => l.slice(0, width)),
					invalidate: () => {},
					handleInput: (_data: string) => done(undefined),
				};
			}, { overlay: true });
		},
	});
}
