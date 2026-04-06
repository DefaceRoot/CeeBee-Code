import type { WebSearchResultItem } from "../types.js";
import { buildWebSearchSuccess, type WebSearchProvider, type WebSearchProviderSearchOptions } from "./base.js";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_COOKIE_SEARCH_URL = "https://www.perplexity.ai/rest/search";
const PERPLEXITY_COOKIE_ENV = "PERPLEXITY_COOKIES";
const PERPLEXITY_MODEL = "sonar";

type PerplexityAuth =
	| {
			kind: "api_key";
			apiKey: string;
	  }
	| {
			kind: "cookies";
			cookies: string;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function ensureNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error("Operation aborted");
	}
}

function getCookieAuth(): PerplexityAuth | undefined {
	const cookies = process.env[PERPLEXITY_COOKIE_ENV]?.trim();
	return cookies ? { kind: "cookies", cookies } : undefined;
}

async function getPerplexityAuth(options: WebSearchProviderSearchOptions): Promise<PerplexityAuth | undefined> {
	const apiKey = await options.ctx.modelRegistry.getApiKeyForProvider("perplexity");
	if (apiKey) {
		return { kind: "api_key", apiKey };
	}
	return getCookieAuth();
}

function titleFromUrl(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function extractResultItem(item: unknown, fallbackSnippet?: string): WebSearchResultItem | undefined {
	if (!isRecord(item)) {
		return undefined;
	}

	const url = readNonEmptyString(item.url) ?? readNonEmptyString(item.link);
	if (!url) {
		return undefined;
	}

	const snippet =
		readNonEmptyString(item.snippet) ??
		readNonEmptyString(item.description) ??
		readNonEmptyString(item.text) ??
		fallbackSnippet ??
		"";

	return {
		title: readNonEmptyString(item.title) ?? titleFromUrl(url),
		url,
		snippet,
		source: readNonEmptyString(item.source),
	};
}

function getCandidateCollections(payload: Record<string, unknown>): unknown[][] {
	const candidates = [payload.search_results, payload.results, payload.web_results, payload.sources];
	return candidates.filter(Array.isArray) as unknown[][];
}

function normalizePerplexityResults(payload: unknown): WebSearchResultItem[] {
	if (!isRecord(payload)) {
		return [];
	}

	const answerText = readNonEmptyString(payload.answer) ?? readNonEmptyString(payload.output);
	for (const candidate of getCandidateCollections(payload)) {
		const results = candidate
			.map((item) => extractResultItem(item, answerText))
			.filter((item): item is WebSearchResultItem => item !== undefined);
		if (results.length > 0) {
			return results;
		}
	}

	const citations = Array.isArray(payload.citations) ? payload.citations : [];
	return citations
		.map((citation) => {
			if (typeof citation === "string") {
				return {
					title: titleFromUrl(citation),
					url: citation,
					snippet: answerText ?? "",
				};
			}
			return extractResultItem(citation, answerText);
		})
		.filter((item): item is WebSearchResultItem => item !== undefined);
}

async function buildError(prefix: string, response: Response): Promise<Error> {
	const body = (await response.text()).trim();
	const detail = body ? `: ${body}` : "";
	return new Error(`${prefix} (${response.status} ${response.statusText})${detail}`);
}

async function searchWithApiKey(
	auth: Extract<PerplexityAuth, { kind: "api_key" }>,
	options: WebSearchProviderSearchOptions,
): Promise<WebSearchResultItem[]> {
	const response = await fetch(PERPLEXITY_API_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: `Bearer ${auth.apiKey}`,
		},
		body: JSON.stringify({
			model: PERPLEXITY_MODEL,
			stream: false,
			messages: [
				{
					role: "system",
					content: "Search the web and return the most relevant sources for the user query.",
				},
				{ role: "user", content: options.query },
			],
		}),
		signal: options.signal,
	});

	if (!response.ok) {
		throw await buildError("Perplexity search failed", response);
	}

	return normalizePerplexityResults((await response.json()) as unknown);
}

async function searchWithCookies(
	auth: Extract<PerplexityAuth, { kind: "cookies" }>,
	options: WebSearchProviderSearchOptions,
): Promise<WebSearchResultItem[]> {
	const response = await fetch(PERPLEXITY_COOKIE_SEARCH_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Cookie: auth.cookies,
		},
		body: JSON.stringify({
			query: options.query,
			limit: options.maxResults,
		}),
		signal: options.signal,
	});

	if (!response.ok) {
		throw await buildError("Perplexity search failed", response);
	}

	return normalizePerplexityResults((await response.json()) as unknown);
}

export const perplexityWebSearchProvider: WebSearchProvider = {
	id: "perplexity",
	name: "Perplexity",
	async isConfigured(ctx) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("perplexity");
		return apiKey !== undefined || getCookieAuth() !== undefined;
	},
	async search(options) {
		ensureNotAborted(options.signal);
		const auth = await getPerplexityAuth(options);
		if (!auth) {
			throw new Error("Perplexity web search requires PERPLEXITY_API_KEY or PERPLEXITY_COOKIES.");
		}

		const results =
			auth.kind === "api_key" ? await searchWithApiKey(auth, options) : await searchWithCookies(auth, options);

		return buildWebSearchSuccess("perplexity", options.query, results.slice(0, options.maxResults));
	},
};
