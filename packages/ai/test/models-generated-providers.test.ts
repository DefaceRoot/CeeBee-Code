import { describe, expect, test } from "vitest";
import { getModel, getProviders } from "../src/models.js";

describe("generated model providers", () => {
	test("includes curated apertis, fireworks, and kilo starter models", () => {
		expect(getProviders()).toContain("apertis");
		expect(getProviders()).toContain("fireworks");
		expect(getProviders()).toContain("kilo");

		expect(getModel("apertis", "deepseek-v3.2").id).toBe("deepseek-v3.2");
		expect(getModel("fireworks", "accounts/fireworks/routers/kimi-k2p5-turbo").id).toBe(
			"accounts/fireworks/routers/kimi-k2p5-turbo",
		);
		expect(getModel("kilo", "anthropic/claude-sonnet-4.5").id).toBe("anthropic/claude-sonnet-4.5");
	});
});
