export type ChromeAIAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

interface ChromeAISession {
  prompt(
    input: string,
    options?: {
      signal?: AbortSignal;
      responseConstraint?: Record<string, unknown>;
    }
  ): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal }
  ): ReadableStream<string>;
  destroy(): void;
}

interface ChromeAIFactory {
  availability(): Promise<Exclude<ChromeAIAvailability, "unsupported">>;
  create(options?: {
    signal?: AbortSignal;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<ChromeAISession>;
}

const getLanguageModel = (): ChromeAIFactory | undefined =>
  (globalThis as typeof globalThis & { LanguageModel?: ChromeAIFactory })
    .LanguageModel;

export const getChromeAIAvailability =
  async (): Promise<ChromeAIAvailability> => {
    const languageModel = getLanguageModel();
    if (!languageModel) return "unsupported";

    return languageModel.availability();
  };

export const setupChromeAI = async (
  onDownloadProgress?: (progress: number) => void
): Promise<void> => {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    throw new Error("Chrome Built-in AI is not supported in this browser.");
  }

  const availability = await languageModel.availability();
  if (availability === "unavailable") {
    throw new Error("Chrome Built-in AI is unavailable on this device.");
  }

  if (
    availability !== "available" &&
    navigator.userActivation &&
    !navigator.userActivation.isActive
  ) {
    throw new Error("Click the setup button again to download the AI model.");
  }

  const session = await languageModel.create({
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        const progressEvent = event as Event & { loaded?: number };
        if (typeof progressEvent.loaded === "number") {
          onDownloadProgress?.(progressEvent.loaded);
        }
      });
    },
  });

  session.destroy();
};

const createReadySession = async (): Promise<ChromeAISession> => {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    throw new Error(
      "Chrome Built-in AI is not supported. Open AInput settings and select another model."
    );
  }

  const availability = await languageModel.availability();
  if (availability !== "available") {
    throw new Error(
      "Chrome Built-in AI needs setup. Open AInput settings to download the model."
    );
  }

  return languageModel.create();
};

export const streamChromeAIPrompt = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const session = await createReadySession();
  let fullText = "";

  try {
    const reader = session.promptStreaming(prompt, { signal }).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += value;
        onChunk(value);
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    session.destroy();
  }

  return fullText;
};

export const promptChromeAI = async (
  prompt: string,
  options?: {
    signal?: AbortSignal;
    responseConstraint?: Record<string, unknown>;
  }
): Promise<string> => {
  const session = await createReadySession();
  try {
    return await session.prompt(prompt, options);
  } finally {
    session.destroy();
  }
};
