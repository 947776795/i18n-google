import { I18nUtil } from "@utils";
import pageTranslations from "@translate/app/page";
import Image from "next/image";
import { TEST, TEST2 } from "@/const/const";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function Home({ searchParams }: PageProps) {
  // 服务端组件：传入 searchParams
  const I18n = I18nUtil.createScoped(pageTranslations, searchParams);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      {/* 语言切换器 */}
      <div className="row-start-1 justify-self-end">
        <LanguageSwitcher />
      </div>
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />

        <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="tracking-[-.01em]">
            {I18n.t("Demo: %{var0} - %{var1}", {
              var0: TEST,
              var1: TEST2,
            })}
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
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
            {I18n.t("Deploy now")}
          </a>
        </div>
        <div>{I18n.t("I18n3")}</div>
      </main>
    </div>
  );
}
