import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { parallelWebSearchProvider } from "../src/core/tools/web-search/providers/parallel.js";

function createCtx(apiKey?: string): ExtensionContext {
	return {
		modelRegistry: {
			getApiKeyForProvider: vi.fn(async (provider: string) => {
				expect(provider).toBe("parallel");
				return apiKey;
			}),
		},
	} as unknown as ExtensionContext;
}

describe("parallel web search provider", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("reports configured state from model registry", async () => {
		await expect(parallelWebSearchProvider.isConfigured(createCtx("parallel-key"))).resolves.toBe(true);
		await expect(parallelWebSearchProvider.isConfigured(createCtx(undefined))).resolves.toBe(false);
	});

	test("calls Parallel search and normalizes results", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			expect(String(input)).toBe("https://api.parallel.ai/v1/search");
			expect(init?.method).toBe("POST");
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			expect(init?.headers).toMatchObject({
				Authorization: "Bearer parallel-key",
				"Content-Type": "application/json",
				Accept: "application/json",
			});

			const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
			expect(body).toMatchObject({
				query: "pi mono",
				max_results: 3,
			});

			return new Response(
				JSON.stringify({
					results: [
						{
							title: "Pi Mono",
							url: "https://pi.dev",
							snippet: "Coding agent monorepo.",
							source: "parallel",
						},
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await parallelWebSearchProvider.search({
			query: "pi mono",
			maxResults: 3,
			signal: new AbortController().signal,
			ctx: createCtx("parallel-key"),
		});

		expect(result).toEqual({
			ok: true,
			provider: "parallel",
			query: "pi mono",
			results: [
				{
					title: "Pi Mono",
					url: "https://pi.dev",
					snippet: "Coding agent monorepo.",
					source: "parallel",
				},
			],
			warnings: [],
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	test("throws a clean error for Parallel API failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("upstream exploded", { status: 502, statusText: "Bad Gateway" })),
		);

		await expect(
			parallelWebSearchProvider.search({
				query: "pi mono",
				maxResults: 1,
				ctx: createCtx("parallel-key"),
			}),
		).rejects.toThrow("Parallel search failed (502 Bad Gateway): upstream exploded");
	});
});
