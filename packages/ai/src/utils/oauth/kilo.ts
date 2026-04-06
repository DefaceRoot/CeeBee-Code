import type { ApiKeyCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const KILO_DEVICE_CODE_URL = "https://api.kilo.ai/oauth/device/code";
const KILO_TOKEN_URL = "https://api.kilo.ai/oauth/token";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

type DeviceAuthorizationResponse = {
	device_code?: string;
	user_code?: string;
	verification_uri?: string;
	verification_url?: string;
	verification_uri_complete?: string;
	interval?: number;
	expires_in?: number;
};

type DeviceTokenResponse = {
	api_key?: string;
	access_token?: string;
	token?: string;
	error?: string;
	error_description?: string;
};

function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error("Login cancelled");
	}
}

async function parseJsonResponse<T>(response: Response, context: string): Promise<T> {
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		const detail = body ? `: ${body}` : "";
		throw new Error(`${context} failed (${response.status} ${response.statusText})${detail}`);
	}

	return (await response.json()) as T;
}

async function startDeviceAuthorization(signal?: AbortSignal): Promise<Required<DeviceAuthorizationResponse>> {
	const response = await fetch(KILO_DEVICE_CODE_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ client_name: "pi-ai" }),
		signal,
	});

	const data = await parseJsonResponse<DeviceAuthorizationResponse>(response, "Kilo device authorization start");
	const deviceCode = data.device_code;
	const userCode = data.user_code;
	const verificationUrl = data.verification_uri ?? data.verification_url ?? data.verification_uri_complete;
	const interval = data.interval ?? 5;
	const expiresIn = data.expires_in ?? 600;

	if (
		typeof deviceCode !== "string" ||
		typeof userCode !== "string" ||
		typeof verificationUrl !== "string" ||
		typeof interval !== "number" ||
		typeof expiresIn !== "number"
	) {
		throw new Error("Invalid Kilo device authorization response");
	}

	return {
		device_code: deviceCode,
		user_code: userCode,
		verification_uri: verificationUrl,
		verification_url: verificationUrl,
		verification_uri_complete: verificationUrl,
		interval,
		expires_in: expiresIn,
	};
}

function extractKiloApiKey(response: DeviceTokenResponse): string | undefined {
	const key = response.api_key ?? response.access_token ?? response.token;
	return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("Login cancelled"));
			return;
		}

		const timeout = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timeout);
				reject(new Error("Login cancelled"));
			},
			{ once: true },
		);
	});
}

async function pollForDeviceToken(
	deviceCode: string,
	intervalSeconds: number,
	expiresInSeconds: number,
	signal?: AbortSignal,
): Promise<string> {
	const deadline = Date.now() + expiresInSeconds * 1000;
	let intervalMs = Math.max(0, Math.floor(intervalSeconds * 1000));

	while (Date.now() < deadline) {
		assertNotAborted(signal);
		await abortableSleep(intervalMs, signal);

		const response = await fetch(KILO_TOKEN_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				device_code: deviceCode,
				grant_type: DEVICE_GRANT_TYPE,
			}),
			signal,
		});

		const data = await parseJsonResponse<DeviceTokenResponse>(response, "Kilo device token exchange");
		const apiKey = extractKiloApiKey(data);
		if (apiKey) {
			return apiKey;
		}

		if (data.error === "authorization_pending") {
			continue;
		}

		if (data.error === "slow_down") {
			intervalMs += 5000;
			continue;
		}

		if (typeof data.error === "string") {
			const suffix = data.error_description ? `: ${data.error_description}` : "";
			throw new Error(`Kilo device authorization failed: ${data.error}${suffix}`);
		}

		throw new Error("Invalid Kilo device token response");
	}

	throw new Error("Kilo device authorization timed out");
}

export async function loginKilo(callbacks: OAuthLoginCallbacks): Promise<ApiKeyCredentials> {
	assertNotAborted(callbacks.signal);
	const device = await startDeviceAuthorization(callbacks.signal);

	callbacks.onAuth({
		url: device.verification_uri,
		instructions: `Enter code: ${device.user_code}`,
	});
	callbacks.onProgress?.("Waiting for Kilo device authorization...");

	const apiKey = await pollForDeviceToken(device.device_code, device.interval, device.expires_in, callbacks.signal);

	return {
		type: "api_key",
		key: apiKey,
	};
}

export const kiloOAuthProvider: OAuthProviderInterface = {
	id: "kilo",
	name: "Kilo Gateway",
	login: loginKilo,
};
