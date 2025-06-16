import { I18n } from "@utils";
import { useState } from "react";
import Header from "./components/Header";
import UserCard from "./components/UserCard";
import ProductList from "./components/ProductList";
import "./App.css";

const a = "nihao";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Header />
      <div className="app-container">
        <h1>{I18n.t("4ac6728e")}</h1>
        <div className="card">
          <button>{I18n.t("f6eca793")}{I18n.t("0c1b17fb", {
              var0: count,
            })}{" "}
          </button>
          <p>{I18n.t("4ff08bee")}</p>
          <p>{I18n.t("82f62e4f")}</p>
          <p>{I18n.t("7e84c7ab")}</p>
          <p>{I18n.t("26962607")}</p>
          <p>
            {a}
            {I18n.t("4ff08bee")}
          </p>
          <p>
            {a}
            {I18n.t("86221979")}
          </p>
        </div>

        <UserCard />
        <ProductList />

        <div className="description">
          <p>{I18n.t("e1363e9c")}</p>
          <p>{I18n.t("280a8ebc")}</p>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default App;
