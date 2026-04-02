import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createRoleManager } from "./src/roles/role-manager.js";
import { registerRoleSwitcher } from "./src/roles/role-switcher.js";
import { buildRoleSystemPrompt } from "./src/roles/role-prompts.js";
import { loadRoleConfig } from "./src/config.js";
import { PLANS_DIR, ROLE_ICONS, ROLE_LABELS, type Role } from "./src/types.js";

function formatRoleStatus(role: Role): string {
  return `${ROLE_ICONS[role]} ${ROLE_LABELS[role]}`;
}

/** Tool sets per role. Memory tools are included for Plan/Orchestrator if pi-memory is installed. */
function getToolsForRole(role: Role, allToolNames: string[]): string[] | null {
  if (role === "default") {
    return allToolNames.filter((t) =>
      ![
        "memory_write",
        "memory_read",
        "scratchpad",
        "memory_search",
        "subagent",
        "subagent_status",
      ].includes(t),
    );
  }

  const memoryTools = allToolNames.filter((t) =>
    ["memory_write", "memory_read", "scratchpad", "memory_search"].includes(t),
  );

  if (role === "orchestrator") {
    return ["read", "subagent", "subagent_status", ...memoryTools];
  }

  if (role === "plan") {
    return [
      "read", "bash", "find", "grep", "ls", "write", "edit",
      "subagent", "subagent_status", ...memoryTools,
    ];
  }

  return null;
}

export default function orchestratorSystem(pi: ExtensionAPI) {
  const config = loadRoleConfig(process.cwd());
  const roleManager = createRoleManager(config);
  let allToolNames: string[] = [];

  // --- Role Switcher (ALT+A keybinding + /role command + status line) ---
  registerRoleSwitcher(pi, roleManager, config);

  // --- Capture full tool set on startup for Default role restore ---
  pi.on("session_start", async (_event, ctx) => {
    allToolNames = pi.getAllTools().map((t) => t.name);

    if (ctx.hasUI) {
      ctx.ui.setStatus("role", formatRoleStatus(roleManager.getRole()));
    }

    // Apply tool restriction for non-default roles on startup
    const role = roleManager.getRole();
    const tools = getToolsForRole(role, allToolNames);
    if (tools) {
      pi.setActiveTools(tools);
    }
  });

  // --- System Prompt Injection per Role ---
  pi.on("before_agent_start", async (event, _ctx) => {
    const role = roleManager.getRole();

    // Default role: no prompt changes
    if (role === "default") return;

    // Plan and Orchestrator roles: replace system prompt
    const systemPrompt = buildRoleSystemPrompt(role, event.systemPrompt);
    return { systemPrompt };
  });

  // --- Plan Mode: Restrict writes to .pi/plans/ ---
  pi.on("tool_call", async (event, ctx) => {
    const role = roleManager.getRole();
    if (role !== "plan") return;

    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = (event.input as Record<string, unknown>).path;
      if (typeof filePath === "string") {
        const resolved = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(ctx.cwd, filePath);
        const plansDir = path.resolve(ctx.cwd, PLANS_DIR);
        if (!resolved.startsWith(plansDir)) {
          return {
            block: true,
            reason: `Plan mode: writes are restricted to ${PLANS_DIR}/. Cannot write to: ${filePath}`,
          };
        }
      }
    }
  });
}
