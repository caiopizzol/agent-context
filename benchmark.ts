/**
 * Agent Context Visibility Benchmark
 *
 * Tests which content embedding techniques survive different
 * web scraping/fetching methods used by AI agents.
 *
 * Usage:
 *   bun run benchmark.ts <url>
 *
 * Environment variables:
 *   OPENAI_API_KEY     — OpenAI API key (for responses API with web search)
 *   ANTHROPIC_API_KEY  — Anthropic API key (for web search/fetch tools)
 */

const CANARY_TECHNIQUES = {
	CANARY_META_DESCRIPTION: {
		name: "Meta Description",
		tag: '<meta name="description">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_META_AGENT: {
		name: "Custom Meta (agent-context)",
		tag: '<meta name="agent-context">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_META_AI_INSTRUCTIONS: {
		name: "Custom Meta (ai-instructions)",
		tag: '<meta name="ai-instructions">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_OG_DESCRIPTION: {
		name: "Open Graph Description",
		tag: '<meta property="og:description">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_JSONLD: {
		name: "JSON-LD Structured Data",
		tag: '<script type="application/ld+json">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_AGENT_SCRIPT: {
		name: "Agent Context Script (proposed)",
		tag: '<script type="application/agent+context">',
		humanVisible: false,
		category: "proposed",
	},
	CANARY_HTML_COMMENT: {
		name: "HTML Comment",
		tag: "<!-- -->",
		humanVisible: false,
		category: "standard",
	},
	CANARY_SR_ONLY: {
		name: "Visually Hidden (sr-only)",
		tag: '<span class="sr-only">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_DISPLAY_NONE: {
		name: "CSS display:none",
		tag: '<div style="display:none">',
		humanVisible: false,
		category: "standard",
	},
	CANARY_DATA_ATTR: {
		name: "data-* Attribute",
		tag: "data-agent-context",
		humanVisible: false,
		category: "standard",
	},
	CANARY_ARIA_LABEL: {
		name: "aria-label Attribute",
		tag: "aria-label",
		humanVisible: false,
		category: "standard",
	},
	CANARY_DETAILS: {
		name: "<details> (collapsed)",
		tag: "<details>",
		humanVisible: true,
		category: "standard",
	},
	CANARY_TEMPLATE: {
		name: "<template> Element",
		tag: "<template>",
		humanVisible: false,
		category: "standard",
	},
	CANARY_NOSCRIPT: {
		name: "<noscript>",
		tag: "<noscript>",
		humanVisible: false,
		category: "standard",
	},
	CANARY_MICRODATA: {
		name: "Microdata (itemprop)",
		tag: "itemprop on hidden element",
		humanVisible: false,
		category: "standard",
	},
} as const;

type CanaryKey = keyof typeof CANARY_TECHNIQUES;

interface FetchResult {
	method: string;
	content: string;
	detected: Record<CanaryKey, boolean>;
	rawResponse?: unknown;
	error?: string;
}

// Prompt shared across all AI-based fetchers
const CANARY_PROMPT = (url: string) =>
	`Fetch the content at this URL: ${url}\n\nThis page contains hidden test markers that start with "CANARY_". Your task is to find and list EVERY string that begins with "CANARY_" anywhere on the page — in the visible text, metadata, structured data, HTML attributes, comments, hidden elements, or any other location. Output each CANARY_ string you find on its own line, exactly as written.`;

// ─── Fetchers ────────────────────────────────────────────────────

async function fetchRawHTML(url: string): Promise<FetchResult> {
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; AgentContextBenchmark/1.0)",
			},
		});
		const html = await res.text();
		return { method: "Raw Fetch", content: html, detected: detect(html) };
	} catch (e) {
		return {
			method: "Raw Fetch",
			content: "",
			detected: emptyDetection(),
			error: String(e),
		};
	}
}

async function fetchOpenAIWebSearch(url: string): Promise<FetchResult> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey)
		return {
			method: "OpenAI Web Search",
			content: "",
			detected: emptyDetection(),
			error: "OPENAI_API_KEY not set",
		};

	try {
		const res = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "gpt-4.1-mini",
				tools: [{ type: "web_search", search_context_size: "high" }],
				input: CANARY_PROMPT(url),
			}),
		});

		const data = await res.json();

		if (data.error) {
			return {
				method: "OpenAI Web Search",
				content: "",
				detected: emptyDetection(),
				rawResponse: data,
				error: data.error.message,
			};
		}

		const text =
			data.output
				?.filter((o: { type: string }) => o.type === "message")
				.flatMap(
					(o: { content?: Array<{ type: string; text?: string }> }) =>
						o.content || [],
				)
				.filter((c: { type: string }) => c.type === "output_text")
				.map((c: { text?: string }) => c.text || "")
				.join("\n") || "";

		return {
			method: "OpenAI Web Search",
			content: text,
			detected: detect(text),
			rawResponse: data,
		};
	} catch (e) {
		return {
			method: "OpenAI Web Search",
			content: "",
			detected: emptyDetection(),
			error: String(e),
		};
	}
}

async function fetchAnthropicWebFetch(url: string): Promise<FetchResult> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey)
		return {
			method: "Anthropic Web Fetch",
			content: "",
			detected: emptyDetection(),
			error: "ANTHROPIC_API_KEY not set",
		};

	try {
		const res = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-haiku-4-5",
				max_tokens: 4096,
				tools: [
					{
						type: "web_fetch_20250910",
						name: "web_fetch",
						max_uses: 3,
					},
				],
				messages: [
					{
						role: "user",
						content: CANARY_PROMPT(url),
					},
				],
			}),
		});

		const data = await res.json();

		if (data.error) {
			return {
				method: "Anthropic Web Fetch",
				content: "",
				detected: emptyDetection(),
				rawResponse: data,
				error: data.error.message,
			};
		}

		const text =
			data.content
				?.filter((c: { type: string }) => c.type === "text")
				.map((c: { text?: string }) => c.text || "")
				.join("\n") || "";

		return {
			method: "Anthropic Web Fetch",
			content: text,
			detected: detect(text),
			rawResponse: data,
		};
	} catch (e) {
		return {
			method: "Anthropic Web Fetch",
			content: "",
			detected: emptyDetection(),
			error: String(e),
		};
	}
}

