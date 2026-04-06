import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createRoleManager } from "./src/roles/role-manager.js";
import { registerRoleSwitcher } from "./src/roles/role-switcher.js";
import { buildRoleSystemPrompt } from "./src/roles/role-prompts.js";
import { loadRoleConfig } from "./src/config.js";
import { PLANS_DIR, ROLE_ICONS, ROLE_LABELS, type Role } from "./src/types.js";

const ORCHESTRATOR_MIN_SUBAGENT_MAX_DEPTH = 3;

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
  const originalSubagentMaxDepth = process.env.PI_SUBAGENT_MAX_DEPTH;
  let allToolNames: string[] = [];

  function isSubagentSession(): boolean {
    const depth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
    return Number.isFinite(depth) && depth > 0;
  }

  function getRuntimeRole(): Role {
    return isSubagentSession() ? "default" : roleManager.getRole();
  }

  function applyRoleRuntimeState(role: Role): void {
    const configuredDepth = Number(process.env.PI_SUBAGENT_MAX_DEPTH ?? originalSubagentMaxDepth ?? "");
    if (role === "orchestrator") {
      if (!Number.isFinite(configuredDepth) || configuredDepth < ORCHESTRATOR_MIN_SUBAGENT_MAX_DEPTH) {
        process.env.PI_SUBAGENT_MAX_DEPTH = String(ORCHESTRATOR_MIN_SUBAGENT_MAX_DEPTH);
      }
      return;
    }

    if (originalSubagentMaxDepth === undefined) {
      delete process.env.PI_SUBAGENT_MAX_DEPTH;
      return;
    }

    process.env.PI_SUBAGENT_MAX_DEPTH = originalSubagentMaxDepth;
  }

  // --- Role Switcher (ALT+A keybinding + /role command + status line) ---
  registerRoleSwitcher(pi, roleManager, config, applyRoleRuntimeState);

  // --- Capture full tool set on startup for Default role restore ---
  pi.on("session_start", async (_event, ctx) => {
    allToolNames = pi.getAllTools().map((t) => t.name);
    const subagentSession = isSubagentSession();
    const role = getRuntimeRole();

    if (ctx.hasUI) {
      ctx.ui.setStatus("role", formatRoleStatus(role));
    }

    applyRoleRuntimeState(role);

    // Subagent sessions should keep the delegated agent's own tool configuration.
    // They intentionally do not inherit the parent role's tool restrictions.
    if (subagentSession) {
      return;
    }

    const tools = getToolsForRole(role, allToolNames);
    if (tools) {
      pi.setActiveTools(tools);
    }
  });

  // --- System Prompt Injection per Role ---
  pi.on("before_agent_start", async (event, _ctx) => {
    const role = getRuntimeRole();

    // Default role: no prompt changes
    if (role === "default") return;

    // Plan and Orchestrator roles: replace system prompt
    const systemPrompt = buildRoleSystemPrompt(role, event.systemPrompt);
    return { systemPrompt };
  });

  // --- Plan Mode: Restrict writes to .pi/plans/ ---
  pi.on("tool_call", async (event, ctx) => {
    const role = getRuntimeRole();
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
