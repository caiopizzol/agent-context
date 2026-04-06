# agent-context

Which HTML embedding techniques survive AI agent pipelines?

Tests 15 content embedding techniques across 5 fetch methods to measure what AI agents actually see when they visit a webpage.

## Why

[llms.txt](https://llmstxt.org/) provides agent context as a separate file. Most agent pipelines never fetch it. This tests an alternative: embedding context directly in page HTML using techniques that survive the pipelines agents already use.

## Quick start

```sh
cp .env.example .env  # add your API keys
bun run benchmark.ts <url>
bun run audit.ts <url> "marker1" "marker2"
```

## Scripts

**`benchmark.ts`** - Plants 15 canary strings across different HTML techniques, then checks which ones each pipeline detects.

**`audit.ts`** - Checks whether specific content markers on a real site are visible to each pipeline.

## Pipelines tested

| Pipeline | Method |
|---|---|
| Raw fetch | Plain HTTP request |
| OpenAI web search | GPT-4.1-mini + web_search tool |
| Anthropic web fetch | Claude Haiku + web_fetch tool |
| Anthropic web search | Claude Haiku + web_search tool |

## Findings

DOM-rendered hidden text (sr-only, display:none, template, details) survives every pipeline that fetches the page. Metadata-only techniques (JSON-LD, HTML comments, data attributes) get stripped. Full writeup: [llms.txt has a delivery problem](https://caiopizzol.com/writing/llms-txt-has-a-delivery-problem).

## License

MIT
