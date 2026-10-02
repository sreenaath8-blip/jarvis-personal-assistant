# JARVIS Personal Assistant

A browser-based voice assistant hosted on GitHub Pages. Chat requests go through the Cloudflare Worker in `worker.js`; the OpenAI API key is stored as a Worker secret, not in the website or repository.

## Deploy the Worker

1. In Cloudflare, open **Workers & Pages** and create a Worker named `jarvis-api-proxy`.
2. Open its code editor, replace the starter code with the contents of `worker.js`, and deploy.
3. In Worker **Settings → Variables and Secrets**, add these as secrets:
	- `OPENAI_API_KEY`: your OpenAI secret key.
	- `PROXY_ACCESS_TOKEN`: a separate, random token used by JARVIS to authenticate with the Worker.
4. Copy the Worker’s `workers.dev` URL. Do not put either secret in this repository.

## Connect JARVIS

1. Open the [published assistant](https://sreenaath8-blip.github.io/jarvis-personal-assistant/) and choose **Settings**.
2. Enter the Worker URL, model ID `gpt-6-luna`, and the same `PROXY_ACCESS_TOKEN` value configured in Cloudflare.
3. Save settings, refresh the page, and start a new conversation.

The Worker accepts requests only from this GitHub Pages origin. If you change the site domain, update `ALLOWED_ORIGIN` in `worker.js` before deploying. OpenAI API billing is separate from ChatGPT subscriptions.

## Run and voice

Open `index.html` in a modern browser to view the interface. The deployed Worker only allows requests from the published GitHub Pages site. Microphone input uses browser speech recognition, whose availability varies by browser; speech playback uses the browser's speech synthesis. Text entry remains available if voice input is unsupported.

## Privacy and storage

The website stores recent conversations and the Worker access token in that browser's local storage. The OpenAI API key stays in Cloudflare Worker secrets and is never sent to the browser. Anyone with access to the browser profile can use its saved Worker token, so don't share a signed-in browser profile. The Worker token is not the OpenAI key and must not be committed to GitHub.

## Features

- Responsive conversation workspace with recent chat history
- Authenticated Cloudflare Worker proxy for OpenAI Chat Completions
- Browser speech input, spoken replies, and per-reply read-aloud controls
- Keyboard support: Enter sends; Shift+Enter inserts a new line
- Clear loading, configuration, unsupported-browser, and request error states
