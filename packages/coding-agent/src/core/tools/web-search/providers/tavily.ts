import { buildWebSearchSuccess, type WebSearchProvider } from "./base.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

type TavilySearchResult = {
	title?: string;
	url?: string;
	content?: string;
	snippet?: string;
	source?: string;
};

type TavilySearchResponse = {
	results?: TavilySearchResult[];
};

async function buildTavilyError(response: Response): Promise<Error> {
	const body = (await response.text()).trim();
	const suffix = body ? `: ${body}` : "";
	return new Error(`Tavily search failed (${response.status} ${response.statusText})${suffix}`);
}

function normalizeTavilyResult(result: TavilySearchResult) {
	if (!result.title || !result.url) {
		return undefined;
	}

	return {
		title: result.title,
		url: result.url,
		snippet: result.content ?? result.snippet ?? "",
		source: result.source,
	};
}

export const tavilyWebSearchProvider: WebSearchProvider = {
	id: "tavily",
	name: "Tavily",
	async isConfigured(ctx) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("tavily");
		return apiKey !== undefined;
	},
	async search({ query, maxResults, signal, ctx }) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("tavily");
		if (!apiKey) {
			throw new Error("No credentials configured for Tavily.");
		}

		const response = await fetch(TAVILY_SEARCH_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: apiKey,
				query,
				max_results: maxResults,
				search_depth: "basic",
				include_answer: false,
				include_images: false,
				include_raw_content: false,
			}),
			signal,
		});

		if (!response.ok) {
			throw await buildTavilyError(response);
		}

		const data = (await response.json()) as TavilySearchResponse;
		if (!Array.isArray(data.results)) {
			throw new Error("Tavily search returned an invalid response.");
		}

		const results = data.results
			.map(normalizeTavilyResult)
			.filter((result) => result !== undefined)
			.slice(0, maxResults);
		return buildWebSearchSuccess("tavily", query, results);
	},
};
