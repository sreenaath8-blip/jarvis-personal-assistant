(() => {
  "use strict";

  const SETTINGS_KEY = "jarvis.settings.v1";
  const THREADS_KEY = "jarvis.threads.v1";
  const SYSTEM_PROMPT = "You are JARVIS, a thoughtful, capable personal AI assistant. Be clear, practical, and concise. Ask a clarifying question when a request is ambiguous. Do not claim to perform actions outside this chat.";
  const elements = Object.fromEntries([
    "new-chat", "clear-history", "conversation-list", "connection-dot", "connection-label",
    "open-settings", "open-settings-sidebar", "settings-dialog", "settings-form", "close-settings",
    "api-base", "api-model", "api-key", "reveal-key", "clear-key", "save-settings", "speak-toggle",
    "welcome-screen", "messages", "conversation-scroll", "composer-form", "message-input", "send-button",
    "mic-button", "voice-stage", "voice-state-label", "voice-stage-hint", "waveform", "status-line",
    "toast", "time-greeting"
  ].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  let settings = readJson(SETTINGS_KEY, { baseUrl: "", model: "", apiKey: "", speak: true });
  let threads = readJson(THREADS_KEY, []);
  let activeThreadId = threads[0]?.id ?? null;
  let busy = false;
  let recognition = null;
  let isListening = false;
  let toastTimer = null;
  let activeSpeechButton = null;

  if (!Array.isArray(threads)) threads = [];
  if (typeof settings !== "object" || settings === null) settings = { baseUrl: "", model: "", apiKey: "", speak: true };
  if (!threads.length) createThread(false);

  function currentThread() {
    return threads.find((thread) => thread.id === activeThreadId) ?? null;
  }

  function persistThreads() {
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(0, 40)));
    } catch {
      showStatus("Browser storage is full; this conversation may not be saved.", true);
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      showToast("Could not save settings in this browser.");
    }
    updateConnectionState();
  }

  function createThread(shouldFocus = true) {
    stopSpeaking();
    const thread = { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, title: "New conversation", updatedAt: Date.now(), messages: [] };
    threads.unshift(thread);
    activeThreadId = thread.id;
    persistThreads();
    renderConversation();
    renderHistory();
    if (shouldFocus) elements.messageInput.focus();
  }

  function setActiveThread(threadId) {
    activeThreadId = threadId;
    stopSpeaking();
    renderConversation();
    renderHistory();
  }

  function renderHistory() {
    elements.conversationList.replaceChildren();
    const populated = threads.filter((thread) => thread.messages.some((message) => message.role === "user"));
    if (!populated.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Your conversations will appear here.";
      elements.conversationList.append(empty);
      return;
    }
    for (const thread of populated.slice(0, 18)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `history-item${thread.id === activeThreadId ? " selected" : ""}`;
      button.title = thread.title;
      const glyph = document.createElement("span");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = "◌";
      const title = document.createElement("span");
      title.textContent = thread.title;
      button.append(glyph, title);
      button.addEventListener("click", () => setActiveThread(thread.id));
      elements.conversationList.append(button);
    }
  }

  function renderConversation() {
    const thread = currentThread();
    elements.messages.replaceChildren();
    const hasMessages = Boolean(thread?.messages.length);
    elements.welcomeScreen.hidden = hasMessages;
    if (thread) {
      for (const message of thread.messages) appendMessageElement(message, false);
    }
    elements.conversationScroll.scrollTop = elements.conversationScroll.scrollHeight;
    renderHistory();
  }

  function appendMessageElement(message, scroll = true) {
    const row = document.createElement("article");
    row.className = `message-row ${message.role === "user" ? "user" : message.role === "error" ? "error" : "assistant"}`;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = message.role === "user" ? "YOU" : message.role === "error" ? "!" : "J";
    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.content;
    row.append(avatar, content);

    if (message.role === "assistant") {
      const tools = document.createElement("div");
      tools.className = "message-tools";
      const speak = document.createElement("button");
      speak.type = "button";
      speak.textContent = "Read aloud";
      speak.setAttribute("aria-label", "Read this response aloud");
      speak.addEventListener("click", () => speakText(message.content, speak));
      tools.append(speak);
      content.append(tools);
    }
    elements.messages.append(row);
    if (scroll) elements.conversationScroll.scrollTop = elements.conversationScroll.scrollHeight;
    return row;
  }

  function appendThinking() {
    const row = document.createElement("article");
    row.className = "message-row assistant";
    row.id = "thinking-row";
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "J";
    const content = document.createElement("div");
    content.className = "message-content";
    content.setAttribute("aria-label", "Assistant is thinking");
    const dots = document.createElement("div");
    dots.className = "thinking-indicator";
    for (let index = 0; index < 3; index += 1) dots.append(document.createElement("span"));
    content.append(dots);
    row.append(avatar, content);
    elements.messages.append(row);
    elements.conversationScroll.scrollTop = elements.conversationScroll.scrollHeight;
  }

  function updateConnectionState() {
    const configured = Boolean(settings.baseUrl?.trim() && settings.model?.trim());
    elements.connectionDot.classList.toggle("connected", configured);
    elements.connectionLabel.textContent = configured ? "Assistant connected" : "Setup required";
    elements.voiceStageHint.textContent = speechSupported() ? "TAP THE MIC TO SPEAK" : "VOICE INPUT UNAVAILABLE IN THIS BROWSER";
  }

  function speechSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function showStatus(message, isError = false) {
    elements.statusLine.textContent = message;
    elements.statusLine.classList.toggle("error", isError);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
  }

  function openSettings() {
    elements.apiBase.value = settings.baseUrl ?? "";
    elements.apiModel.value = settings.model ?? "";
    elements.apiKey.value = settings.apiKey ?? "";
    elements.speakToggle.checked = settings.speak !== false;
    elements.settingsDialog.showModal();
    window.setTimeout(() => (settings.baseUrl ? elements.apiModel : elements.apiBase).focus(), 20);
  }

  function normalizeEndpoint(baseUrl) {
    const clean = baseUrl.trim().replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(clean)) return clean;
    if (/\/v1$/i.test(clean)) return `${clean}/chat/completions`;
    return `${clean}/v1/chat/completions`;
  }

  function appendAssistantError(message) {
    const thread = currentThread();
    if (!thread) return;
    thread.messages.push({ role: "error", content: message });
    appendMessageElement(thread.messages.at(-1));
  }

  async function sendMessage(rawText) {
    const text = rawText.trim();
    if (!text || busy) return;
    if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
      showStatus("Connect an AI endpoint in Settings before sending a message.", true);
      openSettings();
      return;
    }
    let thread = currentThread();
    if (!thread) {
      createThread(false);
      thread = currentThread();
    }

    thread.messages.push({ role: "user", content: text });
    if (thread.title === "New conversation") thread.title = text.replace(/\s+/g, " ").slice(0, 42) || "New conversation";
    thread.updatedAt = Date.now();
    elements.messageInput.value = "";
    resizeComposer();
    persistThreads();
    renderConversation();
    busy = true;
    elements.sendButton.disabled = true;
    showStatus("Connecting to your model...", false);
    appendThinking();

    const requestMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...thread.messages.filter((message) => message.role === "user" || message.role === "assistant").map(({ role, content }) => ({ role, content }))
    ];
    const headers = { "Content-Type": "application/json" };
    if (settings.apiKey?.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

    try {
      const response = await fetch(normalizeEndpoint(settings.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({ model: settings.model.trim(), messages: requestMessages, temperature: 0.7 })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = payload?.error?.message || payload?.message || `The API returned HTTP ${response.status}.`;
        throw new Error(apiMessage);
      }
      const answer = payload?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("The endpoint returned no assistant text. Check that the selected model supports chat completions.");
      document.getElementById("thinking-row")?.remove();
      thread.messages.push({ role: "assistant", content: answer.trim() });
      thread.updatedAt = Date.now();
      persistThreads();
      appendMessageElement(thread.messages.at(-1));
      renderHistory();
      showStatus("");
      if (settings.speak !== false) speakText(answer.trim());
    } catch (error) {
      document.getElementById("thinking-row")?.remove();
      const message = error instanceof TypeError
        ? "Could not reach the endpoint. Check the URL, network, and whether this provider allows browser requests (CORS)."
        : error.message || "The request failed. Check your API settings and try again.";
      appendAssistantError(message);
      showStatus("The assistant could not complete that request.", true);
      elements.messageInput.value = text;
      resizeComposer();
      elements.messageInput.focus();
    } finally {
      busy = false;
      elements.sendButton.disabled = false;
      elements.conversationScroll.scrollTop = elements.conversationScroll.scrollHeight;
    }
  }

  function speakText(text, button = null) {
    if (!("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported by this browser.");
      return;
    }
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => {
      elements.voiceStage.classList.add("speaking");
      elements.voiceStateLabel.textContent = "SPEAKING RESPONSE";
      activeSpeechButton = button;
      if (button) button.textContent = "Stop reading";
    };
    utterance.onend = utterance.onerror = () => {
      elements.voiceStage.classList.remove("speaking");
      elements.voiceStateLabel.textContent = isListening ? "LISTENING TO YOU" : "READY WHEN YOU ARE";
      if (button) button.textContent = "Read aloud";
      activeSpeechButton = null;
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (activeSpeechButton) activeSpeechButton.textContent = "Read aloud";
    activeSpeechButton = null;
    elements.voiceStage.classList.remove("speaking");
    elements.voiceStateLabel.textContent = isListening ? "LISTENING TO YOU" : "READY WHEN YOU ARE";
  }

  function toggleListening() {
    if (isListening) {
      recognition?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input needs a browser that supports speech recognition, such as Chrome or Edge.");
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      isListening = true;
      elements.micButton.classList.add("recording");
      elements.micButton.setAttribute("aria-label", "Stop voice input");
      elements.micButton.title = "Stop voice input";
      elements.voiceStage.classList.add("active");
      elements.voiceStateLabel.textContent = "LISTENING TO YOU";
      showStatus("Listening... speak now.");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        elements.messageInput.value = transcript;
        resizeComposer();
        showStatus("Voice captured. Sending to your assistant...");
        sendMessage(transcript);
      }
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser’s site settings." : `Voice input error: ${event.error}.`;
      showStatus(message, true);
    };
    recognition.onend = () => {
      isListening = false;
      elements.micButton.classList.remove("recording");
      elements.micButton.setAttribute("aria-label", "Start voice input");
      elements.micButton.title = "Start voice input";
      elements.voiceStage.classList.remove("active");
      if (!busy && !elements.statusLine.classList.contains("error")) showStatus("");
      elements.voiceStateLabel.textContent = "READY WHEN YOU ARE";
    };
    try {
      recognition.start();
    } catch {
      showStatus("Voice input is already starting. Try again in a moment.", true);
    }
  }

  function resizeComposer() {
    elements.messageInput.style.height = "auto";
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 160)}px`;
  }

  function setGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
    elements.timeGreeting.textContent = `${greeting} · YOUR PERSONAL ASSISTANT`;
  }

  function initWaveform() {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 43; index += 1) {
      const bar = document.createElement("span");
      const distance = Math.abs(index - 21) / 21;
      const height = 5 + Math.round((1 - distance) * (7 + Math.random() * 15));
      bar.style.setProperty("--bar-height", `${height}px`);
      bar.style.setProperty("--duration", `${0.45 + Math.random() * 0.7}s`);
      bar.style.setProperty("--delay", `${Math.random() * -1.1}s`);
      fragment.append(bar);
    }
    elements.waveform.append(fragment);
  }

  elements.newChat.addEventListener("click", () => createThread());
  elements.openSettings.addEventListener("click", openSettings);
  elements.openSettingsSidebar.addEventListener("click", openSettings);
  elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
  elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) elements.settingsDialog.close();
  });
  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = {
      baseUrl: elements.apiBase.value.trim(),
      model: elements.apiModel.value.trim(),
      apiKey: elements.apiKey.value.trim(),
      speak: elements.speakToggle.checked
    };
    if (!settings.baseUrl || !settings.model) {
      showStatus("Enter an API base URL and model name.", true);
      return;
    }
    persistSettings();
    elements.settingsDialog.close();
    showStatus("");
    showToast("Settings saved in this browser.");
  });
  elements.revealKey.addEventListener("click", () => {
    const reveal = elements.apiKey.type === "password";
    elements.apiKey.type = reveal ? "text" : "password";
    elements.revealKey.textContent = reveal ? "Hide" : "Show";
  });
  elements.clearKey.addEventListener("click", () => {
    elements.apiKey.value = "";
    settings.apiKey = "";
    persistSettings();
    showToast("Saved API key cleared.");
  });
  elements.composerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(elements.messageInput.value);
  });
  elements.messageInput.addEventListener("input", resizeComposer);
  elements.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.composerForm.requestSubmit();
    }
  });
  elements.micButton.addEventListener("click", toggleListening);
  elements.clearHistory.addEventListener("click", () => {
    if (!threads.some((thread) => thread.messages.some((message) => message.role === "user"))) {
      showToast("There are no saved conversations to clear.");
      return;
    }
    if (!window.confirm("Clear all saved conversations from this browser?")) return;
    threads = [];
    activeThreadId = null;
    createThread(false);
    showToast("Conversation history cleared.");
  });
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.messageInput.value = button.dataset.prompt;
      resizeComposer();
      elements.composerForm.requestSubmit();
    });
  });

  initWaveform();
  setGreeting();
  updateConnectionState();
  renderHistory();
  renderConversation();
})();
