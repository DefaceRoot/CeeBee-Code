export type Role = "default" | "plan" | "orchestrator";

export interface OrchestratorConfig {
  defaultRole: Role;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultRole: "default",
};

export const PLANS_DIR = ".pi/plans";

export const ROLE_LABELS: Record<Role, string> = {
  default: "Default",
  plan: "Plan",
  orchestrator: "Orchestrator",
};

export const ROLE_ICONS: Record<Role, string> = {
  default: "○",
  plan: "◈",
  orchestrator: "◉",
};
