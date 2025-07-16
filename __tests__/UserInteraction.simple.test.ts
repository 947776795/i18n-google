// Mock inquirer first
const mockPrompt = jest.fn();
jest.mock("inquirer", () => ({
  prompt: mockPrompt,
}));

import { UserInteraction } from "../src/ui/UserInteraction";

// Mock Logger
jest.mock("../src/utils/StringUtils", () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("UserInteraction - selectKeysForDeletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array when no unused keys are provided", async () => {
    const result = await UserInteraction.selectKeysForDeletion([]);
    expect(result).toEqual([]);
  });

  it("should return all keys when user selects 'all'", async () => {
    const unusedKeys = [
      "[components/Header.ts][Hello World]",
      "[components/Footer.ts][Goodbye]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "all",
    });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);
    expect(result).toEqual(unusedKeys);
  });

  it("should return empty array when user selects 'skip'", async () => {
    const unusedKeys = [
      "[components/Header.ts][Hello World]",
      "[components/Footer.ts][Goodbye]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "skip",
    });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);
    expect(result).toEqual([]);
  });

  it("should return selected keys when user chooses manual selection", async () => {
    const unusedKeys = [
      "[components/Header.ts][Hello World]",
      "[components/Footer.ts][Goodbye]",
      "[pages/Home.ts][Welcome]",
    ];

    const selectedKeys = [
      "[components/Header.ts][Hello World]",
      "[pages/Home.ts][Welcome]",
    ];

    // Mock two prompts
    mockPrompt
      .mockResolvedValueOnce({
        selectionMode: "manual",
      })
      .mockResolvedValueOnce({
        selectedKeys: selectedKeys,
      });

    const result = await UserInteraction.selectKeysForDeletion(unusedKeys);
    expect(result).toEqual(selectedKeys);
  });

  it("should call prompt with correct list options", async () => {
    const unusedKeys = [
      "[components/Header.ts][Hello World]",
      "[components/Footer.ts][Goodbye]",
    ];

    mockPrompt.mockResolvedValueOnce({
      selectionMode: "all",
    });

    await UserInteraction.selectKeysForDeletion(unusedKeys);

    expect(mockPrompt).toHaveBeenCalledWith([
      {
        type: "list",
        name: "selectionMode",
        message: "请选择删除方式:",
        choices: [
          {
            name: "🗑️ 全部删除 (2 个Key)",
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
  });
});
