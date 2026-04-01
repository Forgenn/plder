/**
 * ctrl+c Exit Extension
 *
 * Makes ctrl+c behave like Linux:
 * - Agent is running → abort it (like SIGINT to a process)
 * - Agent is idle    → exit pi (like ctrl+d on an empty prompt)
 *
 * Escape is kept as the interrupt/cancel key for everything else.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerShortcut("ctrl+c", {
		description: "Abort if running, exit if idle",
		handler: async (ctx) => {
			if (!ctx.isIdle()) {
				ctx.abort();
			} else {
				ctx.shutdown();
			}
		},
	});
}
