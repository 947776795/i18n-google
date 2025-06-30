import type { I18nConfig } from "../types";

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
    // 移除项目根目录路径
    let modulePath = filePath.replace(process.cwd(), "").replace(/^\/+/, "");

    // 移除配置的根目录前缀（如 demo/src）
    if (config.rootDir) {
      const rootDir = config.rootDir.replace(/^\.\//, "");
      modulePath = modulePath.replace(new RegExp(`^${rootDir}/`), "");
    }

    // 将文件扩展名从 .tsx/.ts/.jsx/.js 改为 .ts
    modulePath = modulePath.replace(/\.(tsx?|jsx?)$/, ".ts");

    return modulePath;
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
   * 获取翻译变量名（与TranslationManager生成的变量名保持一致）
   * @param modulePath 模块路径
   * @param config 配置对象
   * @returns 翻译变量名
   */
  static getTranslationVarName(modulePath: string, config: I18nConfig): string {
    const path = require("path");

    // 规范化 rootDir，移除 ./ 前缀和末尾的斜杠
    let rootDir = "";
    if (config.rootDir) {
      rootDir = config.rootDir.replace(/^\.\//, "").replace(/\/$/, "");
    }

    // 规范化 modulePath（处理 Windows 路径分隔符）
    const normalizedModulePath = modulePath.replace(/\\/g, "/");

    // 查找 rootDir 在 modulePath 中的位置
    let fileRelativePath = "";
    if (rootDir) {
      const rootDirIndex = normalizedModulePath.lastIndexOf(
        "/" + rootDir + "/"
      );
      if (rootDirIndex !== -1) {
        // 找到了 rootDir，提取其后的路径
        fileRelativePath = normalizedModulePath.substring(
          rootDirIndex + rootDir.length + 2
        );
      } else {
        // 检查是否以 rootDir 结尾
        const rootDirEndIndex = normalizedModulePath.lastIndexOf("/" + rootDir);
        if (
          rootDirEndIndex !== -1 &&
          rootDirEndIndex + rootDir.length + 1 === normalizedModulePath.length
        ) {
          // modulePath 以 rootDir 结尾，说明这就是根目录
          const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
          fileRelativePath = normalizedModulePath.substring(lastSlashIndex + 1);
        } else {
          // 没有找到 rootDir，使用文件名
          const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
          fileRelativePath =
            lastSlashIndex !== -1
              ? normalizedModulePath.substring(lastSlashIndex + 1)
              : normalizedModulePath;
        }
      }
    } else {
      // 没有配置 rootDir，使用文件名
      const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
      fileRelativePath =
        lastSlashIndex !== -1
          ? normalizedModulePath.substring(lastSlashIndex + 1)
          : normalizedModulePath;
    }

    // 获取文件名（不含扩展名）作为变量名
    const pathParts = fileRelativePath.split("/");
    const lastPart = pathParts[pathParts.length - 1];

    // 移除文件扩展名
    const nameWithoutExt = lastPart.replace(/\.(tsx?|jsx?)$/, "");

    // 将文件名转换为 camelCase + Translations（与TranslationManager的getModuleName保持一致）
    // TestFixedComponent -> testFixedComponentTranslations
    // Header2 -> header2Translations
    const camelCaseName =
      nameWithoutExt.charAt(0).toLowerCase() + nameWithoutExt.slice(1);
    return `${camelCaseName}Translations`;
  }

  /**
   * 获取翻译文件的导入路径
   * @param currentFilePath 当前文件路径
   * @param modulePath 模块路径
   * @param config 配置对象
   * @returns 导入路径
   */
  static getTranslationImportPath(
    currentFilePath: string,
    modulePath: string,
    config: I18nConfig
  ): string {
    // 路径逻辑: @translate + 当前文件相对于扫描入口的路径
    // 例如：demo/src/TestNewComponent.tsx -> @translate/TestNewComponent

    const path = require("path");

    // 规范化 rootDir，移除 ./ 前缀和末尾的斜杠
    let rootDir = "";
    if (config.rootDir) {
      rootDir = config.rootDir.replace(/^\.\//, "").replace(/\/$/, "");
    }

    // 规范化 modulePath（处理 Windows 路径分隔符）
    const normalizedModulePath = modulePath.replace(/\\/g, "/");

    // 查找 rootDir 在 modulePath 中的位置
    let fileRelativePath = "";
    if (rootDir) {
      const rootDirIndex = normalizedModulePath.lastIndexOf(
        "/" + rootDir + "/"
      );
      if (rootDirIndex !== -1) {
        // 找到了 rootDir，提取其后的路径
        fileRelativePath = normalizedModulePath.substring(
          rootDirIndex + rootDir.length + 2
        );
      } else {
        // 检查是否以 rootDir 结尾
        const rootDirEndIndex = normalizedModulePath.lastIndexOf("/" + rootDir);
        if (
          rootDirEndIndex !== -1 &&
          rootDirEndIndex + rootDir.length + 1 === normalizedModulePath.length
        ) {
          // modulePath 以 rootDir 结尾，说明这就是根目录
          const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
          fileRelativePath = normalizedModulePath.substring(lastSlashIndex + 1);
        } else {
          // 没有找到 rootDir，使用文件名
          const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
          fileRelativePath =
            lastSlashIndex !== -1
              ? normalizedModulePath.substring(lastSlashIndex + 1)
              : normalizedModulePath;
        }
      }
    } else {
      // 没有配置 rootDir，使用文件名
      const lastSlashIndex = normalizedModulePath.lastIndexOf("/");
      fileRelativePath =
        lastSlashIndex !== -1
          ? normalizedModulePath.substring(lastSlashIndex + 1)
          : normalizedModulePath;
    }

    // 移除文件扩展名
    const fileNameWithoutExt = fileRelativePath.replace(/\.(tsx?|jsx?)$/, "");

    // 返回完整的导入路径
    return `@translate/${fileNameWithoutExt}`;
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
