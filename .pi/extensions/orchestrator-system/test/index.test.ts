import assert from "node:assert/strict";
import { describe, it } from "node:test";
import orchestratorSystem from "../index.ts";

type SessionStartHandler = (event: { type: "session_start"; reason: string }, ctx: {
	hasUI: boolean;
	cwd: string;
	ui?: {
		setStatus: (key: string, value: string) => void;
	};
}) => Promise<void> | void;

class FakePi {
	public readonly handlers = new Map<string, SessionStartHandler>();
	public readonly activeToolCalls: string[][] = [];

	on(event: string, handler: SessionStartHandler): void {
		if (event === "session_start") {
			this.handlers.set(event, handler);
		}
	}

	registerShortcut(): void {}
	registerCommand(): void {}
	getAllTools(): Array<{ name: string }> {
		return [
			{ name: "read" },
			{ name: "bash" },
			{ name: "write" },
			{ name: "memory_write" },
			{ name: "subagent" },
			{ name: "subagent_status" },
		];
	}
	setActiveTools(toolNames: string[]): void {
		this.activeToolCalls.push(toolNames);
	}
}

describe("orchestrator-system session_start", () => {
	it("does not override tools inside subagent sessions", async () => {
		const previousDepth = process.env.PI_SUBAGENT_DEPTH;
		const previousMaxDepth = process.env.PI_SUBAGENT_MAX_DEPTH;
		process.env.PI_SUBAGENT_DEPTH = "1";
		process.env.PI_SUBAGENT_MAX_DEPTH = "3";

		try {
			const pi = new FakePi();
			orchestratorSystem(pi as never);

			const handler = pi.handlers.get("session_start");
			assert.ok(handler, "session_start handler should be registered");

			await handler?.({ type: "session_start", reason: "startup" }, { hasUI: false, cwd: process.cwd() });

			assert.equal(pi.activeToolCalls.length, 0);
		} finally {
			if (previousDepth === undefined) delete process.env.PI_SUBAGENT_DEPTH;
			else process.env.PI_SUBAGENT_DEPTH = previousDepth;
			if (previousMaxDepth === undefined) delete process.env.PI_SUBAGENT_MAX_DEPTH;
			else process.env.PI_SUBAGENT_MAX_DEPTH = previousMaxDepth;
		}
	});

	it("still restricts tools for top-level default sessions", async () => {
		const previousDepth = process.env.PI_SUBAGENT_DEPTH;
		delete process.env.PI_SUBAGENT_DEPTH;

		try {
			const pi = new FakePi();
			orchestratorSystem(pi as never);

			const handler = pi.handlers.get("session_start");
			assert.ok(handler, "session_start handler should be registered");

			await handler?.({ type: "session_start", reason: "startup" }, { hasUI: false, cwd: process.cwd() });

			assert.deepEqual(pi.activeToolCalls, [["read", "bash", "write"]]);
		} finally {
			if (previousDepth === undefined) delete process.env.PI_SUBAGENT_DEPTH;
			else process.env.PI_SUBAGENT_DEPTH = previousDepth;
		}
	});
});
