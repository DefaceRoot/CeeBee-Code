import type { ExtensionContext } from "../../../extensions/types.js";
import type { WebSearchProviderId, WebSearchResponse, WebSearchResultItem } from "../types.js";

export interface WebSearchProviderSearchOptions {
	query: string;
	maxResults: number;
	signal?: AbortSignal;
	ctx: ExtensionContext;
}

export interface WebSearchProvider {
	id: WebSearchProviderId;
	name: string;
	isConfigured(ctx: ExtensionContext): Promise<boolean>;
	search(options: WebSearchProviderSearchOptions): Promise<WebSearchResponse>;
}

export function createStubWebSearchProvider(id: WebSearchProviderId, name: string): WebSearchProvider {
	return {
		id,
		name,
		async isConfigured(ctx: ExtensionContext): Promise<boolean> {
			const apiKey = await ctx.modelRegistry.getApiKeyForProvider(id);
			return apiKey !== undefined;
		},
		async search(options: WebSearchProviderSearchOptions): Promise<WebSearchResponse> {
			if (options.signal?.aborted) {
				throw new Error("Operation aborted");
			}
			throw new Error(`${name} web search is not implemented yet.`);
		},
	};
}

export function buildWebSearchSuccess(
	provider: WebSearchProviderId,
	query: string,
	results: WebSearchResultItem[],
	warnings: string[] = [],
): WebSearchResponse {
	return {
		ok: true,
		provider,
		query,
		results,
		warnings,
	};
}
