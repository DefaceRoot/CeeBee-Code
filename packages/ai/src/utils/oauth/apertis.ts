import { promptForApiKey, validateOpenAICompatibleApiKey } from "./api-key-validation.js";
import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const APERTIS_BASE_URL = "https://api.apertis.ai/v1";

export async function loginApertis(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	return promptForApiKey(callbacks, {
		providerName: "Apertis.ai",
		placeholder: "sk-...",
		validationMessage: "Validating Apertis API key...",
		validate: (apiKey, signal) =>
			validateOpenAICompatibleApiKey({
				baseUrl: APERTIS_BASE_URL,
				apiKey,
				signal,
			}),
	});
}

export const apertisOAuthProvider: OAuthProviderInterface = {
	id: "apertis",
	name: "Apertis.ai",
	login: loginApertis,
};
