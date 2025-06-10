import React from "react";
import "./Header.css";
import { I18n } from "@utils";

const Header: React.FC = () => {
  const t = "cccc";
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="logo">
          {I18n.t("a55108d8", {
            var0: t,
          })}
        </h1>
        <h1 className="logo">{I18n.t("d1dadea1")}</h1>
        <h1 className="logo">{I18n.t("c687e060")}</h1>
      </div>
    </header>
  );
};

export default Header;
