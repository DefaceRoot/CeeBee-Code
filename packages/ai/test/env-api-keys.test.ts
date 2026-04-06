import { describe, expect, test } from "vitest";
import { getEnvApiKey } from "../src/env-api-keys.js";

describe("getEnvApiKey", () => {
	test("resolves new model and search provider environment variables", () => {
		const originalEnv = {
			APERTIS_API_KEY: process.env.APERTIS_API_KEY,
			FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY,
			KILO_API_KEY: process.env.KILO_API_KEY,
			TAVILY_API_KEY: process.env.TAVILY_API_KEY,
			PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
			PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
		};

		process.env.APERTIS_API_KEY = "apertis-key";
		process.env.FIREWORKS_API_KEY = "fireworks-key";
		process.env.KILO_API_KEY = "kilo-key";
		process.env.TAVILY_API_KEY = "tavily-key";
		process.env.PARALLEL_API_KEY = "parallel-key";
		process.env.PERPLEXITY_API_KEY = "perplexity-key";

		try {
			expect(getEnvApiKey("apertis")).toBe("apertis-key");
			expect(getEnvApiKey("fireworks")).toBe("fireworks-key");
			expect(getEnvApiKey("kilo")).toBe("kilo-key");
			expect(getEnvApiKey("tavily")).toBe("tavily-key");
			expect(getEnvApiKey("parallel")).toBe("parallel-key");
			expect(getEnvApiKey("perplexity")).toBe("perplexity-key");
		} finally {
			for (const [key, value] of Object.entries(originalEnv)) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
		}
	});
});
