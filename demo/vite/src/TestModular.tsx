import { I18nUtil } from "@utils";
import testModularTranslations from "@translate/TestModular";
import React from "react";

const I18n = I18nUtil.createScoped(testModularTranslations);

const TestNewComponent: React.FC = () => {
  const userName = "Alice";
  const messageCount = 5;

  return (
    <div>
      <h1>{I18n.t("Welcome to our new system")}</h1>
      <p>{I18n.t("This is a test for modular translation")}</p>
      <span>{I18n.t("User Dashboard")}</span>
      <button>{I18n.t("Save Changes")}</button>
      <div>{I18n.t("Hello %{var0}, you have %{var1} new notifications", {
          var0: userName,
          var1: messageCount
        })}</div>
      <p>{I18n.t("Please check your settings")}</p>
    </div>
  );
};

export default TestNewComponent;
