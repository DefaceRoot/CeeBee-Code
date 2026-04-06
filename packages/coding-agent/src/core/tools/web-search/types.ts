import { type Static, Type } from "@sinclair/typebox";

export const WEB_SEARCH_PROVIDER_IDS = ["tavily", "perplexity", "zai", "parallel"] as const;

export type WebSearchProviderId = (typeof WEB_SEARCH_PROVIDER_IDS)[number];

export const webSearchSchema = Type.Object({
	query: Type.String({ description: "Search query to run on the web" }),
	provider: Type.Optional(
		Type.Union(
			WEB_SEARCH_PROVIDER_IDS.map((providerId) => Type.Literal(providerId)),
			{ description: "Preferred search provider (default: automatic fallback order)" },
		),
	),
	maxResults: Type.Optional(Type.Number({ description: "Maximum number of results to return (default: 5)" })),
});

export type WebSearchToolInput = Static<typeof webSearchSchema>;

export interface WebSearchResultItem {
	title: string;
	url: string;
	snippet: string;
	source?: string;
}

export interface WebSearchAttempt {
	provider: WebSearchProviderId;
	status: "skipped" | "failed";
	reason: string;
}

export interface WebSearchSuccess {
	ok: true;
	provider: WebSearchProviderId;
	query: string;
	results: WebSearchResultItem[];
	warnings: string[];
}

export interface WebSearchFailure {
	ok: false;
	query: string;
	attempts: WebSearchAttempt[];
	error: string;
	provider?: WebSearchProviderId;
}

export type WebSearchResponse = WebSearchSuccess | WebSearchFailure;

export interface WebSearchToolDetails {
	response: WebSearchResponse;
}
