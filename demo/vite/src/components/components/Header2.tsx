import { I18nUtil } from "@utils";
import header2Translations from "@translate/components/components/Header2";
import React from "react";

const I18n = I18nUtil.createScoped(header2Translations);

const TestFixedComponent: React.FC = () => {
  const userName = "Bob";
  const count = 3;

  return (
    <div>
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
