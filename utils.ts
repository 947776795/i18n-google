import crypto from 'crypto';

/**
 * 生成国际化文案key的参数接口
 */
interface I18nKeyParams {
    /** 文件路径 */
    path: string;
    /** 文案内容 */
    text: string;
}

/**
 * 生成国际化文案的唯一key
 * @param params - 生成key的参数
 * @returns 生成的唯一key
 */
export function generateI18nKey(params: I18nKeyParams): string {
    // 从路径中提取模块名
    const { path, text } = params;
    const moduleName = path.split('/')[0];
    const locationString = JSON.stringify({ path,text });
    const hash = crypto
        .createHash('md5')
        .update(locationString)
        .digest('hex')
        .slice(0, 6);
    // 组合模块名和hash
    return `${moduleName}_${hash}`;
}