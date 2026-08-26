import {
  buildCustomActionPrompt,
  normalizeCustomActions,
  validateCustomActions,
} from "../custom-actions";

describe("custom actions", () => {
  test("normalizes valid stored actions and ignores malformed entries", () => {
    expect(
      normalizeCustomActions([
        {
          id: " concise ",
          name: " Make concise ",
          prompt: " Shorten {{input}} ",
          inputSource: "input",
        },
        { id: "broken", name: "", prompt: "Missing label" },
      ])
    ).toEqual([
      {
        id: "concise",
        name: "Make concise",
        prompt: "Shorten {{input}}",
        inputSource: "input",
      },
    ]);
  });

  test("replaces every input token", () => {
    expect(
      buildCustomActionPrompt("Compare {{input}} with {{input}}", "A")
    ).toBe("Compare A with A");
  });

  test("rejects an empty prompt", () => {
    expect(
      validateCustomActions([
        { id: "empty", name: "Empty", prompt: "", inputSource: "input" },
      ])
    ).toBe("Custom prompt is required.");
  });
});
