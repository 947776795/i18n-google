import type { I18nConfig } from "../types";
import * as path from "path";

/**
 * 路径转换工具类
 * 统一处理文件路径到模块路径的转换逻辑
 */
export class PathUtils {
  /**
   * 将文件路径转换为模块路径
   * @param filePath 文件路径
   * @param config 配置对象
   * @returns 模块路径
   */
  static convertFilePathToModulePath(
    filePath: string,
    config: I18nConfig
  ): string {
    // 统一为绝对路径
    const pathAbs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // 计算基准根目录（绝对路径）
    const rootDirAbs = config.rootDir
      ? path.resolve(process.cwd(), config.rootDir)
      : process.cwd();

    // 优先相对 rootDir 截取，否则相对项目根目录
    let relative = pathAbs.startsWith(rootDirAbs + path.sep)
      ? path.relative(rootDirAbs, pathAbs)
      : path.relative(process.cwd(), pathAbs);

    // 归一化分隔符
    relative = relative.replace(/\\/g, "/");

    // 去除前导的 src/（如果存在）
    relative = relative.replace(/^src\//, "");

    // 将扩展名统一为 .ts
    relative = relative.replace(/\.(tsx?|jsx?)$/, ".ts");

    return relative;
  }

  /**
   * 从模块路径转换为文件路径
   * @param modulePath 模块路径
   * @returns 文件路径
   */
  static convertModulePathToFilePath(modulePath: string): string {
    // 直接返回模块路径，保持与CompleteRecord中的key格式一致
    // 例如：TestModular.ts → TestModular.ts
    // 例如：page/home.ts → page/home.ts
    // 例如：components/Header2.ts → components/Header2.ts
    return modulePath;
  }

  /**
   * 获取翻译文件的导入路径
   * @param currentFilePath 当前文件路径
   * @param config 配置对象
   * @returns 导入路径
   */
  static getTranslationImportPath(
    currentFilePath: string,
    config: I18nConfig
  ): string {
    // 计算 rootDir 的绝对路径
    const rootDirAbsolute = path.resolve(process.cwd(), config.rootDir);

    // 计算文件相对于 rootDir 的路径
    const relativePath = path.relative(rootDirAbsolute, currentFilePath);

    // 移除文件扩展名
    const pathWithoutExt = relativePath.replace(/\.(tsx?|jsx?)$/, "");

    // 生成 @translate 导入路径
    return `@translate/${pathWithoutExt}`;
  }

  /**
   * 获取文件的模块路径（去除扩展名）
   * @param filePath 文件路径
   * @returns 模块路径
   */
  static getModulePathForFile(filePath: string): string {
    // src/components/Header.tsx -> src/components/Header
    return filePath.replace(/\.(tsx?|jsx?)$/, "");
  }
}
