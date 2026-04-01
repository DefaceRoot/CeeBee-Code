import type { Role, OrchestratorConfig } from "../types.js";

export interface RoleManager {
  getRole(): Role;
  setRole(role: Role): void;
  cycleRole(): Role;
}

export const ROLE_ORDER: Role[] = ["default", "plan", "orchestrator"];

export function createRoleManager(config: OrchestratorConfig): RoleManager {
  let currentRole: Role = config.defaultRole;

  return {
    getRole() {
      return currentRole;
    },

    setRole(role: Role) {
      currentRole = role;
    },

    cycleRole(): Role {
      const currentIndex = ROLE_ORDER.indexOf(currentRole);
      const nextIndex = (currentIndex + 1) % ROLE_ORDER.length;
      currentRole = ROLE_ORDER[nextIndex];
      return currentRole;
    },
  };
}
