import type { ExtensionContext } from "../../extensions/types.js";
import type { WebSearchProvider } from "./providers/base.js";
import { parallelWebSearchProvider } from "./providers/parallel.js";
import { perplexityWebSearchProvider } from "./providers/perplexity.js";
import { tavilyWebSearchProvider } from "./providers/tavily.js";
import { zaiWebSearchProvider } from "./providers/zai.js";
import type { WebSearchAttempt, WebSearchProviderId, WebSearchResponse, WebSearchToolInput } from "./types.js";
import { normalizeWebSearchError } from "./utils.js";

export const WEB_SEARCH_FALLBACK_ORDER: readonly WebSearchProviderId[] = ["tavily", "perplexity", "zai", "parallel"];

const webSearchProviders: Record<WebSearchProviderId, WebSearchProvider> = {
	tavily: tavilyWebSearchProvider,
	perplexity: perplexityWebSearchProvider,
	zai: zaiWebSearchProvider,
	parallel: parallelWebSearchProvider,
};

export function getWebSearchProvider(providerId: WebSearchProviderId): WebSearchProvider {
	return webSearchProviders[providerId];
}

export function getWebSearchProviders(): WebSearchProvider[] {
	return WEB_SEARCH_FALLBACK_ORDER.map((providerId) => webSearchProviders[providerId]);
}

export async function executeWebSearch(
	input: WebSearchToolInput,
	ctx: ExtensionContext,
	signal?: AbortSignal,
): Promise<WebSearchResponse> {
	const attempts: WebSearchAttempt[] = [];
	const selectedProviders = input.provider ? [getWebSearchProvider(input.provider)] : getWebSearchProviders();

	for (const provider of selectedProviders) {
		const isConfigured = await provider.isConfigured(ctx);
		if (!isConfigured) {
			attempts.push({
				provider: provider.id,
				status: "skipped",
				reason: `No credentials configured for ${provider.name}.`,
			});
			continue;
		}

		try {
			return await provider.search({
				query: input.query,
				maxResults: input.maxResults ?? 5,
				signal,
				ctx,
			});
		} catch (error) {
			attempts.push({
				provider: provider.id,
				status: "failed",
				reason: normalizeWebSearchError(error),
			});
		}
	}

	const requestedProviderSuffix = input.provider ? ` for provider "${input.provider}"` : "";
	return {
		ok: false,
		query: input.query,
		provider: input.provider,
		attempts,
		error:
			attempts.length > 0
				? `Web search is unavailable${requestedProviderSuffix}.`
				: `No web search providers are registered${requestedProviderSuffix}.`,
	};
}
