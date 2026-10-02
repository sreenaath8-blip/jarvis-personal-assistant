const ALLOWED_ORIGIN = "https://sreenaath8-blip.github.io";
const CHAT_PATH = "/v1/chat/completions";
const MAX_BODY_BYTES = 1_000_000;

function responseHeaders(origin) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function jsonResponse(origin, status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: responseHeaders(origin)
  });
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (origin !== ALLOWED_ORIGIN) {
      return jsonResponse(null, 403, "This site is not allowed to use the assistant proxy.");
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: responseHeaders(origin)
      });
    }

    if (url.pathname !== CHAT_PATH) {
      return jsonResponse(origin, 404, "Unknown Worker route.");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }

    if (request.method !== "POST") {
      return jsonResponse(origin, 405, "Only POST requests are supported.");
    }

    if (!env.OPENAI_API_KEY || !env.PROXY_ACCESS_TOKEN) {
      return jsonResponse(origin, 503, "The Worker is missing its required secrets.");
    }

    const suppliedToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(suppliedToken, env.PROXY_ACCESS_TOKEN)) {
      return jsonResponse(origin, 401, "Worker access token is invalid.");
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(origin, 413, "Request is too large.");
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(origin, 400, "Request body must be valid JSON.");
    }

    if (typeof payload?.model !== "string" || !Array.isArray(payload.messages)) {
      return jsonResponse(origin, 400, "A model and messages array are required.");
    }

    try {
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: payload.model, messages: payload.messages })
      });
      const headers = responseHeaders(origin);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      const requestId = upstream.headers.get("x-request-id");
      if (requestId) headers.set("X-Request-Id", requestId);
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return jsonResponse(origin, 502, "The Worker could not reach the OpenAI API.");
    }
  }
};
