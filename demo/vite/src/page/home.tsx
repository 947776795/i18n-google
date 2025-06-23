import { I18nUtil } from "@utils";
import homeTranslations from "@translate/page/home";
import React from "react";

const I18n = I18nUtil.createScoped(homeTranslations);

const TestFixedComponent: React.FC = () => {
  const userName = "Bob";
  const count = 3;

  return (
    <div>
      <p>{I18n.t("Fixed path test component")}</p>
      <span>{I18n.t("User Profile Settings")}</span>
      <button>{I18n.t("Apply Changes")}</button>
      <div>
        {I18n.t("Welcome %{var0}, you have %{var1} pending tasks", {
          var0: userName,
          var1: count,
        })}
      </div>
    </div>
  );
};

export default TestFixedComponent;
