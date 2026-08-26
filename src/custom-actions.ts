export type CustomActionInputSource = "input" | "pageContext";

export interface CustomAction {
  id: string;
  name: string;
  prompt: string;
  inputSource: CustomActionInputSource;
}

export const CUSTOM_ACTION_INPUT_TOKEN = "{{input}}";
export const MAX_CUSTOM_ACTIONS = 12;
export const MAX_CUSTOM_ACTION_NAME_LENGTH = 40;
export const MAX_CUSTOM_ACTION_PROMPT_LENGTH = 3000;

const MAX_SYNC_STORAGE_BYTES = 7000;

const getUtf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
        ? 2
        : codePoint <= 0xffff
        ? 3
        : 4;
  }
  return bytes;
};

const isInputSource = (value: unknown): value is CustomActionInputSource =>
  value === "input" || value === "pageContext";

export const normalizeCustomActions = (value: unknown): CustomAction[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();

  return value
    .filter((action): action is Record<string, unknown> => {
      return !!action && typeof action === "object" && !Array.isArray(action);
    })
    .map((action) => ({
      id: typeof action.id === "string" ? action.id.trim() : "",
      name: typeof action.name === "string" ? action.name.trim() : "",
      prompt: typeof action.prompt === "string" ? action.prompt.trim() : "",
      inputSource: isInputSource(action.inputSource)
        ? action.inputSource
        : ("input" as const),
    }))
    .filter((action) => {
      if (seenIds.has(action.id) || validateCustomAction(action)) {
        return false;
      }
      seenIds.add(action.id);
      return true;
    })
    .slice(0, MAX_CUSTOM_ACTIONS);
};

export const validateCustomAction = (action: CustomAction): string | null => {
  if (!action.name.trim()) return "Menu label is required.";
  if (action.name.trim().length > MAX_CUSTOM_ACTION_NAME_LENGTH) {
    return `Menu label must be ${MAX_CUSTOM_ACTION_NAME_LENGTH} characters or fewer.`;
  }
  if (!action.prompt.trim()) return "Custom prompt is required.";
  if (action.prompt.trim().length > MAX_CUSTOM_ACTION_PROMPT_LENGTH) {
    return `Custom prompt must be ${MAX_CUSTOM_ACTION_PROMPT_LENGTH} characters or fewer.`;
  }
  if (!isInputSource(action.inputSource)) return "Select a valid input source.";
  return null;
};

export const validateCustomActions = (
  actions: CustomAction[]
): string | null => {
  if (actions.length > MAX_CUSTOM_ACTIONS) {
    return `You can create up to ${MAX_CUSTOM_ACTIONS} custom actions.`;
  }

  for (const action of actions) {
    const actionError = validateCustomAction(action);
    if (actionError) return actionError;
  }

  const storageBytes = getUtf8ByteLength(
    JSON.stringify({ customActions: actions })
  );
  if (storageBytes > MAX_SYNC_STORAGE_BYTES) {
    return "Custom actions are too large to sync. Shorten one or more prompts.";
  }

  return null;
};

export const buildCustomActionPrompt = (
  promptTemplate: string,
  input: string
): string => {
  const prompt = promptTemplate.trim();
  const normalizedInput = input.trim();

  if (prompt.includes(CUSTOM_ACTION_INPUT_TOKEN)) {
    return prompt.split(CUSTOM_ACTION_INPUT_TOKEN).join(normalizedInput);
  }

  return `${prompt}\n\nInput:\n"""\n${normalizedInput}\n"""`;
};
