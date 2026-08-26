import {
  fetchOpenRouterFreeModel,
  selectOpenRouterFreeModel,
} from "../openrouter-models";

describe("OpenRouter free model discovery", () => {
  test("prefers OpenRouter's managed free router", () => {
    expect(
      selectOpenRouterFreeModel({
        data: [
          {
            id: "vendor/large-context:free",
            name: "Large Context",
            context_length: 200000,
            pricing: { prompt: "0", completion: "0" },
          },
          { id: "openrouter/free", name: "Free Models Router" },
        ],
      })
    ).toEqual({
      name: "OpenRouter Free",
      model: "openrouter/free",
    });
  });

  test("selects one deterministic free text model when the router is absent", () => {
    expect(
      selectOpenRouterFreeModel({
        data: [
          {
            id: "vendor/older:free",
            name: "Older",
            created: 10,
            context_length: 32000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { output_modalities: ["text"] },
          },
          {
            id: "vendor/current:free",
            name: "Current",
            created: 20,
            context_length: 128000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { output_modalities: ["text"] },
          },
          {
            id: "vendor/image:free",
            name: "Image Only",
            context_length: 256000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { output_modalities: ["image"] },
          },
          {
            id: "vendor/paid",
            name: "Paid",
            context_length: 512000,
            pricing: { prompt: "0.000001", completion: "0.000001" },
            architecture: { output_modalities: ["text"] },
          },
          {
            id: "vendor/unknown-pricing",
            name: "Unknown Pricing",
            context_length: 1000000,
            architecture: { output_modalities: ["text"] },
          },
        ],
      })
    ).toEqual({
      name: "Current (Free)",
      model: "vendor/current:free",
    });
  });

  test("returns null when the models request fails", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("offline"));

    await expect(fetchOpenRouterFreeModel(fetcher)).resolves.toBeNull();
  });
});
