import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RoleManager } from "./role-manager.js";
import { persistRoleSetting } from "../config.js";
import { ROLE_LABELS, ROLE_ICONS, type OrchestratorConfig, type Role } from "../types.js";

const ROLES: Role[] = ["default", "plan", "orchestrator"];

function formatRoleStatus(role: Role): string {
  return `${ROLE_ICONS[role]} ${ROLE_LABELS[role]}`;
}

export function registerRoleSwitcher(
  pi: ExtensionAPI,
  roleManager: RoleManager,
  _config: OrchestratorConfig,
): void {
  /** Apply tool restrictions for the given role. */
  function applyToolRestriction(role: Role): void {
    const allTools = pi.getAllTools().map((t) => t.name);

    const memoryTools = allTools.filter((t) =>
      ["memory_write", "memory_read", "scratchpad", "memory_search"].includes(t),
    );

    if (role === "default") {
      const excludedTools = [
        "memory_write",
        "memory_read",
        "scratchpad",
        "memory_search",
        "subagent",
        "subagent_status",
      ];
      pi.setActiveTools(allTools.filter((t) => !excludedTools.includes(t)));
    } else if (role === "orchestrator") {
      pi.setActiveTools(["read", "subagent", "subagent_status", ...memoryTools]);
    } else if (role === "plan") {
      pi.setActiveTools([
        "read", "bash", "find", "grep", "ls", "write", "edit",
        "subagent", "subagent_status", ...memoryTools,
      ]);
    }
  }

  const descriptions: Record<Role, string> = {
    default: "Vanilla pi — no memory injection, no subagent delegation",
    plan: "Interactive planning — research, explore, write plans",
    orchestrator: "Chain delegation — Planning → Engineering → Validation → Docs",
  };

  // --- ALT+A shortcut for role switching ---
  pi.registerShortcut("alt+a", {
    description: "Switch agent role (Default / Plan / Orchestrator)",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const currentRole = roleManager.getRole();

      const selected = await ctx.ui.select(
        `Role: ${formatRoleStatus(currentRole)}`,
        ROLES.map((r) => {
          const marker = r === currentRole ? " ●" : "";
          return `${ROLE_ICONS[r]} ${ROLE_LABELS[r]}${marker}`;
        }),
      );

      if (!selected) return;

      const selectedRole = ROLES.find((r) => selected.includes(ROLE_LABELS[r]));
      if (!selectedRole || selectedRole === currentRole) return;

      roleManager.setRole(selectedRole);
      applyToolRestriction(selectedRole);
      ctx.ui.setStatus("role", formatRoleStatus(selectedRole));
      persistRoleSetting(ctx.cwd, selectedRole);
      ctx.ui.notify(
        `Role: ${formatRoleStatus(selectedRole)}\n${descriptions[selectedRole]}`,
        "info",
      );
    },
  });

  // --- /role command ---
  pi.registerCommand("role", {
    description: "Switch agent role. Usage: /role [default|plan|orchestrator]",
    handler: async (args, ctx) => {
      const trimmed = args?.trim().toLowerCase();

      if (!trimmed) {
        const current = roleManager.getRole();
        ctx.ui.notify(`Current role: ${formatRoleStatus(current)}`, "info");
        return;
      }

      if (!ROLES.includes(trimmed as Role)) {
        ctx.ui.notify(`Invalid role: ${trimmed}. Valid: ${ROLES.join(", ")}`, "error");
        return;
      }

      const role = trimmed as Role;
      roleManager.setRole(role);
      applyToolRestriction(role);
      ctx.ui.setStatus("role", formatRoleStatus(role));
      persistRoleSetting(ctx.cwd, role);
      ctx.ui.notify(`Role: ${formatRoleStatus(role)}\n${descriptions[role]}`, "info");
    },
  });
}
