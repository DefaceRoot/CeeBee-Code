import type { WebSearchProvider, WebSearchProviderSearchOptions } from "./base.js";

const ZAI_LIMITATION_MESSAGE =
	"Z.AI web search is not available yet: this coding-agent build does not include a remote MCP client for the Z.AI search endpoint.";

function ensureNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error("Operation aborted");
	}
}

export const zaiWebSearchProvider: WebSearchProvider = {
	id: "zai",
	name: "Z.AI",
	async isConfigured(ctx) {
		const apiKey = await ctx.modelRegistry.getApiKeyForProvider("zai");
		return apiKey !== undefined;
	},
	async search(options: WebSearchProviderSearchOptions) {
		ensureNotAborted(options.signal);
		const apiKey = await options.ctx.modelRegistry.getApiKeyForProvider("zai");
		if (!apiKey) {
			throw new Error("Z.AI web search requires ZAI_API_KEY.");
		}
		throw new Error(ZAI_LIMITATION_MESSAGE);
	},
};

export { ZAI_LIMITATION_MESSAGE };
