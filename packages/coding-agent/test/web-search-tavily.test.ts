import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { tavilyWebSearchProvider } from "../src/core/tools/web-search/providers/tavily.js";

function createCtx(apiKey?: string): ExtensionContext {
	return {
		modelRegistry: {
			getApiKeyForProvider: vi.fn(async (provider: string) => {
				expect(provider).toBe("tavily");
				return apiKey;
			}),
		},
	} as unknown as ExtensionContext;
}

describe("tavily web search provider", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("reports configured state from model registry", async () => {
		await expect(tavilyWebSearchProvider.isConfigured(createCtx("tvly-key"))).resolves.toBe(true);
		await expect(tavilyWebSearchProvider.isConfigured(createCtx(undefined))).resolves.toBe(false);
	});

	test("calls Tavily search and normalizes results", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			expect(String(input)).toBe("https://api.tavily.com/search");
			expect(init?.method).toBe("POST");
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			expect(init?.headers).toMatchObject({
				"Content-Type": "application/json",
				Accept: "application/json",
			});

			const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
			expect(body).toMatchObject({
				api_key: "tvly-key",
				query: "pi mono",
				max_results: 2,
				search_depth: "basic",
				include_answer: false,
				include_images: false,
				include_raw_content: false,
			});

			return new Response(
				JSON.stringify({
					results: [
						{
							title: "Pi Mono",
							url: "https://pi.dev",
							content: "Unified coding agent.",
							source: "pi.dev",
						},
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await tavilyWebSearchProvider.search({
			query: "pi mono",
			maxResults: 2,
			signal: new AbortController().signal,
			ctx: createCtx("tvly-key"),
		});

		expect(result).toEqual({
			ok: true,
			provider: "tavily",
			query: "pi mono",
			results: [
				{
					title: "Pi Mono",
					url: "https://pi.dev",
					snippet: "Unified coding agent.",
					source: "pi.dev",
				},
			],
			warnings: [],
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	test("throws a clean error for Tavily API failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(JSON.stringify({ error: "bad key" }), { status: 401, statusText: "Unauthorized" }),
			),
		);

		await expect(
			tavilyWebSearchProvider.search({
				query: "pi mono",
				maxResults: 2,
				ctx: createCtx("tvly-key"),
			}),
		).rejects.toThrow('Tavily search failed (401 Unauthorized): {"error":"bad key"}');
	});
});
