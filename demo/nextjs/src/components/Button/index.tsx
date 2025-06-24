import { I18nUtil } from "@utils";
import Translations from "@translate/components/Button/index";
import React from "react";

const I18n = I18nUtil.createScoped(Translations);

export default function Button() {
  return (
    <div>
      <div>{I18n.t("I18n22")}</div>
      <div>{I18n.t("I18n5")}</div>
      <div>{I18n.t("I18n4")}</div>
    </div>
  );
}