// ─── Detection ───────────────────────────────────────────────────

function detect(content: string): Record<CanaryKey, boolean> {
	const result = {} as Record<CanaryKey, boolean>;
	for (const key of Object.keys(CANARY_TECHNIQUES) as CanaryKey[]) {
		const escaped = key.replace(/_/g, "\\_");
		result[key] = content.includes(key) || content.includes(escaped);
	}
	return result;
}

function emptyDetection(): Record<CanaryKey, boolean> {
	const result = {} as Record<CanaryKey, boolean>;
	for (const key of Object.keys(CANARY_TECHNIQUES) as CanaryKey[]) {
		result[key] = false;
	}
	return result;
}

// ─── Output ──────────────────────────────────────────────────────

function printResults(results: FetchResult[]) {
	const techniques = Object.keys(CANARY_TECHNIQUES) as CanaryKey[];

	console.log(
		"\n╔══════════════════════════════════════════════════════════════╗",
	);
	console.log(
		"║         AGENT CONTEXT VISIBILITY BENCHMARK                  ║",
	);
	console.log(
		"╚══════════════════════════════════════════════════════════════╝\n",
	);

	for (const result of results) {
		if (result.error) {
			console.log(`⚠  ${result.method}: ${result.error}\n`);
			continue;
		}

		console.log(`── ${result.method} ──`);
		console.log(
			`   Content length: ${result.content.length.toLocaleString()} chars`,
		);
		const found = techniques.filter((k) => result.detected[k]);
		console.log(`   Detected: ${found.length}/${techniques.length}\n`);

		for (const key of techniques) {
			const info = CANARY_TECHNIQUES[key];
			const icon = result.detected[key] ? "✅" : "❌";
			const label = info.category === "proposed" ? `${info.name} ★` : info.name;
			console.log(`   ${icon}  ${label.padEnd(35)} ${info.tag}`);
		}
		console.log();
	}

	// Comparison matrix
	console.log("── COMPARISON MATRIX ──\n");

	const methodNames = results.filter((r) => !r.error).map((r) => r.method);
	const colWidth = 12;

	let header = "Technique".padEnd(36);
	for (const name of methodNames) {
		header += name.slice(0, colWidth).padEnd(colWidth);
	}
	console.log(header);
	console.log("─".repeat(36 + methodNames.length * colWidth));

	for (const key of techniques) {
		const info = CANARY_TECHNIQUES[key];
		let row = info.name.padEnd(36);
		for (const result of results.filter((r) => !r.error)) {
			row += (result.detected[key] ? "✅" : "❌").padEnd(colWidth - 1) + " ";
		}
		console.log(row);
	}

	console.log(`\n${"─".repeat(36 + methodNames.length * colWidth)}`);
	let totalsRow = "TOTAL DETECTED".padEnd(36);
	for (const result of results.filter((r) => !r.error)) {
		const count = techniques.filter((k) => result.detected[k]).length;
		totalsRow += `${count}/${techniques.length}`.padEnd(colWidth);
	}
	console.log(totalsRow);

	// Key findings
	console.log("\n── KEY FINDINGS ──\n");

	const validResults = results.filter((r) => !r.error);
	for (const key of techniques) {
		const info = CANARY_TECHNIQUES[key];
		const detectedBy = validResults
			.filter((r) => r.detected[key])
			.map((r) => r.method);

		if (detectedBy.length === validResults.length) {
			console.log(`   🟢 ${info.name}: Universal — visible to ALL methods`);
		} else if (detectedBy.length === 0) {
			console.log(`   🔴 ${info.name}: Invisible — no method detected it`);
		} else {
			const missedBy = validResults
				.filter((r) => !r.detected[key])
				.map((r) => r.method);
			console.log(
				`   🟡 ${info.name}: Partial — seen by [${detectedBy.join(", ")}], missed by [${missedBy.join(", ")}]`,
			);
		}
	}
}

// ─── Main ────────────────────────────────────────────────────────

const url = process.argv[2];

if (!url) {
	console.error("Usage: bun run benchmark.ts <url>");
	process.exit(1);
}

console.log(`\nBenchmarking: ${url}\n`);
console.log("Running fetchers in parallel...\n");

const results = await Promise.all([
	fetchRawHTML(url),
	fetchOpenAIWebSearch(url),
	fetchAnthropicWebFetch(url),
]);

printResults(results);

// Save results
const outputDir = "results";
const timestamp = Date.now();
await Bun.write(
	`${outputDir}/run-${timestamp}.json`,
	JSON.stringify(
		results.map((r) => ({
			method: r.method,
			error: r.error,
			contentLength: r.content.length,
			detected: r.detected,
			contentPreview: r.content.slice(0, 3000),
		})),
		null,
		2,
	),
);

await Bun.write(
	`${outputDir}/raw-${timestamp}.json`,
	JSON.stringify(
		results
			.filter((r) => r.rawResponse)
			.map((r) => ({
				method: r.method,
				rawResponse: r.rawResponse,
			})),
		null,
		2,
	),
);

console.log(`\nResults saved to ${outputDir}/run-${timestamp}.json`);
console.log(`Raw responses saved to ${outputDir}/raw-${timestamp}.json`);
