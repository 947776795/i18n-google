"use client";

import { I18nUtil, languageOptions } from "@utils";
import { useParams } from "next/navigation";
import { useState } from "react";

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({
  className = "",
}: LanguageSwitcherProps) {
  const { locale } = useParams();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    setIsOpen(false);
    // 通过页面跳转切换语言
    I18nUtil.switchLocale(newLocale);
  };

  const getCurrentLanguageLabel = () => {
    const currentOption = languageOptions.find(
      (option) => option.value === locale
    );
    return currentOption?.label || "English";
  };

  const getFlagForLocale = (locale: string) => {
    switch (locale) {
      case "zh-Hant":
        return "🇹🇼"; // 台湾旗帜代表繁体中文
      case "en":
        return "🇺🇸"; // 美国旗帜代表英语
      case "zh-Hans":
        return "🇨🇳"; // 中国旗帜代表简体中文
      case "ko":
        return "🇰🇷"; // 韩国旗帜
      default:
        return "🌐"; // 默认地球图标
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* 语言选择按钮 */}
      <button
        type="button"
        className="inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded="true"
        aria-haspopup="true"
      >
        🌐 {getCurrentLanguageLabel()}
        <svg
          className="-mr-1 ml-2 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-600 z-50">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {languageOptions.map((option) => (
              <button
                key={option.value}
                className={`${
                  locale === option.value
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
                    : "text-gray-700 dark:text-gray-200"
                } group flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150`}
                role="menuitem"
                onClick={() => handleLanguageChange(option.value)}
              >
                <span className="mr-3 text-lg">
                  {getFlagForLocale(option.value)}
                </span>
                {option.label}
                {locale === option.value && (
                  <span className="ml-auto text-indigo-600 dark:text-indigo-400">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 点击外部关闭下拉菜单 */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
