import { promptForApiKey, validateOpenAICompatibleApiKey } from "./api-key-validation.js";
import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

export async function loginZai(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	return promptForApiKey(callbacks, {
		providerName: "Z.AI",
		placeholder: "zai_...",
		validationMessage: "Validating Z.AI API key...",
		validate: (apiKey, signal) =>
			validateOpenAICompatibleApiKey({
				baseUrl: ZAI_BASE_URL,
				apiKey,
				signal,
			}),
	});
}

export const zaiOAuthProvider: OAuthProviderInterface = {
	id: "zai",
	name: "Z.AI",
	login: loginZai,
};
