import {
  getChromeAIAvailability,
  setupChromeAI,
  streamChromeAIPrompt,
} from "../chrome-ai";

describe("Chrome Built-in AI", () => {
  afterEach(() => {
    delete (globalThis as any).LanguageModel;
    delete (navigator as any).userActivation;
  });

  test("reports unsupported when the Prompt API is missing", async () => {
    await expect(getChromeAIAvailability()).resolves.toBe("unsupported");
  });

  test("sets up a downloadable model and reports progress", async () => {
    const destroy = jest.fn();
    const progress = jest.fn();

    Object.defineProperty(navigator, "userActivation", {
      configurable: true,
      value: { isActive: true },
    });
    (globalThis as any).LanguageModel = {
      availability: jest.fn().mockResolvedValue("downloadable"),
      create: jest.fn().mockImplementation(async ({ monitor }) => {
        const progressTarget = new EventTarget();
        monitor(progressTarget);
        const progressEvent = new Event("downloadprogress");
        Object.defineProperty(progressEvent, "loaded", { value: 0.75 });
        progressTarget.dispatchEvent(progressEvent);
        return { destroy };
      }),
    };

    await setupChromeAI(progress);

    expect(progress).toHaveBeenCalledWith(0.75);
    expect(destroy).toHaveBeenCalled();
  });

  test("streams incremental text and destroys the session", async () => {
    const destroy = jest.fn();
    const releaseLock = jest.fn();
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: "Hello" })
      .mockResolvedValueOnce({ done: false, value: " world" })
      .mockResolvedValueOnce({ done: true, value: undefined });

    (globalThis as any).LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockResolvedValue({
        promptStreaming: jest.fn().mockReturnValue({
          getReader: () => ({ read, releaseLock }),
        }),
        destroy,
      }),
    };

    const onChunk = jest.fn();
    await expect(streamChromeAIPrompt("Say hello", onChunk)).resolves.toBe(
      "Hello world"
    );

    expect(onChunk.mock.calls).toEqual([["Hello"], [" world"]]);
    expect(releaseLock).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });
});
