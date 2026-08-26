import { buildCustomActionPrompt } from "./custom-actions";

export type StreamAction =
  | "fixGrammar"
  | "translate"
  | "autoReply"
  | "customAction";

export interface StreamPromptData {
  text?: string;
  pageContent?: string;
  customPrompt?: string;
  customActionName?: string;
}

export interface FormPromptField {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autocomplete: string;
}

export const buildActionPrompt = (
  action: StreamAction,
  data: StreamPromptData,
  targetLanguage = "English"
): string => {
  switch (action) {
    case "fixGrammar":
      return `Fix the grammar and spelling in the following text. Return ONLY the corrected text without any explanations or additional comments:\n\n${
        data.text || ""
      }`;
    case "translate":
      return `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any explanations or additional comments:\n\n${
        data.text || ""
      }`;
    case "autoReply":
      return `Based on the following page content, generate a concise and relevant reply. The reply should be suitable for a comment or a short message. Return only the suggested reply, without any introductory phrases like "Here's a reply:" or any other explanations.\n\nPage Content:\n"""\n${
        data.pageContent || ""
      }\n"""\n\nSuggested Reply:`;
    case "customAction":
      return buildCustomActionPrompt(data.customPrompt || "", data.text || "");
  }
};

export const buildFormFillPrompt = (fields: FormPromptField[]): string => {
  const fieldDescriptions = fields
    .map((field) => {
      const details = [];
      if (field.label) details.push(`label: "${field.label}"`);
      if (field.placeholder) {
        details.push(`placeholder: "${field.placeholder}"`);
      }
      details.push(`detected type: ${field.type}`);
      return `- "${field.name}" (${details.join(", ")})`;
    })
    .join("\n");

  return `Generate realistic data for a web form. The data should look completely authentic and natural, as if from a real person.

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
};

export const buildFormFillSchema = (fields: FormPromptField[]) => {
  const properties = fields.reduce<Record<string, { type: string }>>(
    (schemaProperties, field) => {
      schemaProperties[field.name] = { type: "string" };
      return schemaProperties;
    },
    {}
  );

  return {
    type: "object",
    properties,
    required: fields.map((field) => field.name),
    additionalProperties: false,
  };
};

export const parseFormFillResponse = (
  response: string
): Record<string, string> => {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] || response);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned an invalid form response.");
  }

  return Object.keys(parsed).reduce<Record<string, string>>((values, key) => {
    if (typeof parsed[key] === "string") {
      values[key] = parsed[key];
    }
    return values;
  }, {});
};
