import { Text } from "@mariozechner/pi-tui";
import { keyHint } from "../../../modes/interactive/components/keybinding-hints.js";
import type { ToolRenderResultOptions } from "../../extensions/types.js";
import { invalidArgText, str } from "../render-utils.js";
import type { WebSearchToolDetails, WebSearchToolInput } from "./types.js";
import { formatWebSearchAttempts, formatWebSearchResultItems } from "./utils.js";

function formatWebSearchCall(
	args: WebSearchToolInput | undefined,
	theme: typeof import("../../../modes/interactive/theme/theme.js").theme,
): string {
	const query = str(args?.query);
	const invalidArg = invalidArgText(theme);
	let text =
		theme.fg("toolTitle", theme.bold("web_search")) +
		" " +
		(query === null ? invalidArg : theme.fg("accent", JSON.stringify(query)));

	if (args?.provider) {
		text += theme.fg("toolOutput", ` via ${args.provider}`);
	}
	if (args?.maxResults !== undefined) {
		text += theme.fg("toolOutput", ` (${args.maxResults} results max)`);
	}
	return text;
}

function formatWebSearchResult(
	result: { details?: WebSearchToolDetails; content: Array<{ type: string; text?: string }> },
	options: ToolRenderResultOptions,
	theme: typeof import("../../../modes/interactive/theme/theme.js").theme,
): string {
	const response = result.details?.response;
	if (!response) {
		const fallbackText = result.content
			.filter((block) => block.type === "text")
			.map((block) => block.text ?? "")
			.join("\n")
			.trim();
		return fallbackText ? `\n${theme.fg("toolOutput", fallbackText)}` : "";
	}

	const lines = response.ok
		? formatWebSearchResultItems(response.results)
		: [response.error, ...formatWebSearchAttempts(response.attempts)];
	const warnings = response.ok ? response.warnings : [];
	const combinedLines = [...lines, ...warnings.map((warning) => `Warning: ${warning}`)];
	if (combinedLines.length === 0) {
		return "";
	}

	const maxLines = options.expanded ? combinedLines.length : 12;
	const displayLines = combinedLines.slice(0, maxLines);
	const remaining = combinedLines.length - displayLines.length;
	let text = `\n${displayLines.map((line) => theme.fg("toolOutput", line)).join("\n")}`;
	if (remaining > 0) {
		text += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${keyHint("app.tools.expand", "to expand")})`;
	}
	return text;
}

function getReusableText(lastComponent: unknown): Text {
	return lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
}

export function renderWebSearchCall(
	args: WebSearchToolInput,
	theme: typeof import("../../../modes/interactive/theme/theme.js").theme,
	context: { lastComponent: unknown },
): Text {
	const text = getReusableText(context.lastComponent);
	text.setText(formatWebSearchCall(args, theme));
	return text;
}

export function renderWebSearchResult(
	result: { details?: WebSearchToolDetails; content: Array<{ type: string; text?: string }> },
	options: ToolRenderResultOptions,
	theme: typeof import("../../../modes/interactive/theme/theme.js").theme,
	context: { lastComponent: unknown },
): Text {
	const text = getReusableText(context.lastComponent);
	text.setText(formatWebSearchResult(result, options, theme));
	return text;
}
