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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

  const data: GeminiResponse = await response.json();

  if (data.error) {
    if (data.error.message.toLowerCase().includes("quota")) {
      throw new Error("You have exceeded your Gemini API quota.");
    }
    throw new Error(data.error.message);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
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

  if (message.action === "enhancePrompt") {
    handleEnhancePrompt(message.text)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.action === "autoReply") {
    handleAutoReply(message.pageContent)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
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

async function handleEnhancePrompt(text: string): Promise<string> {
  // Get API key from storage
  const settings = await chrome.storage.sync.get(["apiKey"]);

  if (!settings.apiKey) {
    throw new Error("Please set your Gemini API key in the extension options.");
  }

  const prompt = `Enhance the following prompt to be more detailed and effective for large language models. Return ONLY the enhanced prompt without any explanations or additional comments:\n\n${text}`;

  return await callGeminiAPI(prompt, settings.apiKey);
}

async function handleAutoReply(pageContent: string): Promise<string> {
  const settings = await chrome.storage.sync.get(["apiKey"]);

  if (!settings.apiKey) {
    throw new Error("Please set your Gemini API key in the extension options.");
  }

  const prompt = `Based on the following page content, generate a concise and relevant reply. The reply should be suitable for a comment or a short message. Return only the suggested reply, without any introductory phrases like "Here's a reply:" or any other explanations.\n\nPage Content:\n"""\n${pageContent}\n"""\n\nSuggested Reply:`;

  return await callGeminiAPI(prompt, settings.apiKey);
}

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      if (command === "fix-grammar") {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fixGrammarShortcut" });
      } else if (command === "translate") {
        chrome.tabs.sendMessage(tabs[0].id, { action: "translateShortcut" });
      }
    }
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
