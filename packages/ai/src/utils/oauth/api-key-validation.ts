import type { ApiKeyCredentials, OAuthLoginCallbacks } from "./types.js";

interface PromptForApiKeyOptions {
	providerName: string;
	message?: string;
	placeholder?: string;
	validationMessage?: string;
	validate?: (apiKey: string, signal?: AbortSignal) => Promise<void>;
}

interface OpenAICompatibleValidationOptions {
	baseUrl: string;
	apiKey: string;
	signal?: AbortSignal;
	headers?: Record<string, string>;
	path?: string;
}

function trimValidationMessage(message: string): string {
	return message.replace(/\s+/g, " ").trim();
}

async function buildValidationError(response: Response): Promise<Error> {
	const body = trimValidationMessage(await response.text());
	const detail = body ? `: ${body}` : "";
	return new Error(`API key validation failed (${response.status} ${response.statusText})${detail}`);
}

function buildValidationUrl(baseUrl: string, path = "/models"): string {
	const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
	return new URL(normalizedPath, normalizedBaseUrl).toString();
}

export async function validateOpenAICompatibleApiKey(options: OpenAICompatibleValidationOptions): Promise<void> {
	const response = await fetch(buildValidationUrl(options.baseUrl, options.path), {
		method: "GET",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${options.apiKey}`,
			...options.headers,
		},
		signal: options.signal,
	});

	if (!response.ok) {
		throw await buildValidationError(response);
	}
}

export async function promptForApiKey(
	callbacks: OAuthLoginCallbacks,
	options: PromptForApiKeyOptions,
): Promise<ApiKeyCredentials> {
	const response = await callbacks.onPrompt({
		message: options.message ?? `Enter ${options.providerName} API key`,
		placeholder: options.placeholder,
	});
	const apiKey = response.trim();

	if (!apiKey) {
		throw new Error(`${options.providerName} API key is required`);
	}

	if (options.validate) {
		callbacks.onProgress?.(options.validationMessage ?? "Validating API key...");
		await options.validate(apiKey, callbacks.signal);
	}

	return {
		type: "api_key",
		key: apiKey,
	};
}
