// Background script for handling Gemini API calls with streaming support

import { addTokenUsage } from "./db";

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
  };
}

// Streaming callback type
type StreamCallback = (chunk: string, done: boolean) => void;

// Streaming version of Gemini API call
async function streamGeminiAPI(
  prompt: string,
  apiKey: string,
  model: string,
  kind: string,
  onChunk: StreamCallback
): Promise<string> {
  const modelId = model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

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
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error?.message?.toLowerCase().includes("quota")) {
      throw new Error("You have exceeded your Gemini API quota.");
    }
    throw new Error(errorData.error?.message || `API request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let totalTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data: GeminiResponse = JSON.parse(jsonStr);

            if (data.error) {
              throw new Error(data.error.message);
            }

            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const text = data.candidates[0].content.parts[0].text;
              fullText += text;
              onChunk(text, false);
            }

            if (data.usageMetadata?.totalTokenCount) {
              totalTokens = data.usageMetadata.totalTokenCount;
            }
          } catch (e) {
            // Skip invalid JSON chunks
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Log token usage
  if (totalTokens > 0) {
    addTokenUsage({
      date: new Date().toISOString(),
      model: modelId,
      kind,
      tokens: totalTokens,
    });
  }

  onChunk("", true);
  return fullText;
}

// Streaming version of OpenAI-compatible API call
async function streamOpenAIAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  isCustom: boolean,
  kind: string,
  onChunk: StreamCallback
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
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let estimatedTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content, false);
            }
          } catch (e) {
            // Skip invalid JSON chunks
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Estimate token usage for streaming (rough estimate: ~4 chars per token)
  estimatedTokens = Math.ceil(fullText.length / 4) + Math.ceil(prompt.length / 4);
  addTokenUsage({
    date: new Date().toISOString(),
    model: model,
    kind,
    tokens: estimatedTokens,
  });

  onChunk("", true);
  return fullText;
}

// Non-streaming fallback for Gemini API
async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  model: string,
  kind: string
): Promise<string> {
  const modelId = model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

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

  if (data.usageMetadata) {
    addTokenUsage({
      date: new Date().toISOString(),
      model: modelId,
      kind,
      tokens: data.usageMetadata.totalTokenCount,
    });
  }

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

// Non-streaming fallback for OpenAI-compatible API
async function callOpenAIAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  isCustom: boolean,
  kind: string
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

  if (data.usage) {
    addTokenUsage({
      date: new Date().toISOString(),
      model: model,
      kind,
      tokens: data.usage.total_tokens,
    });
  }

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

// Streaming version of callApi - sends chunks via callback
async function streamApi(
  prompt: string,
  kind: string,
  onChunk: StreamCallback
): Promise<string> {
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
      return streamGeminiAPI(
        prompt,
        activeModel.apiKey,
        activeModel.model || "gemini-2.5-flash",
        kind,
        onChunk
      );
    } else if (
      activeModel.type === "openai" ||
      activeModel.type === "openrouter" ||
      activeModel.type === "custom"
    ) {
      return streamOpenAIAPI(
        prompt,
        activeModel.apiKey,
        activeModel.baseUrl,
        activeModel.model,
        activeModel.type === "custom",
        kind,
        onChunk
      );
    } else {
      throw new Error(`Unsupported model type: ${activeModel.type}`);
    }
  } else if (settings.models && !settings.activeModelId) {
    throw new Error("Please select an active model in the extension options.");
  } else if (settings.apiKey) {
    // Legacy support for old settings
    return streamGeminiAPI(prompt, settings.apiKey, "gemini-2.5-flash", "legacy", onChunk);
  } else {
    throw new Error(
      "No API key or model configured. Please set your API key in the extension options."
    );
  }
}

// Non-streaming version (kept for backward compatibility and autoFillForm)
async function callApi(prompt: string, kind: string): Promise<string> {
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
      return callGeminiAPI(prompt, activeModel.apiKey, activeModel.model || "gemini-2.5-flash", kind);
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
        activeModel.type === "custom",
        kind
      );
    } else {
      throw new Error(`Unsupported model type: ${activeModel.type}`);
    }
  } else if (settings.models && !settings.activeModelId) {
    throw new Error("Please select an active model in the extension options.");
  } else if (settings.apiKey) {
    // Legacy support for old settings
    return callGeminiAPI(prompt, settings.apiKey, "gemini-2.5-flash", "legacy");
  } else {
    throw new Error(
      "No API key or model configured. Please set your API key in the extension options."
    );
  }
}

// Non-streaming message listener (kept for backward compatibility)
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

  if (message.action === "autoFillForm") {
    handleAutoFillForm(message.fields)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
});

// Port-based streaming connection handler
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ainput-stream") return;

  port.onMessage.addListener(async (message) => {
    const { action, text, pageContent } = message;

    try {
      let prompt: string;
      let kind: string;

      switch (action) {
        case "fixGrammar":
          prompt = `Fix the grammar and spelling in the following text. Return ONLY the corrected text without any explanations or additional comments:\n\n${text}`;
          kind = "fixGrammar";
          break;
        case "translate": {
          const settings = await chrome.storage.sync.get(["targetLanguage"]);
          const targetLanguage = settings.targetLanguage || "Spanish";
          prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any explanations or additional comments:\n\n${text}`;
          kind = "translate";
          break;
        }
        case "enhancePrompt":
          prompt = `Enhance the following prompt to be more detailed and effective for large language models. Return ONLY the enhanced prompt without any explanations or additional comments:\n\n${text}`;
          kind = "enhancePrompt";
          break;
        case "autoReply":
          prompt = `Based on the following page content, generate a concise and relevant reply. The reply should be suitable for a comment or a short message. Return only the suggested reply, without any introductory phrases like "Here's a reply:" or any other explanations.\n\nPage Content:\n"""\n${pageContent}\n"""\n\nSuggested Reply:`;
          kind = "autoReply";
          break;
        default:
          port.postMessage({ type: "error", error: `Unknown action: ${action}` });
          return;
      }

      await streamApi(prompt, kind, (chunk, done) => {
        if (done) {
          port.postMessage({ type: "done" });
        } else {
          port.postMessage({ type: "chunk", chunk });
        }
      });
    } catch (error) {
      port.postMessage({ 
        type: "error", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
});

async function handleFixGrammar(text: string): Promise<string> {
  const prompt = `Fix the grammar and spelling in the following text. Return ONLY the corrected text without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt, "fixGrammar");
}

async function handleTranslate(text: string): Promise<string> {
  // Get API key and target language from storage
  const settings = await chrome.storage.sync.get(["targetLanguage"]);

  const targetLanguage = settings.targetLanguage || "Spanish";

  const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt, "translate");
}

async function handleEnhancePrompt(text: string): Promise<string> {
  const prompt = `Enhance the following prompt to be more detailed and effective for large language models. Return ONLY the enhanced prompt without any explanations or additional comments:\n\n${text}`;

  return await callApi(prompt, "enhancePrompt");
}

async function handleAutoReply(pageContent: string): Promise<string> {
  const prompt = `Based on the following page content, generate a concise and relevant reply. The reply should be suitable for a comment or a short message. Return only the suggested reply, without any introductory phrases like "Here's a reply:" or any other explanations.\n\nPage Content:\n"""\n${pageContent}\n"""\n\nSuggested Reply:`;

  return await callApi(prompt, "autoReply");
}

interface FormFieldInfo {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autocomplete: string;
}

async function handleAutoFillForm(fields: FormFieldInfo[]): Promise<Record<string, string>> {
  const fieldDescriptions = fields.map((field) => {
    const details = [];
    if (field.label) details.push(`label: "${field.label}"`);
    if (field.placeholder) details.push(`placeholder: "${field.placeholder}"`);
    details.push(`detected type: ${field.type}`);
    return `- "${field.name}" (${details.join(", ")})`;
  }).join("\n");

  const prompt = `Generate realistic data for a web form. The data should look completely authentic and natural, as if from a real person.

Form fields to fill:
${fieldDescriptions}

Important rules:
1. Generate highly realistic data that looks genuine and natural
2. Email should use real-world domains like @gmail.com, @yahoo.com, @outlook.com, @hotmail.com, or @icloud.com
3. Phone numbers should follow real formats (e.g., (415) 555-1234, +1 312-555-6789)
4. Addresses should use real city names, valid state abbreviations, and realistic street names
5. Names should be common, realistic names that sound natural
6. For "message", "bio", or "comment" fields, write natural, contextually appropriate text
7. ZIP codes should be valid format for the region (e.g., 5-digit for US)
8. Company names should sound like real businesses
9. Usernames should look like real usernames people would choose
10. Return ONLY a valid JSON object with field names as keys and generated values as strings
11. Do not include any explanations, markdown formatting, or code blocks - just the raw JSON object

Example output format:
{"firstName": "Michael", "lastName": "Chen", "email": "michael.chen92@gmail.com", "phone": "(628) 555-4721"}

Generate the JSON:`;

  const result = await callApi(prompt, "autoFillForm");
  
  // Parse the JSON response
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch (error) {
    throw new Error("Failed to parse AI response as JSON. Please try again.");
  }
}

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      if (command === "fix-grammar") {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fixGrammarShortcut" });
      } else if (command === "translate") {
        chrome.tabs.sendMessage(tabs[0].id, { action: "translateShortcut" });
      } else if (command === "auto-fill-form") {
        chrome.tabs.sendMessage(tabs[0].id, { action: "autoFillFormShortcut" });
      }
    }
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
