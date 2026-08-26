export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
export const OPENROUTER_FREE_MODEL_ID = "openrouter-free";
export const OPENROUTER_FREE_ROUTER = "openrouter/free";
export const LEGACY_OPENROUTER_FREE_MODEL_IDS = new Set([
  "grok-free",
  "gpt-oss-free",
  "deepseek-r1-free",
]);

export interface OpenRouterFreeModelMetadata {
  name: string;
  model: string;
}

interface OpenRouterModelRecord {
  id?: unknown;
  name?: unknown;
  created?: unknown;
  context_length?: unknown;
  architecture?: {
    output_modalities?: unknown;
  };
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  };
}

export const FALLBACK_OPENROUTER_FREE_MODEL: OpenRouterFreeModelMetadata = {
  name: "OpenRouter Free",
  model: OPENROUTER_FREE_ROUTER,
};

const numericValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isZeroPrice = (value: unknown): boolean =>
  (typeof value === "string" || typeof value === "number") &&
  value !== "" &&
  Number(value) === 0;

const supportsTextOutput = (model: OpenRouterModelRecord): boolean => {
  const outputModalities = model.architecture?.output_modalities;
  return !Array.isArray(outputModalities) || outputModalities.includes("text");
};

const hasFreeTextPricing = (model: OpenRouterModelRecord): boolean =>
  isZeroPrice(model.pricing?.prompt) && isZeroPrice(model.pricing?.completion);

const formatFreeModelName = (model: OpenRouterModelRecord): string => {
  const remoteName =
    typeof model.name === "string" && model.name.trim()
      ? model.name.trim()
      : String(model.id);
  return /\bfree\b/i.test(remoteName) ? remoteName : `${remoteName} (Free)`;
};

export const selectOpenRouterFreeModel = (
  responseBody: unknown
): OpenRouterFreeModelMetadata | null => {
  if (
    !responseBody ||
    typeof responseBody !== "object" ||
    !Array.isArray((responseBody as { data?: unknown }).data)
  ) {
    return null;
  }

  const models = (
    responseBody as { data: OpenRouterModelRecord[] }
  ).data.filter((model) => model && typeof model.id === "string");
  const freeRouter = models.find(
    (model) => model.id === OPENROUTER_FREE_ROUTER
  );

  if (freeRouter) {
    return FALLBACK_OPENROUTER_FREE_MODEL;
  }

  const freeTextModels = models
    .filter(
      (model) =>
        supportsTextOutput(model) &&
        (String(model.id).endsWith(":free") || hasFreeTextPricing(model))
    )
    .sort((left, right) => {
      const contextDifference =
        numericValue(right.context_length) - numericValue(left.context_length);
      if (contextDifference !== 0) return contextDifference;

      const createdDifference =
        numericValue(right.created) - numericValue(left.created);
      if (createdDifference !== 0) return createdDifference;

      return String(left.id).localeCompare(String(right.id));
    });

  const selectedModel = freeTextModels[0];
  if (!selectedModel) return null;

  return {
    name: formatFreeModelName(selectedModel),
    model: String(selectedModel.id),
  };
};

export const fetchOpenRouterFreeModel = async (
  fetcher: typeof fetch | undefined = globalThis.fetch
): Promise<OpenRouterFreeModelMetadata | null> => {
  if (!fetcher) return null;

  try {
    const response = await fetcher(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    return selectOpenRouterFreeModel(await response.json());
  } catch {
    return null;
  }
};
