export {};

type AssistantMode = "grammar" | "translate";

type ProcessTextMessage = {
  type: "process-text";
  mode: AssistantMode;
  text: string;
  targetLanguage?: string;
};

const GEMINI_MODEL = "gemini-2.0-flash-exp";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const buildPrompt = (mode: AssistantMode, text: string, targetLanguage: string) => {
  const sanitizedText = text.trim();
  if (mode === "grammar") {
    return `Improve the grammar, spelling, and clarity of the text below while preserving its meaning. Respond with the corrected text only.\n\nText:\n${sanitizedText}`;
  }
  const language = targetLanguage?.trim() || "Spanish";
  return `Translate the text below into ${language}. Respond with the translation only.\n\nText:\n${sanitizedText}`;
};

const callGemini = async (message: ProcessTextMessage): Promise<string> => {
  const { geminiApiKey } = await chrome.storage.sync.get({
    geminiApiKey: "",
  });

  if (!geminiApiKey || typeof geminiApiKey !== "string") {
    throw new Error("Add your Gemini API key in the extension options first.");
  }

  const prompt = buildPrompt(message.mode, message.text, message.targetLanguage ?? "");

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(geminiApiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ?? `Gemini request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  const candidates = data?.candidates;
  const firstCandidate = Array.isArray(candidates) ? candidates[0] : undefined;
  const parts = firstCandidate?.content?.parts;

  const text = Array.isArray(parts)
    ? parts
        .map((part: { text?: string }) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim()
    : "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
};

chrome.runtime.onMessage.addListener((message: ProcessTextMessage, _sender, sendResponse) => {
  if (message?.type !== "process-text") {
    return;
  }

  if (!message.text || !message.text.trim()) {
    sendResponse({ error: "Please provide text to process." });
    return;
  }

  callGemini(message)
    .then((result) => sendResponse({ text: result }))
    .catch((error: unknown) =>
      sendResponse({
        error: error instanceof Error ? error.message : "Failed to process with Gemini.",
      })
    );

  return true;
});
