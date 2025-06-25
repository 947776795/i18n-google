import Translations from "@translate/app/[locale]/page";
import ClientHome from "@/components/ClientHome";
import { I18nUtil } from "@utils";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function Home({ params }: PageProps) {
  // 在服务端获取 locale
  const { locale } = await params;

  // 在组件函数内部创建 I18n 实例，直接传入 locale
  const I18n = await I18nUtil.createScoped(Translations, locale);

  // 验证 locale 是否有效
  if (!I18nUtil.isValidLocale(locale)) {
    // 如果 locale 无效，重定向到默认语言或显示 404
    return (
      <div>
        {I18n.t("Invalid locale: %{var0}", {
          var0: locale,
        })}
      </div>
    );
  }

  // 可以在这里进行服务端的数据获取
  // const serverData = await fetchServerData(locale);

  return <ClientHome locale={locale} />;
}

// 可以添加生成静态参数的函数
export async function generateStaticParams() {
  const locales = I18nUtil.getSupportedLocales();

  return locales.map((locale) => ({
    locale: locale,
  }));
}
