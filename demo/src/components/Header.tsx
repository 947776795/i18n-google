import React from "react";
import "./Header.css";
import { I18n } from "@utils";

const Header: React.FC = () => {
  const t = "cccc";
  return (
    <header className={I18n.t("36c77256")}>
      <div className="header-content">
        <h1 className="logo">{I18n.t("a5eddb10")}{}{I18n.t("3301be53")}</h1>
        <h1 className="logo">{I18n.t("f48fde79", {
          var0: "ddd"
        })}</h1>
        <h1 className="logo">{I18n.t("d1dadea1")}</h1>
        <h1 className="logo">{I18n.t("c687e060")}</h1>
      </div>
    </header>
  );
};

export default Header;
