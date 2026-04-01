import * as fs from "node:fs";
import * as path from "node:path";
import { DEFAULT_CONFIG, type OrchestratorConfig, type Role } from "./types.js";

export function loadRoleConfig(cwd: string): OrchestratorConfig {
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const saved = raw?.orchestratorSystem?.defaultRole;
    if (isValidRole(saved)) {
      return { defaultRole: saved };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function persistRoleSetting(cwd: string, role: Role): boolean {
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  try {
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
    if (!settings.orchestratorSystem || typeof settings.orchestratorSystem !== "object") {
      settings.orchestratorSystem = {};
    }
    (settings.orchestratorSystem as Record<string, unknown>).defaultRole = role;
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && ["default", "plan", "orchestrator"].includes(value);
}
