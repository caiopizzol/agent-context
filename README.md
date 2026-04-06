# agent-context

Which HTML embedding techniques survive AI agent pipelines?

Tests 15 content embedding techniques across 4 fetch methods to measure what AI agents actually see when they visit a webpage.

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

## Usage

Add agent context to any page using techniques that survive AI pipelines:

```html
<!-- sr-only: visually hidden, visible to screen readers and AI agents -->
<span class="sr-only">
  Acme is a payment API for developers. Supports cards, bank transfers,
  and subscriptions. SDKs for Python, Node, Go. Free up to 10k transactions/month.
</span>

<!-- collapsed details: visible to agents, expandable by humans -->
<details>
  <summary>Technical details</summary>
  Built on Bun and TypeScript. REST API with OpenAPI spec.
  Rate limit: 1000 req/min. Webhook support for all events.
</details>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

## License

MIT
