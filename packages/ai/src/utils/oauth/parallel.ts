import { promptForApiKey } from "./api-key-validation.js";
import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

export async function loginParallel(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	return promptForApiKey(callbacks, {
		providerName: "Parallel",
		placeholder: "par_...",
	});
}

export const parallelOAuthProvider: OAuthProviderInterface = {
	id: "parallel",
	name: "Parallel",
	login: loginParallel,
};
