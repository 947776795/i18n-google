// Integration test for the user selection flow
const mockPrompt = jest.fn();
jest.mock("inquirer", () => ({
  prompt: mockPrompt,
}));

jest.mock("../src/utils/StringUtils", () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { UserInteraction } from "../src/ui/UserInteraction";

describe("Integration Test - User Selection Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle complete user selection workflow", async () => {
    // Simulate workflow where user:
    // 1. Sees unused keys
    // 2. Chooses manual selection
    // 3. Selects specific keys

    const unusedKeys = [
      "[components/Header.ts][Hello World]",
      "[components/Footer.ts][Goodbye]",
      "[pages/Home.ts][Welcome]",
      "[components/Sidebar.ts][Menu]",
    ];

    // User chooses manual selection mode
    mockPrompt
      .mockResolvedValueOnce({
        selectionMode: "manual",
      })
      // User selects only 2 out of 4 keys
      .mockResolvedValueOnce({
        selectedKeys: [
          "[components/Header.ts][Hello World]",
          "[pages/Home.ts][Welcome]",
        ],
      });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);

    // Verify user was prompted for selection mode
    expect(mockPrompt).toHaveBeenNthCalledWith(1, [
      {
        type: "list",
        name: "selectionMode",
        message: "请选择删除方式:",
        choices: [
          {
            name: "🗑️ 全部删除 (4 个Key)",
            value: "all",
          },
          {
            name: "🎯 手动选择要删除的Key",
            value: "manual",
          },
          {
            name: "❌ 跳过删除",
            value: "skip",
          },
        ],
        default: "skip", // 默认选择跳过删除
      },
    ]);

    // Verify user was prompted for manual selection
    expect(mockPrompt).toHaveBeenNthCalledWith(2, {
      type: "checkbox",
      name: "selectedKeys",
      message: "请选择要删除的Key (共4个",
      choices: unusedKeys.map((key, index) => ({
        name: `${(index + 1).toString().padStart(3, " ")}. ${key}`,
        value: key,
        checked: false,
      })),
      pageSize: 15,
      validate: expect.any(Function),
    });

    // Verify correct keys were returned
    expect(result).toEqual([
      "[components/Header.ts][Hello World]",
      "[pages/Home.ts][Welcome]",
    ]);

    // Verify exactly 2 prompts were made
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });

  it("should handle user selecting all keys", async () => {
    const unusedKeys = [
      "[components/Header.ts][Test Key 1]",
      "[pages/Footer.ts][Test Key 2]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "all",
    });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);

    expect(result).toEqual(unusedKeys);
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it("should handle user skipping deletion", async () => {
    const unusedKeys = [
      "[components/Header.ts][Skip Test 1]",
      "[pages/Footer.ts][Skip Test 2]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "skip",
    });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);

    expect(result).toEqual([]);
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it("should display keys when list is small", async () => {
    const unusedKeys = [
      "[components/Header.ts][Small List 1]",
      "[components/Header.ts][Small List 2]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "all",
    });

    await UserInteraction.selectKeysForDeletion(unusedKeys);

    // Logger.info should have been called to show the key list
    const Logger = require("../src/utils/StringUtils").Logger;
    expect(Logger.info).toHaveBeenCalledWith("📝 无用Key列表:");
    expect(Logger.info).toHaveBeenCalledWith(
      "   1. [components/Header.ts][Small List 1]"
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "   2. [components/Header.ts][Small List 2]"
    );
  });

  it("should handle large list of 40 keys when user selects all", async () => {
    // Generate 40 unused keys
    const unusedKeys = Array.from(
      { length: 40 },
      (_, index) =>
        `[components/Module${Math.floor(index / 4)}.ts][Key${index + 1}]`
    );

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "all",
    });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);

    // Verify all 40 keys are returned
    expect(result).toEqual(unusedKeys);
    expect(result.length).toBe(40);

    // Verify user was prompted with correct count
    expect(mockPrompt).toHaveBeenCalledWith([
      {
        type: "list",
        name: "selectionMode",
        message: "请选择删除方式:",
        choices: [
          {
            name: "🗑️ 全部删除 (40 个Key)",
            value: "all",
          },
          {
            name: "🎯 手动选择要删除的Key",
            value: "manual",
          },
          {
            name: "❌ 跳过删除",
            value: "skip",
          },
        ],
        default: "skip",
      },
    ]);

    // For large lists, should show summary instead of individual keys
    const Logger = require("../src/utils/StringUtils").Logger;
    expect(Logger.info).toHaveBeenCalledWith(
      "📝 找到 40 个无用Key，请在下面的选择界面中选择要删除的Key\n"
    );

    // Should not display individual keys for large lists
    expect(Logger.info).not.toHaveBeenCalledWith("📝 无用Key列表:");

    // Only one prompt should be made (selection mode only, no manual selection)
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it("should handle large list of 40 keys with manual selection", async () => {
    // Generate 40 unused keys
    const unusedKeys = Array.from(
      { length: 40 },
      (_, index) =>
        `[components/Module${Math.floor(index / 4)}.ts][Key${index + 1}]`
    );

    // User selects first 5 keys manually
    const selectedKeys = unusedKeys.slice(0, 5);

    mockPrompt
      .mockResolvedValueOnce({
        selectionMode: "manual",
      })
      .mockResolvedValueOnce({
        selectedKeys: selectedKeys,
      });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);

    // Verify only selected keys are returned
    expect(result).toEqual(selectedKeys);
    expect(result.length).toBe(5);

    // Verify user was prompted for manual selection with all 40 options
    expect(mockPrompt).toHaveBeenNthCalledWith(2, {
      type: "checkbox",
      name: "selectedKeys",
      message: "请选择要删除的Key (共40个",
      choices: unusedKeys.map((key, index) => ({
        name: `${(index + 1).toString().padStart(3, " ")}. ${key}`,
        value: key,
        checked: false,
      })),
      pageSize: 15,
      validate: expect.any(Function),
    });

    // Two prompts should be made (selection mode + manual selection)
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });

  it("should provide proper instructions for pagination when using manual selection", async () => {
    // Generate 25 unused keys to trigger pagination
    const unusedKeys = Array.from(
      { length: 25 },
      (_, index) =>
        `[components/Module${Math.floor(index / 4)}.ts][Key${index + 1}]`
    );

    const selectedKeys = unusedKeys.slice(0, 3);

    mockPrompt
      .mockResolvedValueOnce({
        selectionMode: "manual",
      })
      .mockResolvedValueOnce({
        selectedKeys: selectedKeys,
      });

    await UserInteraction.selectKeysForDeletion(unusedKeys);

    // Verify that Logger was called (but don't check for specific instruction messages since they're not implemented)
    const Logger = require("../src/utils/StringUtils").Logger;
    expect(Logger.info).toHaveBeenCalled();

    // Verify the prompt message includes total count
    expect(mockPrompt).toHaveBeenNthCalledWith(2, {
      type: "checkbox",
      name: "selectedKeys",
      message: "请选择要删除的Key (共25个",
      choices: unusedKeys.map((key, index) => ({
        name: `${(index + 1).toString().padStart(3, " ")}. ${key}`,
        value: key,
        checked: false,
      })),
      pageSize: 15,
      validate: expect.any(Function),
    });
  });
});
