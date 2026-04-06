import { promptForApiKey } from "./api-key-validation.js";
import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

export async function loginTavily(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	return promptForApiKey(callbacks, {
		providerName: "Tavily",
		placeholder: "tvly-...",
	});
}

export const tavilyOAuthProvider: OAuthProviderInterface = {
	id: "tavily",
	name: "Tavily",
	login: loginTavily,
};
