# JARVIS Personal Assistant

A private, voice-enabled AI assistant interface that runs directly in a modern browser. It uses browser speech recognition and speech synthesis, and connects to an OpenAI-compatible chat completions API that you configure.

## Run

Open `index.html` in a current desktop browser. For better microphone permissions and API CORS behavior, serve this folder locally instead of opening the file directly. If Python is installed, run `py -m http.server 4173` in this folder and visit `http://localhost:4173`.

No package install or build step is required.

## Connect an AI model

1. Open **Settings**.
2. Enter an OpenAI-compatible API base URL, such as `https://api.openai.com/v1`.
3. Enter a chat completions model name and your API key, then save.
4. Start a conversation. JARVIS sends the configured system prompt and conversation to `<base URL>/chat/completions`.

The API key is stored in this browser's local storage and sent directly from the browser to your chosen provider. Anyone with access to this browser profile can read it. Use this personal prototype only on a trusted device; do not deploy it publicly or use a shared browser profile. Provider browser requests must allow CORS. Local OpenAI-compatible servers may not need an API key.

## Voice

Microphone input uses the browser's Web Speech recognition implementation; availability and permission behavior vary by browser. Chrome and Edge generally provide speech recognition. Speech playback uses the browser's speech synthesis voices. Text entry remains available if voice features are unsupported.

## Privacy and storage

Settings and up to 40 recent conversations are saved in local browser storage. Messages are sent to the endpoint you configure. Use **Clear history** in the sidebar to delete saved conversations, and **Clear saved key** in Settings to remove the stored API key.

## Features

- Responsive conversation workspace with recent chat history
- OpenAI-compatible chat completions endpoint configuration
- Browser speech input, spoken replies, and per-reply read-aloud controls
- Keyboard support: Enter sends; Shift+Enter inserts a new line
- Explicit connection, loading, unsupported-browser, and request error states
