/**
 * UserPrompt 单元测试
 */

import { UserPrompt } from '../../ui/UserPrompt';

describe('UserPrompt', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logs: string[] = [];

  beforeEach(() => {
    // 保存原始 console 方法
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logs = [];

    // Mock console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '));
    };

    // Mock console.error
    console.error = (...args: unknown[]) => {
      logs.push('ERROR: ' + args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '));
    };
  });

  afterEach(() => {
    // 恢复原始 console 方法
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('confirmDeleteUnusedKeys - 确认删除无用 keys', () => {
    it('应该显示无用 keys 总数和详细信息', () => {
      const prompt = new UserPrompt();

      prompt.showUnusedKeys(['[app][OldKey]', '[components][Deprecated]']);

      expect(logs.some(log => log.includes('无用的翻译 keys'))).toBe(true);
      expect(logs.some(log => log.includes('2'))).toBe(true);
      expect(logs.some(log => log.includes('📁 app'))).toBe(true);
      expect(logs.some(log => log.includes('🔑 OldKey'))).toBe(true);
      expect(logs.some(log => log.includes('📁 components'))).toBe(true);
      expect(logs.some(log => log.includes('🔑 Deprecated'))).toBe(true);
    });

    it('应该处理空列表', () => {
      const prompt = new UserPrompt();

      prompt.showUnusedKeys([]);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.includes('无需清理'))).toBe(true);
    });
  });

  describe('formatUnusedKeysMessage - 格式化无用 keys 消息', () => {
    it('应该正确格式化单个 key（显示文件位置和 key 名称）', () => {
      const prompt = new UserPrompt();

      const message = prompt.formatUnusedKeysMessage(['[app][OldKey]']);

      expect(message).toContain('📁 app');
      expect(message).toContain('🔑 OldKey');
      expect(message).toContain('1');
      expect(message).toContain('无用的翻译 keys');
    });

    it('应该正确格式化多个 keys（显示文件位置和 key 名称）', () => {
      const prompt = new UserPrompt();

      const message = prompt.formatUnusedKeysMessage(['[app][OldKey]', '[components][Deprecated]']);

      expect(message).toContain('📁 app');
      expect(message).toContain('🔑 OldKey');
      expect(message).toContain('📁 components');
      expect(message).toContain('🔑 Deprecated');
      expect(message).toContain('2');
      expect(message).toContain('无用的翻译 keys');
    });

    it('应该正确处理空列表', () => {
      const prompt = new UserPrompt();

      const message = prompt.formatUnusedKeysMessage([]);

      expect(message).toContain('无需清理');
    });
  });
});
