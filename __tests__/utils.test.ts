import { generateI18nKey } from "../utils";

describe("generateI18nKey", () => {
  it("should generate a valid translation key based on path and text", () => {
    const params = {
      path: "components/Header/index.tsx",
      text: "Hello World",
    };
    expect(generateI18nKey(params)).toMatch(/^components_[a-f0-9]{6}$/);
  });

  it("should generate different keys for different texts in same path", () => {
    const path = "components/Footer/index.tsx";
    const key1 = generateI18nKey({ path, text: "Hello" });
    const key2 = generateI18nKey({ path, text: "World" });
    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for same text in different paths", () => {
    const text = "Submit";
    const key1 = generateI18nKey({ path: "components/Form/index.tsx", text });
    const key2 = generateI18nKey({ path: "components/Button/index.tsx", text });
    expect(key1).not.toBe(key2);
  });
});
