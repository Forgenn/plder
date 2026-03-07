/**
 * Disable Resistance Extension
 * Overrides and disables the resistance plugin from shitty-extensions
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Override the resistance widget on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      // Clear any resistance widget that might have been set
      ctx.ui.setWidget("resistance", undefined);
    }
  });

  // Monitor for resistance widget being set and immediately clear it
  let checkInterval: NodeJS.Timeout;
  
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      // Periodically clear the resistance widget if it gets set
      checkInterval = setInterval(() => {
        ctx.ui.setWidget("resistance", undefined);
      }, 100);
    }
  });

  // Clean up on shutdown
  pi.on("session_shutdown", async () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
  });

  // Provide a command to manually disable if needed
  pi.registerCommand("disable-resistance", {
    description: "Force disable the resistance message",
    handler: async (_args, ctx) => {
      ctx.ui.setWidget("resistance", undefined);
      ctx.ui.notify("Resistance message disabled", "success");
    },
  });
}