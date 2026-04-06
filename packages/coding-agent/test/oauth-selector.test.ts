import { registerOAuthProvider, resetOAuthProviders } from "@mariozechner/pi-ai/oauth";
import { setKeybindings } from "@mariozechner/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { KeybindingsManager } from "../src/core/keybindings.js";
import { OAuthSelectorComponent } from "../src/modes/interactive/components/oauth-selector.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

function providerId(name: string): string {
	return `oauth-selector-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("OAuthSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	afterEach(() => {
		resetOAuthProviders();
	});

	test("logout mode lists providers with saved api_key and oauth credentials", () => {
		const apiKeyProviderId = providerId("api-key");
		const oauthProviderId = providerId("oauth");
		registerOAuthProvider({
			id: apiKeyProviderId,
			name: "API Key Provider",
			async login() {
				return { type: "api_key", key: "saved-api-key" };
			},
		});
		registerOAuthProvider({
			id: oauthProviderId,
			name: "OAuth Provider",
			async login() {
				return { type: "oauth", refresh: "refresh-token", access: "access-token", expires: Date.now() + 60_000 };
			},
		});

		const authStorage = AuthStorage.inMemory({
			[apiKeyProviderId]: { type: "api_key", key: "saved-api-key" },
			[oauthProviderId]: {
				type: "oauth",
				refresh: "refresh-token",
				access: "access-token",
				expires: Date.now() + 60_000,
			},
			"stale-provider": { type: "api_key", key: "stale-key" },
		});

		const selector = new OAuthSelectorComponent(
			"logout",
			authStorage,
			() => {},
			() => {},
		);
		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("API Key Provider");
		expect(output).toContain("OAuth Provider");
		expect(output.match(/authenticated/g)?.length ?? 0).toBe(2);
		expect(output).not.toContain("stale-provider");
	});

	test("login mode marks saved api_key providers as authenticated", () => {
		const apiKeyProviderId = providerId("authenticated-api-key");
		registerOAuthProvider({
			id: apiKeyProviderId,
			name: "Authenticated API Key Provider",
			async login() {
				return { type: "api_key", key: "saved-api-key" };
			},
		});

		const authStorage = AuthStorage.inMemory({
			[apiKeyProviderId]: { type: "api_key", key: "saved-api-key" },
		});

		const selector = new OAuthSelectorComponent(
			"login",
			authStorage,
			() => {},
			() => {},
		);
		const output = stripAnsi(selector.render(120).join("\n"));
		const providerLine = output.split("\n").find((line) => line.includes("Authenticated API Key Provider"));

		expect(providerLine).toBeDefined();
		expect(providerLine).toContain("authenticated");
	});
});
