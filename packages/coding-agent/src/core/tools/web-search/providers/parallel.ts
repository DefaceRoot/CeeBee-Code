import { buildWebSearchSuccess, type WebSearchProvider } from "./base.js";

const PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search";

type ParallelSearchResult = {
	title?: string;
	url?: string;
	snippet?: string;
	content?: string;
	description?: string;
	source?: string;
};

type ParallelSearchResponse = {
	results?: ParallelSearchResult[];
	data?: ParallelSearchResult[];
};

async function buildParallelError(response: Response): Promise<Error> {
	const body = (await response.text()).trim();
	const suffix = body ? `: ${body}` : "";
	return new Error(`Parallel search failed (${response.status} ${response.statusText})${suffix}`);
}

function normalizeParallelResult(result: ParallelSearchResult) {
	if (!result.title || !result.url) {
		return undefined;
	}

	return {
		title: result.title,
		url: result.url,
		snippet: result.snippet ?? result.content ?? result.description ?? "",
		source: result.source,
	};
}

export const parallelWebSearchProvider: WebSearchProvider = {
	id: "parallel",
	name: "Parallel",
	async isConfigured(ctx) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("parallel");
		return apiKey !== undefined;
	},
	async search({ query, maxResults, signal, ctx }) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("parallel");
		if (!apiKey) {
			throw new Error("No credentials configured for Parallel.");
		}

		const response = await fetch(PARALLEL_SEARCH_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				max_results: maxResults,
			}),
			signal,
		});

		if (!response.ok) {
			throw await buildParallelError(response);
		}

		const data = (await response.json()) as ParallelSearchResponse;
		const rawResults = Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : undefined;
		if (!rawResults) {
			throw new Error("Parallel search returned an invalid response.");
		}

		const results = rawResults
			.map(normalizeParallelResult)
			.filter((result) => result !== undefined)
			.slice(0, maxResults);
		return buildWebSearchSuccess("parallel", query, results);
	},
};
