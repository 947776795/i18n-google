"use client";
import Translations from "@translate/components/ClientHome";
import { I18nUtil } from "@utils";
import Image from "next/image";
// import { TEST, TEST2 } from "@/const/const";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getConstants } from "@/const/const";

// const I18n = I18nUtil.createScoped(Translations);

interface ClientHomeProps {
  locale: string;
}

export default function ClientHome({ locale }: ClientHomeProps) {
  // 创建 I18n 实例，使用传入的 locale
  console.log("localelocale", locale);
  const I18n = I18nUtil.createScopedSync(Translations, locale);
  const { TEST, TEST2 } = getConstants(locale);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      {/* 语言切换器 */}
      <div className="row-start-1 justify-self-end">
        <LanguageSwitcher />
      </div>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            {I18n.t("get_started_by_editing")}{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
              {I18n.t("src/app/page.tsx")}
            </code>
            .
          </li>
          <li>{I18n.t("save_and_see_changes_instantly")}</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            {I18n.t("deploy_now")}
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            {I18n.t("read_our_docs")}
          </a>
        </div>
        <div>
          <p>
            {I18n.t("const_test")}: {TEST}
          </p>
          <p>
            {I18n.t("const_test2")}: {TEST2}
          </p>
          <p>
            {I18n.t("Current locale: %{var0}", {
              var0: locale,
            })}
          </p>

          {/* 添加到服务端测试页面的链接 */}
          <div className="mt-4">
            <a
              href={`/${locale}/server-test`}
              className="inline-block bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
            >
              {I18n.t("Test Server Component I18n")}
            </a>
          </div>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          {I18n.t("learn")}
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          {I18n.t("examples")}
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          {I18n.t("go_to_nextjs")}
        </a>
        <span className="body_m_regular text-content_secondary mt-2">
          {I18n.t(
            "Welcome to Edgen Private Beta, anon! Drop your invite code below to unlock Alpha before everyone else."
          )}
        </span>
        <div className="mt-2">
          <p>{I18n.t("test_new_mark_field")}</p>
        </div>
      </footer>
    </div>
  );
}
