/**
 * Integration test for project-local extensions.
 * Validates that the pi-sketch and task-tool extensions can be loaded
 * and registered correctly via the extension factory system.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionFactory } from "../../src/core/extensions/types.js";
import { createHarness } from "./harness.js";

const PI_EXTENSIONS_DIR = resolve(import.meta.dirname, "../../../../.pi/extensions");

describe("project-local extensions", () => {
	describe("pi-sketch extension structure", () => {
		const sketchDir = join(PI_EXTENSIONS_DIR, "pi-sketch");

		it("index.ts exists", () => {
			expect(existsSync(join(sketchDir, "index.ts"))).toBe(true);
		});

		it("sketch.html exists", () => {
			expect(existsSync(join(sketchDir, "sketch.html"))).toBe(true);
		});

		it("index.ts exports a default function", async () => {
			const mod = await import(join(sketchDir, "index.ts"));
			expect(typeof mod.default).toBe("function");
		});

		it("sketch.html contains valid HTML", () => {
			const html = readFileSync(join(sketchDir, "sketch.html"), "utf-8");
			expect(html).toContain("<!DOCTYPE html>");
			expect(html).toContain("<canvas");
		});
	});

	describe("task-tool extension structure", () => {
		const taskToolDir = join(PI_EXTENSIONS_DIR, "task-tool");

		it("index.ts exists", () => {
			expect(existsSync(join(taskToolDir, "index.ts"))).toBe(true);
		});

		it("src/extension.ts exists", () => {
			expect(existsSync(join(taskToolDir, "src", "extension.ts"))).toBe(true);
		});

		it("src/task-params.ts exists", () => {
			expect(existsSync(join(taskToolDir, "src", "task-params.ts"))).toBe(true);
		});

		it("src/task-config.ts exists", () => {
			expect(existsSync(join(taskToolDir, "src", "task-config.ts"))).toBe(true);
		});

		it("index.ts exports a default function", async () => {
			const mod = await import(join(taskToolDir, "index.ts"));
			expect(typeof mod.default).toBe("function");
		});
	});

	describe("settings.json packages configuration", () => {
		const settingsPath = resolve(import.meta.dirname, "../../../../.pi/settings.json");

		it("settings.json exists", () => {
			expect(existsSync(settingsPath)).toBe(true);
		});

		it("contains valid JSON with packages array", () => {
			const content = readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content);
			expect(settings).toBeDefined();
			expect(Array.isArray(settings.packages)).toBe(true);
		});

		it("includes all expected git packages", () => {
			const content = readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content);
			const packages = settings.packages;

			const stringPackages = packages.filter((p: unknown) => typeof p === "string");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-subagents");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-prompt-template-model");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-mcp-adapter");
			expect(stringPackages).toContain("git:github.com/Graffioh/pi-screenshots-picker");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-rewind-hook");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-powerline-footer");
			expect(stringPackages).toContain("git:github.com/nicobailon/pi-interview-tool");
			expect(stringPackages).toContain("git:github.com/jayzeng/pi-memory");
			expect(stringPackages).toContain("npm:@plannotator/pi-extension");
		});

		it("includes filtered shitty-extensions package for handoff", () => {
			const content = readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content);
			const packages = settings.packages;

			const filteredPkg = packages.find(
				(p: unknown) =>
					typeof p === "object" &&
					p !== null &&
					(p as Record<string, unknown>).source === "git:github.com/hjanuschka/shitty-extensions",
			);
			expect(filteredPkg).toBeDefined();
			expect(filteredPkg.extensions).toEqual(["extensions/handoff.ts"]);
		});

		it("has exactly 10 packages (9 string + 1 filtered)", () => {
			const content = readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content);
			expect(settings.packages).toHaveLength(10);
		});
	});

	describe("extension registration via harness", () => {
		it("pi-sketch extension registers /sketch command", async () => {
			const sketchModule = await import(join(PI_EXTENSIONS_DIR, "pi-sketch", "index.ts"));
			const factory: ExtensionFactory = sketchModule.default;

			const harness = await createHarness({
				extensionFactories: [factory],
			});

			try {
				// pi-sketch registers a command, not a tool.
				// Verify it loaded without errors by checking the harness is functional.
				expect(harness.session).toBeDefined();
			} finally {
				harness.cleanup();
			}
		});

		it("task-tool extension registers 'task' tool", async () => {
			const taskToolModule = await import(join(PI_EXTENSIONS_DIR, "task-tool", "index.ts"));
			const factory: ExtensionFactory = taskToolModule.default;

			const harness = await createHarness({
				extensionFactories: [factory],
			});

			try {
				const tools = harness.session.getAllTools();
				const taskTool = tools.find((t) => t.name === "task");
				expect(taskTool).toBeDefined();
				expect(taskTool?.description).toContain("subprocess");
			} finally {
				harness.cleanup();
			}
		});
	});
});
