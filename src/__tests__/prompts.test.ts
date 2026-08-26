import {
  buildActionPrompt,
  buildFormFillSchema,
  parseFormFillResponse,
} from "../prompts";

const fields = [
  {
    id: "email",
    name: "email",
    type: "email",
    label: "Email address",
    placeholder: "you@example.com",
    autocomplete: "email",
  },
];

describe("AI prompts", () => {
  test("includes the configured translation language", () => {
    expect(
      buildActionPrompt("translate", { text: "Hello" }, "Japanese")
    ).toContain("Translate the following text to Japanese");
  });

  test("inserts custom action input into its prompt template", () => {
    expect(
      buildActionPrompt("customAction", {
        text: "This is too long.",
        customPrompt: "Make {{input}} concise. Return only the result.",
      })
    ).toBe("Make This is too long. concise. Return only the result.");
  });

  test("appends custom action input when the template has no token", () => {
    expect(
      buildActionPrompt("customAction", {
        text: "Source text",
        customPrompt: "Summarize this in one sentence.",
      })
    ).toContain('Input:\n"""\nSource text\n"""');
  });

  test("builds a strict form response schema", () => {
    expect(buildFormFillSchema(fields)).toEqual({
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
      additionalProperties: false,
    });
  });

  test("parses JSON wrapped in model output", () => {
    expect(
      parseFormFillResponse('Result: {"email":"user@example.com"}')
    ).toEqual({ email: "user@example.com" });
  });
});
