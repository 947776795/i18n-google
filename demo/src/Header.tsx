import React from "react";
import "./Header.css";
import { I18n } from "@utils";

const Header: React.FC = () => {
  const t = "cccc";
  return (
    <header className={I18n.t("36c77256")}>
      <div className="header-content">
        <h1 className="logo">{I18n.t("e1c383f7")}</h1>
        <h1 className="logo">
          {I18n.t("82f9dc5a", {
            var0: "dddd",
          })}
        </h1>
        <div>{I18n.t("e1c383f7")}</div>
      </div>
    </header>
  );
};

export default Header;
