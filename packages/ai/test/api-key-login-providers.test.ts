import { afterEach, describe, expect, test, vi } from "vitest";
import { fireworksOAuthProvider } from "../src/utils/oauth/fireworks.js";
import {
	getOAuthApiKey,
	getOAuthProviders,
	normalizeOAuthLoginResult,
	registerOAuthProvider,
	resetOAuthProviders,
} from "../src/utils/oauth/index.js";
import { tavilyOAuthProvider } from "../src/utils/oauth/tavily.js";

function createPromptCallbacks(response: string) {
	return {
		onAuth: () => {},
		onPrompt: async () => response,
	};
}

describe("login-capable providers", () => {
	afterEach(() => {
		resetOAuthProviders();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("registers built-in API-key and device login providers", () => {
		const providerIds = getOAuthProviders().map((provider) => provider.id);

		expect(providerIds).toEqual(
			expect.arrayContaining(["apertis", "fireworks", "kilo", "tavily", "parallel", "perplexity", "zai"]),
		);
	});

	test("simple API-key login providers return api_key credentials", async () => {
		const credentials = await tavilyOAuthProvider.login(createPromptCallbacks("tvly-test-key"));

		expect(credentials).toEqual({ type: "api_key", key: "tvly-test-key" });
	});

	test("validated API-key providers return api_key credentials after validation", async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await fireworksOAuthProvider.login(createPromptCallbacks("fw-test-key"));

		expect(credentials).toEqual({ type: "api_key", key: "fw-test-key" });
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	test("normalizes legacy raw OAuth credentials for persistence", () => {
		expect(
			normalizeOAuthLoginResult({
				refresh: "refresh-token",
				access: "access-token",
				expires: 123_456,
			}),
		).toEqual({
			type: "oauth",
			refresh: "refresh-token",
			access: "access-token",
			expires: 123_456,
		});
		expect(normalizeOAuthLoginResult({ type: "api_key", key: "test-key" })).toEqual({
			type: "api_key",
			key: "test-key",
		});
	});

	test("oauth refresh helpers continue to work for OAuth-capable providers", async () => {
		const providerId = `oauth-refresh-provider-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		registerOAuthProvider({
			id: providerId,
			name: "Refreshable OAuth Provider",
			async login() {
				return {
					type: "oauth",
					refresh: "refresh-token",
					access: "expired-token",
					expires: Date.now() - 1_000,
				};
			},
			async refreshToken(credentials) {
				return {
					...credentials,
					access: "fresh-token",
					expires: Date.now() + 60_000,
				};
			},
			getApiKey(credentials) {
				return `Bearer ${credentials.access}`;
			},
		});

		const refreshed = await getOAuthApiKey(providerId, {
			[providerId]: {
				refresh: "refresh-token",
				access: "expired-token",
				expires: Date.now() - 1_000,
			},
		});

		expect(refreshed).not.toBeNull();
		expect(refreshed?.apiKey).toBe("Bearer fresh-token");
		expect(refreshed?.newCredentials.access).toBe("fresh-token");
	});
});
