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

interface OpenAIResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

interface AnthropicResponse {
  content?: Array<{
    text: string;
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

async function callOpenAIAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  isCustom: boolean
): Promise<string> {
  const url = `${baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (!isCustom) {
    headers["HTTP-Referer"] = "https://github.com/stonega/ainput";
    headers["X-Title"] = "AInput";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const data: OpenAIResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from API");
  }

  return data.choices[0].message.content;
}

async function callAnthropicAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<string> {
  const url = `${baseUrl}/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    }),
  });

  const data: AnthropicResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  if (!data.content || data.content.length === 0) {
    throw new Error("No response from API");
  }

  return data.content[0].text;
}

async function callApi(prompt: string): Promise<string> {
  const settings = await chrome.storage.sync.get([
    "models",
    "activeModelId",
    "apiKey",
  ]);

  if (settings.models && settings.activeModelId) {
    const activeModel = settings.models.find(
      (m: any) => m.id === settings.activeModelId
    );
    if (!activeModel) {
      throw new Error("Active model not found. Please check your settings.");
    }

    if (activeModel.type === "gemini") {
      return callGeminiAPI(prompt, activeModel.apiKey);
    } else if (
      activeModel.type === "openai" ||
      activeModel.type === "openrouter" ||
      activeModel.type === "custom"
    ) {
      return callOpenAIAPI(
        prompt,
        activeModel.apiKey,
        activeModel.baseUrl,
        activeModel.model,
        activeModel.type === "custom"
      );
    } else if (activeModel.type === "anthropic") {
      return callAnthropicAPI(
        prompt,
        activeModel.apiKey,
        activeModel.baseUrl,
        activeModel.model
      );
    } else {
      throw new Error(`Unsupported model type: ${activeModel.type}`);
    }
  } else if (settings.models && !settings.activeModelId) {
    throw new Error("Please select an active model in the extension options.");
  } else if (settings.apiKey) {
    // Legacy support for old settings
    return callGeminiAPI(prompt, settings.apiKey);
  } else {
    throw new Error(
      "No API key or model configured. Please set your API key in the extension options."
    );
  }
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
  const prompt = `Fix the grammar and spelling in the following text. Return ONLY the corrected text without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt);
}

async function handleTranslate(text: string): Promise<string> {
  // Get API key and target language from storage
  const settings = await chrome.storage.sync.get(["targetLanguage"]);

  const targetLanguage = settings.targetLanguage || "Spanish";

  const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt);
}

async function handleEnhancePrompt(text: string): Promise<string> {
  const prompt = `Enhance the following prompt to be more detailed and effective for large language models. Return ONLY the enhanced prompt without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt);
}

async function handleAutoReply(pageContent: string): Promise<string> {
  const prompt = `Based on the following page content, generate a concise and relevant reply. The reply should be suitable for a comment or a short message. Return only the suggested reply, without any introductory phrases like "Here's a reply:" or any other explanations.\n\nPage Content:\n"""\n${pageContent}\n"""\n\nSuggested Reply:`;

  return await callApi(prompt);
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
