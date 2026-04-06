import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const PERPLEXITY_APP_URL = "https://www.perplexity.ai/";
const PERPLEXITY_REQUEST_CODE_URL = "https://www.perplexity.ai/api/auth/request-code";
const PERPLEXITY_VERIFY_CODE_URL = "https://www.perplexity.ai/api/auth/verify-code";

type RequestCodeResponse = {
	challenge_id?: string;
	challengeId?: string;
};

type VerifyCodeResponse = {
	api_key?: string;
	apiKey?: string;
	access_token?: string;
	token?: string;
};

const DEFAULT_STATUS_TEXT: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	409: "Conflict",
	422: "Unprocessable Entity",
	429: "Too Many Requests",
	500: "Internal Server Error",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
};

function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error("Login cancelled");
	}
}

async function readErrorBody(response: Response): Promise<string> {
	return (await response.text().catch(() => "")).trim();
}

function getStatusText(response: Response): string {
	return response.statusText || DEFAULT_STATUS_TEXT[response.status] || "Request Failed";
}

async function requestPerplexityChallenge(email: string, signal?: AbortSignal): Promise<string> {
	const response = await fetch(PERPLEXITY_REQUEST_CODE_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ email }),
		signal,
	});

	if (!response.ok) {
		const body = await readErrorBody(response);
		const detail = body ? `: ${body}` : "";
		throw new Error(`Perplexity login request failed (${response.status} ${getStatusText(response)})${detail}`);
	}

	const data = (await response.json()) as RequestCodeResponse;
	const challengeId = data.challenge_id ?? data.challengeId;
	if (typeof challengeId !== "string" || !challengeId.trim()) {
		throw new Error("Invalid Perplexity login challenge response");
	}
	return challengeId;
}

function extractPerplexityApiKey(response: VerifyCodeResponse): string | undefined {
	const key = response.api_key ?? response.apiKey ?? response.access_token ?? response.token;
	return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

async function verifyPerplexityCode(
	email: string,
	challengeId: string,
	code: string,
	signal?: AbortSignal,
): Promise<string> {
	const response = await fetch(PERPLEXITY_VERIFY_CODE_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email,
			code,
			challenge_id: challengeId,
		}),
		signal,
	});

	if (!response.ok) {
		const body = await readErrorBody(response);
		const detail = body ? `: ${body}` : "";
		throw new Error(`Perplexity login verification failed (${response.status} ${getStatusText(response)})${detail}`);
	}

	const data = (await response.json()) as VerifyCodeResponse;
	const apiKey = extractPerplexityApiKey(data);
	if (!apiKey) {
		throw new Error("Invalid Perplexity login verification response");
	}
	return apiKey;
}

export async function loginPerplexity(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	assertNotAborted(callbacks.signal);
	const email = (
		await callbacks.onPrompt({
			message: "Perplexity email",
			placeholder: "you@example.com",
		})
	).trim();

	if (!email) {
		throw new Error("Perplexity email is required");
	}

	callbacks.onProgress?.("Requesting Perplexity login code...");
	const challengeId = await requestPerplexityChallenge(email, callbacks.signal);

	callbacks.onAuth({
		url: PERPLEXITY_APP_URL,
		instructions: `A Perplexity one-time code was sent to ${email}. Enter it below to finish login.`,
	});

	assertNotAborted(callbacks.signal);
	const code = (
		await callbacks.onPrompt({
			message: "Enter the Perplexity one-time code",
			placeholder: "123456",
		})
	).trim();

	if (!code) {
		throw new Error("Perplexity one-time code is required");
	}

	callbacks.onProgress?.("Exchanging Perplexity one-time code...");
	const apiKey = await verifyPerplexityCode(email, challengeId, code, callbacks.signal);

	return {
		type: "api_key",
		key: apiKey,
	};
}

export const perplexityOAuthProvider: OAuthProviderInterface = {
	id: "perplexity",
	name: "Perplexity",
	login: loginPerplexity,
};
