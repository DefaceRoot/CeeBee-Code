import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { perplexityWebSearchProvider } from "../src/core/tools/web-search/providers/perplexity.js";

function createContext(apiKey: string | undefined): ExtensionContext {
	return {
		modelRegistry: {
			getApiKeyForProvider: async () => apiKey,
		},
	} as unknown as ExtensionContext;
}

describe("perplexityWebSearchProvider", () => {
	afterEach(() => {
		delete process.env.PERPLEXITY_COOKIES;
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("uses API key auth for chat-completions search", async () => {
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			expect(String(input)).toBe("https://api.perplexity.ai/chat/completions");
			expect(init?.method).toBe("POST");
			expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer pplx-api-key");
			const body = JSON.parse(String(init?.body)) as {
				model: string;
				messages: Array<{ role: string; content: string }>;
			};
			expect(body.model).toBe("sonar");
			expect(body.messages.at(-1)?.content).toContain("pi mono");

			return new Response(
				JSON.stringify({
					search_results: [
						{ title: "Pi Mono", url: "https://pi.dev", snippet: "Project homepage" },
						{ title: "Docs", url: "https://pi.dev/docs", snippet: "Provider documentation" },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await perplexityWebSearchProvider.search({
			query: "pi mono",
			maxResults: 1,
			ctx: createContext("pplx-api-key"),
		});

		expect(response).toEqual({
			ok: true,
			provider: "perplexity",
			query: "pi mono",
			results: [{ title: "Pi Mono", url: "https://pi.dev", snippet: "Project homepage" }],
			warnings: [],
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	test("falls back to cookie auth when no API key is configured", async () => {
		process.env.PERPLEXITY_COOKIES = "sessionid=abc123";

		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			expect(String(input)).toBe("https://www.perplexity.ai/rest/search");
			expect(init?.method).toBe("POST");
			expect((init?.headers as Record<string, string>).Cookie).toBe("sessionid=abc123");
			expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();

			return new Response(
				JSON.stringify({
					results: [
						{ title: "Perplexity Result", url: "https://example.com/result", snippet: "cookie mode works" },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const response = await perplexityWebSearchProvider.search({
			query: "cookie auth",
			maxResults: 5,
			ctx: createContext(undefined),
		});

		expect(response.ok).toBe(true);
		if (!response.ok) {
			throw new Error("Expected successful response");
		}
		expect(response.results).toEqual([
			{ title: "Perplexity Result", url: "https://example.com/result", snippet: "cookie mode works" },
		]);
	});

	test("prefers API key auth over cookie auth when both are configured", async () => {
		process.env.PERPLEXITY_COOKIES = "sessionid=abc123";

		const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit): Promise<Response> => {
			expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer pplx-api-key");
			expect((init?.headers as Record<string, string>).Cookie).toBeUndefined();
			return new Response(
				JSON.stringify({
					search_results: [{ title: "Pi Mono", url: "https://pi.dev", snippet: "Project homepage" }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		await perplexityWebSearchProvider.search({
			query: "pi mono",
			maxResults: 5,
			ctx: createContext("pplx-api-key"),
		});

		expect(fetchMock).toHaveBeenCalledOnce();
	});

	test("isConfigured supports API keys and cookie fallback", async () => {
		expect(await perplexityWebSearchProvider.isConfigured(createContext(undefined))).toBe(false);

		process.env.PERPLEXITY_COOKIES = "sessionid=abc123";
		expect(await perplexityWebSearchProvider.isConfigured(createContext(undefined))).toBe(true);
		expect(await perplexityWebSearchProvider.isConfigured(createContext("pplx-api-key"))).toBe(true);
	});

	test("throws a clean error when no auth is configured", async () => {
		await expect(
			perplexityWebSearchProvider.search({
				query: "pi mono",
				maxResults: 5,
				ctx: createContext(undefined),
			}),
		).rejects.toThrow("Perplexity web search requires PERPLEXITY_API_KEY or PERPLEXITY_COOKIES.");
	});

	test("surfaces response errors cleanly", async () => {
		const fetchMock = vi.fn(async (): Promise<Response> => {
			return new Response("upstream exploded", { status: 502, statusText: "Bad Gateway" });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			perplexityWebSearchProvider.search({
				query: "pi mono",
				maxResults: 5,
				ctx: createContext("pplx-api-key"),
			}),
		).rejects.toThrow("Perplexity search failed (502 Bad Gateway): upstream exploded");
	});

	test("respects aborted signals", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			perplexityWebSearchProvider.search({
				query: "pi mono",
				maxResults: 5,
				signal: controller.signal,
				ctx: createContext("pplx-api-key"),
			}),
		).rejects.toThrow("Operation aborted");
	});
});
