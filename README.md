[![Join our Discord!](https://img.shields.io/static/v1?message=join%20chat&color=9cf&logo=discord&label=discord)](https://discord.gg/sKeNQX4Wtj)
[![Netlify Status](https://api.netlify.com/api/v1/badges/27fa023d-7c73-4a3f-9791-b3b657a47100/deploy-status)](https://app.netlify.com/sites/mermaidjs/deploys)

# Mermaid Live Editor

Edit, preview and share mermaid charts/diagrams.

## Features

- Edit and preview flowcharts, sequence diagrams, gantt diagrams in real time.
- Auto-save diagrams to local files (File System Access API supported browsers)
- Open and edit existing `.mmd` files with automatic saving
- Save the result as a svg, PNG, or PDF
- Get a link to a viewer of the diagram so that you can share it with others.
- Get a link to edit the diagram so that someone else can tweak it and send a new link back

## Live demo

You can try out a [live version](https://mermaid.live/).

# Contributors are welcome!

If you want to speed up the progress for mermaid-live-editor, join the Discord channel and contact knsv.

## Docker

### Run published image

```bash
docker run --platform linux/amd64 --publish 8000:8080 ghcr.io/mermaid-js/mermaid-live-editor
```

### To configure renderer URL

When building set the MERMAID_RENDERER_URL build argument to the rendering
service.
Example:
Default is`https://mermaid.ink`.
Set to empty string to disable PNG and SVG links under Actions

### To configure Kroki Instance URL

When building set the MERMAID_KROKI_RENDERER_URL build argument to your Kroki
instance.
Default is `https://kroki.io`
Set to empty string to disable Kroki link under Actions

### To configure Analytics

When building set the MERMAID_ANALYTICS_URL build argument to your plausible instance, and MERMAID_DOMAIN to your domain.

Default is empty, disabling analytics.

### To enable Mermaid Chart links and promotion

When building set the MERMAID_IS_ENABLED_MERMAID_CHART_LINKS build argument to `true`

Default is empty, disabling button to save to Mermaid Chart and promotional banner.

### To update the Security modal

The modal shown on clicking the security link assumes analytics, renderer, Kroki
and Mermaid chart are enabled. You can update it by modifying `Privacy.svelte`
if you wish.

### Development

```bash
docker compose up --build
```

Then open http://localhost:3000

### Building and running images locally

#### Build

```bash
docker build -t mermaid-js/mermaid-live-editor .
```

#### Run

```bash
docker run --detach --name mermaid-live-editor --publish 8080:8080 mermaid-js/mermaid-live-editor
```

Visit: <http://localhost:8080>

#### Stop

```bash
docker stop mermaid-live-editor
```

## Setup

Below link will help you making a copy of the repository in your local system.

https://docs.github.com/en/get-started/quickstart/fork-a-repo

## Requirements

- [Node.js](https://nodejs.org/en/) current LTS version
- [pnpm](https://pnpm.io/) package manager. Install with `corepack enable pnpm`

## Development

```sh
pnpm install
pnpm dev -- --open
```

This app is created with Svelte Kit.

## Environment variables

This project exposes several build-time and runtime environment variables (prefixed with `MERMAID_`) that control rendering, external integrations and features. Vite is configured with `envPrefix: 'MERMAID_'` so variables must start with `MERMAID_`.

Important variables

- `MERMAID_RENDERER_URL` — URL used to generate PNG/SVG preview links (default: empty). Example: `https://mermaid.ink`.
- `MERMAID_KROKI_RENDERER_URL` — Kroki instance base URL for SVG/PNG exports (default: empty). Example: `https://kroki.io`.
- `MERMAID_ANALYTICS_URL` — Plausible analytics endpoint (default: empty).
- `MERMAID_DOMAIN` — Domain sent to analytics (default: empty).
- `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` — When set to the string 'true' enables "Save to Mermaid Chart" and related links. If 'true', the app will open links at `https://mermaidchart.com` by default. (default: disabled)

How the "Save" redirect works

- When `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` is 'true', the app builds a save URL using `MCBaseURL` which defaults to `https://mermaidchart.com` and opens `MCBaseURL/app/plugin/save?state=...`. To prevent the app from redirecting to mermaidchart.com, run locally with the feature disabled (see examples below).

Setting variables for local development

- Using a `.env` file (recommended): create a file named `.env` in the project root and add variables, for example:

```
MERMAID_RENDERER_URL=https://mermaid.ink
MERMAID_KROKI_RENDERER_URL=https://kroki.io
MERMAID_ANALYTICS_URL=
MERMAID_DOMAIN=
MERMAID_IS_ENABLED_MERMAID_CHART_LINKS=false
```

- Temporary (one-off) in PowerShell:

```powershell
$Env:MERMAID_IS_ENABLED_MERMAID_CHART_LINKS='false'
pnpm dev
```

- Temporary (one-off) in Bash:

```bash
MERMAID_IS_ENABLED_MERMAID_CHART_LINKS=false pnpm dev
```

Building Docker images with specific values

- The `Dockerfile` accepts build args for these variables. Example disabling Mermaid Chart links at build time:

```bash
docker build \
	--build-arg MERMAID_IS_ENABLED_MERMAID_CHART_LINKS=false \
	--build-arg MERMAID_RENDERER_URL=https://mermaid.ink \
	-t mermaid-js/mermaid-live-editor .
```

Checking the effective value in the running app

- Open browser DevTools console in the Vite dev server and inspect:

```js
import.meta.env.MERMAID_IS_ENABLED_MERMAID_CHART_LINKS;
```

Or check your shell environment:

PowerShell:

```powershell
echo $Env:MERMAID_IS_ENABLED_MERMAID_CHART_LINKS
```

Bash:

```bash
echo $MERMAID_IS_ENABLED_MERMAID_CHART_LINKS
```

Notes

- `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` must equal the string `true` (not boolean true) to be considered enabled by the app.
- The Docker image uses build-time args (see `Dockerfile`) — those values are baked into the build output.
- Use caution enabling external links in public or embedded deployments if you want to avoid sending serialized diagram state externally.

## Release

When a PR is created targeting master, it will be built and deployed by Netlify.
The URL will be indicated in a Comment in the PR.

Once the PR is merged, it will automatically be released.
