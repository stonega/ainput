// Background script for handling Gemini API calls

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from API");
  }

  return data.candidates[0].content.parts[0].text;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fixGrammar") {
    handleFixGrammar(message.text)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.action === "translate") {
    handleTranslate(message.text)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function handleFixGrammar(text: string): Promise<string> {
  // Get API key from storage
  const settings = await chrome.storage.sync.get(["apiKey"]);

  if (!settings.apiKey) {
    throw new Error("Please set your Gemini API key in the extension options.");
  }

  const prompt = `Fix the grammar and spelling in the following text. Return ONLY the corrected text without any explanations or additional comments:\n\n${text}`;

  return await callGeminiAPI(prompt, settings.apiKey);
}

async function handleTranslate(text: string): Promise<string> {
  // Get API key and target language from storage
  const settings = await chrome.storage.sync.get(["apiKey", "targetLanguage"]);

  if (!settings.apiKey) {
    throw new Error("Please set your Gemini API key in the extension options.");
  }

  const targetLanguage = settings.targetLanguage || "Spanish";

  const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any explanations or additional comments:\n\n${text}`;

  return await callGeminiAPI(prompt, settings.apiKey);
}
