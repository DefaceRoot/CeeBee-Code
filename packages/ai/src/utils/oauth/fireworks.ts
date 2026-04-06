import { promptForApiKey, validateOpenAICompatibleApiKey } from "./api-key-validation.js";
import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

export async function loginFireworks(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	return promptForApiKey(callbacks, {
		providerName: "Fireworks AI",
		placeholder: "fw_...",
		validationMessage: "Validating Fireworks API key...",
		validate: (apiKey, signal) =>
			validateOpenAICompatibleApiKey({
				baseUrl: FIREWORKS_BASE_URL,
				apiKey,
				signal,
			}),
	});
}

export const fireworksOAuthProvider: OAuthProviderInterface = {
	id: "fireworks",
	name: "Fireworks AI",
	login: loginFireworks,
};
