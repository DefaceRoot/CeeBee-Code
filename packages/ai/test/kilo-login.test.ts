import { afterEach, describe, expect, test, vi } from "vitest";
import { loginKilo } from "../src/utils/oauth/kilo.js";

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

describe("Kilo login", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test("completes a device authorization flow and returns an api_key credential", async () => {
		const authEvents: Array<{ url: string; instructions?: string }> = [];
		const progress: string[] = [];
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					device_code: "device-code-1",
					user_code: "ABCD-EFGH",
					verification_uri: "https://kilo.ai/device",
					interval: 0,
					expires_in: 600,
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ error: "authorization_pending" }))
			.mockResolvedValueOnce(jsonResponse({ access_token: "kilo-session-token" }));
		vi.stubGlobal("fetch", fetchMock);

		const credential = await loginKilo({
			onAuth: (info) => authEvents.push(info),
			onPrompt: async () => {
				throw new Error("Kilo device login should not prompt for an API key");
			},
			onProgress: (message) => progress.push(message),
		});

		expect(credential).toEqual({ type: "api_key", key: "kilo-session-token" });
		expect(authEvents).toEqual([
			{
				url: "https://kilo.ai/device",
				instructions: expect.stringContaining("ABCD-EFGH"),
			},
		]);
		expect(progress).toContain("Waiting for Kilo device authorization...");
		expect(getUrl(fetchMock.mock.calls[0]?.[0])).toBe("https://api.kilo.ai/oauth/device/code");
		expect(getUrl(fetchMock.mock.calls[1]?.[0])).toBe("https://api.kilo.ai/oauth/token");
		expect(getUrl(fetchMock.mock.calls[2]?.[0])).toBe("https://api.kilo.ai/oauth/token");
	});

	test("surfaces a denied device authorization error", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					device_code: "device-code-2",
					user_code: "WXYZ-1234",
					verification_uri: "https://kilo.ai/device",
					interval: 0,
					expires_in: 600,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					error: "access_denied",
					error_description: "User denied access",
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginKilo({
				onAuth: () => {},
				onPrompt: async () => {
					throw new Error("Kilo device login should not prompt for an API key");
				},
			}),
		).rejects.toThrow("Kilo device authorization failed: access_denied: User denied access");
	});
});
