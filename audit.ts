/**
 * Agent Context Audit — checks what sr-only content each pipeline sees on a real site.
 *
 * Usage:
 *   bun run audit.ts <url> <marker1> <marker2> ...
 *
 * Example:
 *   bun run audit.ts https://caiopizzol.com "ECMA-376" "embedded C at Volvo" "FIPE" "brand.md" "Conclave"
 */

interface FetchResult {
	method: string;
	content: string;
	detected: Record<string, boolean>;
	error?: string;
}

const PROMPT = (url: string, markers: string[]) =>
	`Fetch the content at this URL: ${url}\n\nThis page contains specific phrases I need you to find. List EVERY one of these phrases that appears anywhere in the content you can see: ${markers.map((m) => `"${m}"`).join(", ")}. Output each found phrase on its own line, exactly as written. If a phrase is not found, don't mention it.`;

function detect(content: string, markers: string[]): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const m of markers) {
		const escaped = m.replace(/_/g, "\\_");
		result[m] =
			content.toLowerCase().includes(m.toLowerCase()) ||
			content.includes(escaped);
	}
	return result;
}

function emptyDetection(markers: string[]): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const m of markers) result[m] = false;
	return result;
}

async function fetchRawHTML(
	url: string,
	markers: string[],
): Promise<FetchResult> {
	const res = await fetch(url);
	const html = await res.text();
	return {
		method: "Raw Fetch",
		content: html,
		detected: detect(html, markers),
	};
}

async function fetchOpenAI(
	url: string,
	markers: string[],
): Promise<FetchResult> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey)
		return {
			method: "OpenAI",
			content: "",
			detected: emptyDetection(markers),
			error: "OPENAI_API_KEY not set",
		};
	const res = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-4.1-mini",
			tools: [{ type: "web_search", search_context_size: "high" }],
			input: PROMPT(url, markers),
		}),
	});
	const data = await res.json();
	if (data.error)
		return {
			method: "OpenAI",
			content: "",
			detected: emptyDetection(markers),
			error: data.error.message,
		};
	const text =
		data.output
			?.filter((o: any) => o.type === "message")
			.flatMap((o: any) => o.content || [])
			.filter((c: any) => c.type === "output_text")
			.map((c: any) => c.text || "")
			.join("\n") || "";
	return { method: "OpenAI", content: text, detected: detect(text, markers) };
}

async function fetchAnthropicFetch(
	url: string,
	markers: string[],
): Promise<FetchResult> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey)
		return {
			method: "Anthropic Fetch",
			content: "",
			detected: emptyDetection(markers),
			error: "ANTHROPIC_API_KEY not set",
		};
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
			tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 3 }],
			messages: [{ role: "user", content: PROMPT(url, markers) }],
		}),
	});
	const data = await res.json();
	if (data.error)
		return {
			method: "Anthropic Fetch",
			content: "",
			detected: emptyDetection(markers),
			error: data.error.message,
		};
	const text =
		data.content
			?.filter((c: any) => c.type === "text")
			.map((c: any) => c.text || "")
			.join("\n") || "";
	return {
		method: "Anthropic Fetch",
		content: text,
		detected: detect(text, markers),
	};
}

// ─── Main ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const url = args[0];
const markers = args.slice(1);

if (!url || markers.length === 0) {
	console.error('Usage: bun run audit.ts <url> "marker1" "marker2" ...');
	console.error(
		'Example: bun run audit.ts https://caiopizzol.com "ECMA-376" "Volvo" "FIPE"',
	);
	process.exit(1);
}

console.log(`\nAuditing: ${url}`);
console.log(`Markers: ${markers.join(", ")}\n`);

const results = await Promise.all([
	fetchRawHTML(url, markers),
	fetchOpenAI(url, markers),
	fetchAnthropicFetch(url, markers),
]);

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║              AGENT CONTEXT AUDIT                           ║");
console.log(
	"╚══════════════════════════════════════════════════════════════╝\n",
);

for (const r of results) {
	if (r.error) {
		console.log(`⚠  ${r.method}: ${r.error}\n`);
		continue;
	}
	const found = markers.filter((m) => r.detected[m]);
	console.log(`── ${r.method} (${found.length}/${markers.length}) ──`);
	for (const m of markers)
		console.log(`   ${r.detected[m] ? "✅" : "❌"}  ${m}`);
	console.log();
}

const valid = results.filter((r) => !r.error);
let header = "Marker".padEnd(30);
for (const r of valid) header += r.method.padEnd(18);
console.log(header);
console.log("─".repeat(30 + valid.length * 18));
for (const m of markers) {
	let row = m.slice(0, 28).padEnd(30);
	for (const r of valid) row += (r.detected[m] ? "✅" : "❌").padEnd(17) + " ";
	console.log(row);
}
console.log();
