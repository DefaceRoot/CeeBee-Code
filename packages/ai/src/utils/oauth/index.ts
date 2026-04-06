/**
 * OAuth credential management for AI providers.
 *
 * This module handles login, token refresh, and credential storage
 * for login-capable providers:
 * - OAuth/device providers: Anthropic, Kilo, GitHub Copilot, Google Cloud Code Assist,
 *   Antigravity, OpenAI Codex
 * - API-key login providers: Apertis, Fireworks, Tavily, Parallel, Perplexity, Z.AI
 */

// Anthropic
export { anthropicOAuthProvider, loginAnthropic, refreshAnthropicToken } from "./anthropic.js";
// Apertis
export { apertisOAuthProvider, loginApertis } from "./apertis.js";
// Fireworks
export { fireworksOAuthProvider, loginFireworks } from "./fireworks.js";
// GitHub Copilot
export {
	getGitHubCopilotBaseUrl,
	githubCopilotOAuthProvider,
	loginGitHubCopilot,
	normalizeDomain,
	refreshGitHubCopilotToken,
} from "./github-copilot.js";
// Google Antigravity
export { antigravityOAuthProvider, loginAntigravity, refreshAntigravityToken } from "./google-antigravity.js";
// Google Gemini CLI
export { geminiCliOAuthProvider, loginGeminiCli, refreshGoogleCloudToken } from "./google-gemini-cli.js";
// Kilo
export { kiloOAuthProvider, loginKilo } from "./kilo.js";
// OpenAI Codex (ChatGPT OAuth)
export { loginOpenAICodex, openaiCodexOAuthProvider, refreshOpenAICodexToken } from "./openai-codex.js";
// Parallel
export { loginParallel, parallelOAuthProvider } from "./parallel.js";
// Perplexity
export { loginPerplexity, perplexityOAuthProvider } from "./perplexity.js";
// Tavily
export { loginTavily, tavilyOAuthProvider } from "./tavily.js";
export * from "./types.js";
// Z.AI
export { loginZai, zaiOAuthProvider } from "./zai.js";

// ============================================================================
// Provider Registry
// ============================================================================

import { anthropicOAuthProvider } from "./anthropic.js";
import { apertisOAuthProvider } from "./apertis.js";
import { fireworksOAuthProvider } from "./fireworks.js";
import { githubCopilotOAuthProvider } from "./github-copilot.js";
import { antigravityOAuthProvider } from "./google-antigravity.js";
import { geminiCliOAuthProvider } from "./google-gemini-cli.js";
import { kiloOAuthProvider } from "./kilo.js";
import { openaiCodexOAuthProvider } from "./openai-codex.js";
import { parallelOAuthProvider } from "./parallel.js";
import { perplexityOAuthProvider } from "./perplexity.js";
import { tavilyOAuthProvider } from "./tavily.js";
import type { OAuthCredentials, OAuthProviderId, OAuthProviderInfo, OAuthProviderInterface } from "./types.js";
import { zaiOAuthProvider } from "./zai.js";

const BUILT_IN_OAUTH_PROVIDERS: OAuthProviderInterface[] = [
	kiloOAuthProvider,
	anthropicOAuthProvider,
	githubCopilotOAuthProvider,
	geminiCliOAuthProvider,
	antigravityOAuthProvider,
	openaiCodexOAuthProvider,
	perplexityOAuthProvider,
	apertisOAuthProvider,
	fireworksOAuthProvider,
	tavilyOAuthProvider,
	parallelOAuthProvider,
	zaiOAuthProvider,
];

const oauthProviderRegistry = new Map<string, OAuthProviderInterface>(
	BUILT_IN_OAUTH_PROVIDERS.map((provider) => [provider.id, provider]),
);

function assertOAuthOperations(
	providerId: OAuthProviderId,
	provider: OAuthProviderInterface | undefined,
): asserts provider is OAuthProviderInterface & {
	refreshToken: (credentials: OAuthCredentials) => Promise<OAuthCredentials>;
	getApiKey: (credentials: OAuthCredentials) => string;
} {
	if (!provider) {
		throw new Error(`Unknown OAuth provider: ${providerId}`);
	}
	if (!provider.refreshToken || !provider.getApiKey) {
		throw new Error(`Provider ${providerId} does not support OAuth token operations`);
	}
}

/**
 * Get an OAuth provider by ID
 */
export function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined {
	return oauthProviderRegistry.get(id);
}

/**
 * Register a custom OAuth provider
 */
export function registerOAuthProvider(provider: OAuthProviderInterface): void {
	oauthProviderRegistry.set(provider.id, provider);
}

/**
 * Unregister an OAuth provider.
 *
 * If the provider is built-in, restores the built-in implementation.
 * Custom providers are removed completely.
 */
export function unregisterOAuthProvider(id: string): void {
	const builtInProvider = BUILT_IN_OAUTH_PROVIDERS.find((provider) => provider.id === id);
	if (builtInProvider) {
		oauthProviderRegistry.set(id, builtInProvider);
		return;
	}
	oauthProviderRegistry.delete(id);
}

/**
 * Reset OAuth providers to built-ins.
 */
export function resetOAuthProviders(): void {
	oauthProviderRegistry.clear();
	for (const provider of BUILT_IN_OAUTH_PROVIDERS) {
		oauthProviderRegistry.set(provider.id, provider);
	}
}

/**
 * Get all registered OAuth providers
 */
export function getOAuthProviders(): OAuthProviderInterface[] {
	return Array.from(oauthProviderRegistry.values());
}

/**
 * @deprecated Use getOAuthProviders() which returns OAuthProviderInterface[]
 */
export function getOAuthProviderInfoList(): OAuthProviderInfo[] {
	return getOAuthProviders().map((p) => ({
		id: p.id,
		name: p.name,
		available: true,
	}));
}

// ============================================================================
// High-level API (uses provider registry)
// ============================================================================

/**
 * Refresh token for any OAuth provider.
 * @deprecated Use getOAuthProvider(id).refreshToken() instead
 */
export async function refreshOAuthToken(
	providerId: OAuthProviderId,
	credentials: OAuthCredentials,
): Promise<OAuthCredentials> {
	const provider = getOAuthProvider(providerId);
	assertOAuthOperations(providerId, provider);
	return provider.refreshToken(credentials);
}

/**
 * Get API key for a provider from OAuth credentials.
 * Automatically refreshes expired tokens.
 *
 * @returns API key string and updated credentials, or null if no credentials
 * @throws Error if refresh fails
 */
export async function getOAuthApiKey(
	providerId: OAuthProviderId,
	credentials: Record<string, OAuthCredentials>,
): Promise<{ newCredentials: OAuthCredentials; apiKey: string } | null> {
	const provider = getOAuthProvider(providerId);
	assertOAuthOperations(providerId, provider);

	let creds = credentials[providerId];
	if (!creds) {
		return null;
	}

	// Refresh if expired
	if (Date.now() >= creds.expires) {
		try {
			creds = await provider.refreshToken(creds);
		} catch (_error) {
			throw new Error(`Failed to refresh OAuth token for ${providerId}`);
		}
	}

	const apiKey = provider.getApiKey(creds);
	return { newCredentials: creds, apiKey };
}
