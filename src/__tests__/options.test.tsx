import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as chromeAI from "../chrome-ai";
import { Options } from "../options";

const configuredModel = {
  id: "work-model",
  name: "Work Assistant",
  apiKey: "test-api-key",
  type: "openai",
  baseUrl: "https://api.openai.com",
  model: "gpt-4.1",
};

describe("Options model settings", () => {
  let storageSet: jest.Mock;
  let storedSettings: Record<string, unknown>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "openrouter/free",
            name: "Free Models Router",
          },
        ],
      }),
    }) as jest.Mock;
    storageSet = jest.fn((_items, callback) => callback?.());
    storedSettings = {
      models: [configuredModel],
      activeModelId: configuredModel.id,
      modelsInitialized: true,
      targetLanguage: "English",
      disabledSites: [],
    };
    jest
      .spyOn(chromeAI, "getChromeAIAvailability")
      .mockResolvedValue("unsupported");
    jest.spyOn(chromeAI, "setupChromeAI").mockResolvedValue();

    global.chrome = {
      storage: {
        sync: {
          get: jest.fn().mockImplementation((_defaults, callback) => {
            callback(storedSettings);
          }),
          set: storageSet,
        },
      },
      runtime: {
        lastError: null,
      },
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  test("edits and persists a configured model", async () => {
    render(<Options />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Work Assistant" })
    );

    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        {
          models: [
            expect.objectContaining({
              id: configuredModel.id,
              model: "gpt-4.1-mini",
            }),
          ],
          modelsInitialized: true,
        },
        expect.any(Function)
      )
    );

    expect(await screen.findByText(/gpt-4.1-mini/)).toBeInTheDocument();
    expect(screen.getByText("Model updated successfully!")).toBeInTheDocument();
  });

  test("cancels edits without writing to storage", async () => {
    render(<Options />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Work Assistant" })
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Changed Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(storageSet).not.toHaveBeenCalled();
    expect(screen.getByText("Work Assistant")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Changed Name")).not.toBeInTheDocument();
  });

  test("adds DeepSeek with its predefined endpoint and model", async () => {
    render(<Options />);

    fireEvent.change(await screen.findByRole("combobox"), {
      target: { value: "deepseek" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Work Assistant"), {
      target: { value: "DeepSeek" },
    });
    fireEvent.change(screen.getByPlaceholderText("sk-..."), {
      target: { value: "deepseek-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Model" }));

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith({
        models: expect.arrayContaining([
          expect.objectContaining({
            name: "DeepSeek",
            type: "deepseek",
            apiKey: "deepseek-key",
            baseUrl: "https://api.deepseek.com",
            model: "deepseek-v4-pro",
          }),
        ]),
        modelsInitialized: true,
      })
    );
  });

  test("adds a custom menu action with a page-context prompt", async () => {
    render(<Options />);

    await screen.findByText("Work Assistant");
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.change(await screen.findByLabelText("Menu label"), {
      target: { value: "Summarize page" },
    });
    fireEvent.change(screen.getByLabelText("Input source"), {
      target: { value: "pageContext" },
    });
    fireEvent.change(screen.getByLabelText("Custom prompt"), {
      target: { value: "Summarize {{input}} in three bullets." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        {
          customActions: [
            expect.objectContaining({
              name: "Summarize page",
              inputSource: "pageContext",
              prompt: "Summarize {{input}} in three bullets.",
            }),
          ],
        },
        expect.any(Function)
      )
    );

    expect(screen.getByText("Custom action added!")).toBeInTheDocument();
    expect(screen.getByText("Uses page context")).toBeInTheDocument();
  });

  test("selects Chrome Built-in AI by default when it is ready", async () => {
    storedSettings = {
      models: [],
      activeModelId: null,
      modelsInitialized: false,
      targetLanguage: "English",
      disabledSites: [],
    };
    jest
      .spyOn(chromeAI, "getChromeAIAvailability")
      .mockResolvedValue("available");

    render(<Options />);

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activeModelId: "chrome-built-in-ai",
          modelsInitialized: true,
          models: expect.arrayContaining([
            expect.objectContaining({
              id: "chrome-built-in-ai",
              type: "chrome",
            }),
          ]),
        })
      )
    );

    expect(
      await screen.findByRole("radio", { name: "Chrome Built-in AI" })
    ).toBeChecked();
  });

  test("keeps a cloud model active until Chrome AI is downloaded", async () => {
    storedSettings = {
      models: [],
      activeModelId: null,
      modelsInitialized: false,
      targetLanguage: "English",
      disabledSites: [],
    };
    jest
      .spyOn(chromeAI, "getChromeAIAvailability")
      .mockResolvedValue("downloadable");

    render(<Options />);

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activeModelId: "openrouter-free",
          models: expect.arrayContaining([
            expect.objectContaining({ id: "chrome-built-in-ai" }),
            expect.objectContaining({
              id: "openrouter-free",
              model: "openrouter/free",
            }),
          ]),
        })
      )
    );
    expect(
      await screen.findByRole("button", { name: "Download & Use" })
    ).toBeEnabled();
    expect(chromeAI.setupChromeAI).not.toHaveBeenCalled();
  });

  test("migrates legacy free presets into one refreshed OpenRouter model", async () => {
    storedSettings = {
      models: [
        {
          id: "grok-free",
          name: "Grok 4.1 Fast (Free)",
          apiKey: "",
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
          model: "x-ai/grok-4.1-fast:free",
        },
        {
          id: "gpt-oss-free",
          name: "GPT OSS 20B (Free)",
          apiKey: "",
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
          model: "openai/gpt-oss-20b:free",
        },
        {
          id: "deepseek-r1-free",
          name: "DeepSeek R1 (Free)",
          apiKey: "",
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
          model: "deepseek/deepseek-r1-0528:free",
        },
      ],
      activeModelId: "gpt-oss-free",
      modelsInitialized: true,
      targetLanguage: "English",
      disabledSites: [],
    };

    render(<Options />);

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith({
        modelsInitialized: true,
        activeModelId: "openrouter-free",
        models: [
          expect.objectContaining({
            id: "openrouter-free",
            name: "OpenRouter Free",
            model: "openrouter/free",
          }),
        ],
      })
    );
    expect(
      await screen.findByRole("radio", { name: "OpenRouter Free" })
    ).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Edit OpenRouter Free" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh OpenRouter Free" })
    ).toBeEnabled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      { headers: { Accept: "application/json" } }
    );
  });

  test("refreshes the read-only OpenRouter free model", async () => {
    storedSettings = {
      models: [
        {
          id: "openrouter-free",
          name: "OpenRouter Free",
          apiKey: "",
          type: "openrouter",
          baseUrl: "https://openrouter.ai/api",
          model: "openrouter/free",
        },
      ],
      activeModelId: "openrouter-free",
      modelsInitialized: true,
      targetLanguage: "English",
      disabledSites: [],
    };

    render(<Options />);

    const refreshButton = await screen.findByRole("button", {
      name: "Refresh OpenRouter Free",
    });
    storageSet.mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "provider/refreshed:free",
            name: "Refreshed Free",
            context_length: 128000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { output_modalities: ["text"] },
          },
        ],
      }),
    });

    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        {
          models: [
            expect.objectContaining({
              id: "openrouter-free",
              name: "Refreshed Free",
              model: "provider/refreshed:free",
            }),
          ],
          modelsInitialized: true,
        },
        expect.any(Function)
      )
    );
    expect(await screen.findByText("Refreshed Free")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Refreshed Free" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("OpenRouter Free refreshed successfully!")
    ).toBeInTheDocument();
  });

  test("downloads and activates Chrome Built-in AI from the empty state", async () => {
    storedSettings = {
      models: [],
      activeModelId: null,
      modelsInitialized: true,
      targetLanguage: "English",
      disabledSites: [],
    };
    jest
      .spyOn(chromeAI, "getChromeAIAvailability")
      .mockResolvedValue("downloadable");
    const setupChromeAI = jest
      .spyOn(chromeAI, "setupChromeAI")
      .mockImplementation(async (onProgress) => onProgress?.(1));

    render(<Options />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Download & Use" })
    );

    await waitFor(() => expect(setupChromeAI).toHaveBeenCalled());
    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activeModelId: "chrome-built-in-ai",
          modelsInitialized: true,
        }),
        expect.any(Function)
      )
    );
    expect(
      await screen.findByRole("radio", { name: "Chrome Built-in AI" })
    ).toBeChecked();
  });

  test("selects a cloud fallback when built-in AI is unavailable", async () => {
    storedSettings = {
      models: [
        {
          id: "chrome-built-in-ai",
          name: "Chrome Built-in AI",
          apiKey: "",
          type: "chrome",
          model: "gemini-nano",
        },
        configuredModel,
      ],
      activeModelId: "chrome-built-in-ai",
      modelsInitialized: true,
      targetLanguage: "English",
      disabledSites: [],
    };
    jest
      .spyOn(chromeAI, "getChromeAIAvailability")
      .mockResolvedValue("unavailable");

    render(<Options />);

    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith({
        modelsInitialized: true,
        activeModelId: configuredModel.id,
      })
    );
    expect(
      await screen.findByRole("radio", { name: "Work Assistant" })
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});
