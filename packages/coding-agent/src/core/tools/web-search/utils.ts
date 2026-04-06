import type { WebSearchAttempt, WebSearchResponse, WebSearchResultItem } from "./types.js";

const DEFAULT_MAX_RESULTS = 5;
const MIN_MAX_RESULTS = 1;
const MAX_MAX_RESULTS = 10;

export function clampWebSearchMaxResults(maxResults: number | undefined): number {
	if (maxResults === undefined || !Number.isFinite(maxResults)) {
		return DEFAULT_MAX_RESULTS;
	}
	return Math.max(MIN_MAX_RESULTS, Math.min(MAX_MAX_RESULTS, Math.trunc(maxResults)));
}

export function normalizeWebSearchError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function formatWebSearchResultItems(results: WebSearchResultItem[]): string[] {
	return results.flatMap((result, index) => {
		const lines = [`${index + 1}. ${result.title}`, `   ${result.url}`];
		if (result.source) {
			lines.push(`   Source: ${result.source}`);
		}
		if (result.snippet) {
			lines.push(`   ${result.snippet}`);
		}
		return lines;
	});
}

export function formatWebSearchAttempts(attempts: WebSearchAttempt[]): string[] {
	return attempts.map((attempt) => `- ${attempt.provider}: ${attempt.status} (${attempt.reason})`);
}

export function formatWebSearchResponseText(response: WebSearchResponse): string {
	if (response.ok) {
		const warningLines = response.warnings.map((warning) => `Warning: ${warning}`);
		return [...formatWebSearchResultItems(response.results), ...warningLines].join("\n");
	}

	const attemptLines = formatWebSearchAttempts(response.attempts);
	return [response.error, ...attemptLines].join("\n");
}
