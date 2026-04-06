import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Static } from "@sinclair/typebox";
import type { ToolDefinition } from "../../extensions/types.js";
import { wrapToolDefinition } from "../tool-definition-wrapper.js";
import { executeWebSearch } from "./provider.js";
import { renderWebSearchCall, renderWebSearchResult } from "./render.js";
import { type WebSearchToolDetails, type WebSearchToolInput, webSearchSchema } from "./types.js";
import { clampWebSearchMaxResults, formatWebSearchResponseText } from "./utils.js";

export function createWebSearchToolDefinition(
	_cwd: string,
): ToolDefinition<typeof webSearchSchema, WebSearchToolDetails> {
	return {
		name: "web_search",
		label: "web_search",
		description:
			"Search the web using the first configured built-in search provider. Supports provider fallback and returns summarized result snippets.",
		promptSnippet: "Search the web using configured built-in search providers",
		parameters: webSearchSchema,
		async execute(_toolCallId, params: Static<typeof webSearchSchema>, signal, _onUpdate, ctx) {
			const normalizedInput: WebSearchToolInput = {
				...params,
				maxResults: clampWebSearchMaxResults(params.maxResults),
			};
			const response = await executeWebSearch(normalizedInput, ctx, signal);
			return {
				content: [{ type: "text", text: formatWebSearchResponseText(response) }],
				details: { response },
			};
		},
		renderCall(args, theme, context) {
			return renderWebSearchCall(args, theme, {
				lastComponent: context.lastComponent,
			});
		},
		renderResult(result, options, theme, context) {
			return renderWebSearchResult(result, options, theme, {
				lastComponent: context.lastComponent,
			});
		},
	};
}

export function createWebSearchTool(cwd: string): AgentTool<typeof webSearchSchema> {
	return wrapToolDefinition(createWebSearchToolDefinition(cwd));
}

export { getWebSearchProvider, getWebSearchProviders, WEB_SEARCH_FALLBACK_ORDER } from "./provider.js";
export type {
	WebSearchProviderId,
	WebSearchResponse,
	WebSearchResultItem,
	WebSearchToolDetails,
	WebSearchToolInput,
} from "./types.js";

/** Default web_search tool using process.cwd() for backwards compatibility. */
export const webSearchToolDefinition = createWebSearchToolDefinition(process.cwd());
export const webSearchTool = createWebSearchTool(process.cwd());
