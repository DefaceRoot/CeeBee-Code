import { describe, expect, test } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { zaiWebSearchProvider } from "../src/core/tools/web-search/providers/zai.js";

function createContext(apiKey: string | undefined): ExtensionContext {
	return {
		modelRegistry: {
			getApiKeyForProvider: async () => apiKey,
		},
	} as unknown as ExtensionContext;
}

describe("zaiWebSearchProvider", () => {
	test("isConfigured requires a configured Z.AI API key", async () => {
		expect(await zaiWebSearchProvider.isConfigured(createContext(undefined))).toBe(false);
		expect(await zaiWebSearchProvider.isConfigured(createContext("zai-api-key"))).toBe(true);
	});

	test("fails with a precise limitation message when invoked", async () => {
		await expect(
			zaiWebSearchProvider.search({
				query: "pi mono",
				maxResults: 5,
				ctx: createContext("zai-api-key"),
			}),
		).rejects.toThrow(
			"Z.AI web search is not available yet: this coding-agent build does not include a remote MCP client for the Z.AI search endpoint.",
		);
	});

	test("respects aborted signals", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			zaiWebSearchProvider.search({
				query: "pi mono",
				maxResults: 5,
				signal: controller.signal,
				ctx: createContext("zai-api-key"),
			}),
		).rejects.toThrow("Operation aborted");
	});
});
