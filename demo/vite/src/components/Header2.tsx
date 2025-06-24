import { I18nUtil } from "@utils";
import header2Translations from "@translate/components/Header2";
import React from "react";

const I18n = I18nUtil.createScoped(header2Translations);

const TestFixedComponent: React.FC = () => {
  const userName = "Bob";
  const count = 3;

  return (
    <div>
      <span>{I18n.t("User Profile Settings")}</span>
    </div>
  );
};

export default TestFixedComponent;
