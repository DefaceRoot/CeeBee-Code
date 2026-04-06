import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { allToolDefinitions, allTools, createAllToolDefinitions, createAllTools } from "../src/core/tools/index.js";
import {
	createWebSearchToolDefinition,
	getWebSearchProviders,
	WEB_SEARCH_FALLBACK_ORDER,
} from "../src/core/tools/web-search/index.js";
import { parallelWebSearchProvider } from "../src/core/tools/web-search/providers/parallel.js";
import { perplexityWebSearchProvider } from "../src/core/tools/web-search/providers/perplexity.js";
import { tavilyWebSearchProvider } from "../src/core/tools/web-search/providers/tavily.js";
import { zaiWebSearchProvider } from "../src/core/tools/web-search/providers/zai.js";

describe("web_search tool registry", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("is included in built-in tool registries", () => {
		expect(allTools).toHaveProperty("web_search");
		expect(allToolDefinitions).toHaveProperty("web_search");

		const tools = createAllTools(process.cwd());
		const definitions = createAllToolDefinitions(process.cwd());

		expect(tools).toHaveProperty("web_search");
		expect(definitions).toHaveProperty("web_search");
		expect(tools.web_search.name).toBe("web_search");
		expect(definitions.web_search.name).toBe("web_search");
	});

	test("uses the expected provider fallback order", () => {
		expect(WEB_SEARCH_FALLBACK_ORDER).toEqual(["tavily", "perplexity", "zai", "parallel"]);
		expect(getWebSearchProviders().map((provider) => provider.id)).toEqual(WEB_SEARCH_FALLBACK_ORDER);
	});

	test("reports skipped providers in fallback order when none are configured", async () => {
		const definition = createWebSearchToolDefinition(process.cwd());
		const ctx = {
			modelRegistry: {
				getApiKeyForProvider: async () => undefined,
			},
		} as unknown as ExtensionContext;

		const result = await definition.execute("tool-1", { query: "pi mono" }, undefined, undefined, ctx);

		expect(result.details.response.ok).toBe(false);
		if (result.details.response.ok) {
			throw new Error("Expected web_search to fail without configured providers");
		}
		expect(result.details.response.attempts.map((attempt) => attempt.provider)).toEqual(WEB_SEARCH_FALLBACK_ORDER);
		expect(result.details.response.attempts.every((attempt) => attempt.status === "skipped")).toBe(true);
	});

	test("falls back to the next configured provider after a provider error", async () => {
		const definition = createWebSearchToolDefinition(process.cwd());
		const ctx = {} as ExtensionContext;
		const perplexityResponse = {
			ok: true as const,
			provider: "perplexity" as const,
			query: "pi mono",
			results: [{ title: "Pi Mono", url: "https://pi.dev", snippet: "Project homepage" }],
			warnings: [],
		};

		const tavilyConfigured = vi.spyOn(tavilyWebSearchProvider, "isConfigured").mockResolvedValue(true);
		const tavilySearch = vi
			.spyOn(tavilyWebSearchProvider, "search")
			.mockRejectedValue(new Error("Tavily unavailable"));
		const perplexityConfigured = vi.spyOn(perplexityWebSearchProvider, "isConfigured").mockResolvedValue(true);
		const perplexitySearch = vi.spyOn(perplexityWebSearchProvider, "search").mockResolvedValue(perplexityResponse);
		const zaiConfigured = vi.spyOn(zaiWebSearchProvider, "isConfigured").mockResolvedValue(true);
		const parallelConfigured = vi.spyOn(parallelWebSearchProvider, "isConfigured").mockResolvedValue(true);

		const result = await definition.execute("tool-2", { query: "pi mono" }, undefined, undefined, ctx);

		expect(result.details.response).toEqual(perplexityResponse);
		expect(tavilyConfigured).toHaveBeenCalledOnce();
		expect(tavilySearch).toHaveBeenCalledOnce();
		expect(perplexityConfigured).toHaveBeenCalledOnce();
		expect(perplexitySearch).toHaveBeenCalledOnce();
		expect(zaiConfigured).not.toHaveBeenCalled();
		expect(parallelConfigured).not.toHaveBeenCalled();
		expect(tavilySearch.mock.invocationCallOrder[0]).toBeLessThan(perplexitySearch.mock.invocationCallOrder[0]);
	});

	test("limits execution to the explicitly requested provider", async () => {
		const definition = createWebSearchToolDefinition(process.cwd());
		const ctx = {} as ExtensionContext;

		const parallelConfigured = vi.spyOn(parallelWebSearchProvider, "isConfigured").mockResolvedValue(false);
		const tavilyConfigured = vi.spyOn(tavilyWebSearchProvider, "isConfigured").mockResolvedValue(true);
		const perplexityConfigured = vi.spyOn(perplexityWebSearchProvider, "isConfigured").mockResolvedValue(true);
		const zaiConfigured = vi.spyOn(zaiWebSearchProvider, "isConfigured").mockResolvedValue(true);

		const result = await definition.execute(
			"tool-3",
			{ query: "pi mono", provider: "parallel" },
			undefined,
			undefined,
			ctx,
		);

		expect(result.details.response.ok).toBe(false);
		if (result.details.response.ok) {
			throw new Error("Expected web_search to fail when the requested provider is unavailable");
		}
		expect(result.details.response.provider).toBe("parallel");
		expect(result.details.response.error).toBe('Web search is unavailable for provider "parallel".');
		expect(result.details.response.attempts).toEqual([
			{
				provider: "parallel",
				status: "skipped",
				reason: "No credentials configured for Parallel.",
			},
		]);
		expect(parallelConfigured).toHaveBeenCalledOnce();
		expect(tavilyConfigured).not.toHaveBeenCalled();
		expect(perplexityConfigured).not.toHaveBeenCalled();
		expect(zaiConfigured).not.toHaveBeenCalled();
	});
});
