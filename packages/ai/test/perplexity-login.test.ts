import { afterEach, describe, expect, test, vi } from "vitest";
import { loginPerplexity } from "../src/utils/oauth/perplexity.js";

function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

function getUrl(input: unknown): string {
	if (typeof input === "string") {
		return input;
	}
	if (input instanceof URL) {
		return input.toString();
	}
	if (input instanceof Request) {
		return input.url;
	}
	throw new Error(`Unsupported fetch input: ${String(input)}`);
}

describe("Perplexity login", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("requests an OTP code and exchanges it for an api_key credential", async () => {
		const prompts: string[] = [];
		const authEvents: Array<{ url: string; instructions?: string }> = [];
		const progress: string[] = [];
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					challenge_id: "challenge-123",
					delivery: "email",
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					api_key: "pplx-session-key",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const onPrompt = vi
			.fn()
			.mockImplementationOnce(async (prompt: { message: string }) => {
				prompts.push(prompt.message);
				return "user@example.com";
			})
			.mockImplementationOnce(async (prompt: { message: string }) => {
				prompts.push(prompt.message);
				return "123456";
			});

		const credential = await loginPerplexity({
			onAuth: (info) => authEvents.push(info),
			onPrompt,
			onProgress: (message) => progress.push(message),
		});

		expect(credential).toEqual({ type: "api_key", key: "pplx-session-key" });
		expect(prompts).toEqual(["Perplexity email", "Enter the Perplexity one-time code"]);
		expect(authEvents).toEqual([
			{
				url: "https://www.perplexity.ai/",
				instructions: expect.stringContaining("user@example.com"),
			},
		]);
		expect(progress).toContain("Requesting Perplexity login code...");
		expect(progress).toContain("Exchanging Perplexity one-time code...");
		expect(getUrl(fetchMock.mock.calls[0]?.[0])).toBe("https://www.perplexity.ai/api/auth/request-code");
		expect(getUrl(fetchMock.mock.calls[1]?.[0])).toBe("https://www.perplexity.ai/api/auth/verify-code");
	});

	test("surfaces rate limit errors from the OTP request step", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "too_many_requests" }, 429));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginPerplexity({
				onAuth: () => {},
				onPrompt: async () => "user@example.com",
			}),
		).rejects.toThrow('Perplexity login request failed (429 Too Many Requests): {"error":"too_many_requests"}');
	});
});
