import { I18nUtil } from "@utils";
import Translations from "@translate/app/[locale]/server-test/page";
interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ServerTestPage({ params }: PageProps) {
  // 获取路由参数
  const { locale: routeLocale } = await params;
  const I18n = I18nUtil.createScoped(Translations, routeLocale);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        {I18n.t("Server Component I18n Test")}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 自动检测的语言 */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">
            {I18n.t("Auto-detected Locale")}
          </h2>
          <div className="space-y-2">
            <p>
              <strong>{I18n.t("Detected locale:")}</strong>
            </p>
            <p>
              <strong>{I18n.t("Welcome message:")}</strong>
              {I18n.t("get_started_by_editing")}
            </p>
            <p>
              <strong>{I18n.t("Deploy button:")}</strong>
              {I18n.t("deploy_now")}
            </p>
            <p>
              <strong>{I18n.t("Docs link:")}</strong>
              {I18n.t("read_our_docs")}
            </p>
          </div>
        </div>

        {/* 手动指定的语言 */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-800">
            {I18n.t("Manual Locale (from route)")}
          </h2>
          <div className="space-y-2">
            <p>
              <strong>{I18n.t("Route locale:")}</strong> {routeLocale}
            </p>
            <p>
              <strong>{I18n.t("Manual locale:")}</strong> {routeLocale}
            </p>
            <p>
              <strong>{I18n.t("Welcome message:")}</strong>
              {I18n.t("get_started_by_editing")}
            </p>
            <p>
              <strong>{I18n.t("Deploy button:")}</strong>
              {I18n.t("deploy_now")}
            </p>
            <p>
              <strong>{I18n.t("Docs link:")}</strong>
              {I18n.t("read_our_docs")}
            </p>
          </div>
        </div>
      </div>
      {/* 对比信息 */}
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">{I18n.t("Comparison")}</h2>
        <div className="space-y-2">
          <p>
            <strong>{I18n.t("Auto vs Manual locale match:")}</strong>{" "}
            <span
              className={
                routeLocale === routeLocale ? "text-green-600" : "text-red-600"
              }
            >
              {routeLocale === routeLocale ? "✓ Match" : "✗ Different"}
            </span>
          </p>
          <p>
            {I18n.t("/%{var0} /server-test", {
              var0: routeLocale,
            })}
          </p>
        </div>
      </div>
      {/* 返回链接 */}
      <div className="mt-8">
        <a
          href={`/${routeLocale}`}
          className="inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          {I18n.t("Back to Home")}
        </a>
      </div>
      <div>{I18n.t("test translate")}</div>
      <div>{I18n.t("test translate 1 one")}</div>
      <div>{I18n.t("test translate 1 two")}</div>
      <div>{I18n.t("test translate 1 three")}</div>
      <div>{I18n.t("test translate 1 four")}</div>
      <div>{I18n.t("test translate 1 five")}</div>
      <div>{I18n.t("test translate 1 six")}</div>
      <div>{I18n.t("test translate 1 seven")}</div>
      <div>{I18n.t("test translate 1 eight")}</div>
      <div>{I18n.t("test translate 1 nine")}</div>
      <div>{I18n.t("test translate 1 ten")}</div>
      <div>{I18n.t("test translate 1 eleven")}</div>
      <div>{I18n.t("test translate 1 twelve")}</div>
      <div>{I18n.t("test translate 1 thirteen")}</div>
      <div>{I18n.t("test translate 1 fourteen")}</div>
      <div>{I18n.t("test translate 1 fifteen")}</div>
    </div>
  );
}
