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

## Findings

Five DOM-rendered techniques survive every pipeline that fetches the page: sr-only, display:none, details, template, noscript. Metadata-only techniques (JSON-LD, HTML comments, data attributes) get stripped.

Not all survivors are equal. Based on the [HTML spec](https://html.spec.whatwg.org/), accessibility behavior, and search engine treatment:

| Technique | Screen readers | Google-safe | Semantic fit |
|---|---|---|---|
| `<details>` | ✓ | ✓ indexed as progressive disclosure | ✓ "additional information" |
| sr-only (CSS) | ✓ | ⚠ fine for small text, risky if large | ⚠ accessibility convention |
| `<noscript>` | – | ⚠ cloaking risk | ✗ no-JS fallback |
| `<template>` | – | neutral | ✗ JS templating |
| `display:none` | – | ✗ cloaking signal | ✗ removed from a11y tree |

Full writeup: [llms.txt has a delivery problem](https://caiopizzol.com/writing/llms-txt-has-a-delivery-problem).

## Usage

Use `<details>` for structured context (indexed by Google, expandable by humans) and sr-only for short descriptions (accessible, invisible):

```html
<!-- details: indexed by Google, expandable by humans, read by agents -->
<details>
  <summary>About this product</summary>
  Acme is a payment API for developers. Supports cards, bank transfers,
  and subscriptions. SDKs for Python, Node, Go. Free up to 10k transactions/month.
  REST API with OpenAPI spec. Rate limit: 1000 req/min.
</details>

<!-- sr-only: visually hidden, accessible to screen readers and agents -->
<span class="sr-only">
  Acme: payment API for developers. Cards, bank transfers, subscriptions.
</span>

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
