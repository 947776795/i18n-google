/**
 * 文件操作工具
 */

import * as fs from "fs";
import * as path from "path";
import { Logger } from "./Logger";

/**
 * 文件操作工具类
 */
export class FileUtil {
  /**
   * 确保目录存在，不存在则创建
   */
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      Logger.error(`创建目录失败: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 检查路径是否为文件
   */
  static isFile(filePath: string): boolean {
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 检查路径是否为目录
   */
  static isDir(dirPath: string): boolean {
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 读取文件内容
   */
  static async readFile(filePath: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, encoding);
    } catch (error) {
      Logger.error(`读取文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 写入文件内容
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // 确保父目录存在
      const dir = path.dirname(filePath);
      await this.ensureDir(dir);

      await fs.promises.writeFile(filePath, content, "utf-8");
    } catch (error) {
      Logger.error(`写入文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 读取 JSON 文件
   */
  static async readJson<T = unknown>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content) as T;
    } catch (error) {
      Logger.error(`读取 JSON 文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 写入 JSON 文件
   */
  static async writeJson(filePath: string, data: unknown, indent = 2): Promise<void> {
    try {
      const content = JSON.stringify(data, null, indent);
      await this.writeFile(filePath, content);
    } catch (error) {
      Logger.error(`写入 JSON 文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      Logger.error(`删除文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 删除目录
   */
  static async deleteDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      Logger.error(`删除目录失败: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * 复制文件
   */
  static async copyFile(srcPath: string, destPath: string): Promise<void> {
    try {
      // 确保目标目录存在
      const dir = path.dirname(destPath);
      await this.ensureDir(dir);

      await fs.promises.copyFile(srcPath, destPath);
    } catch (error) {
      Logger.error(`复制文件失败: ${srcPath} -> ${destPath}`, error);
      throw error;
    }
  }

  /**
   * 获取相对路径
   */
  static relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * 拼接路径
   */
  static join(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * 解析绝对路径
   */
  static resolve(...paths: string[]): string {
    return path.resolve(...paths);
  }

  /**
   * 获取目录名
   */
  static dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * 获取文件名（含扩展名）
   */
  static basename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * 获取文件名（不含扩展名）
   */
  static stem(filePath: string): string {
    const base = path.basename(filePath);
    const ext = path.extname(filePath);
    return base.slice(0, base.length - ext.length);
  }

  /**
   * 获取扩展名
   */
  static extname(filePath: string): string {
    return path.extname(filePath);
  }
}
