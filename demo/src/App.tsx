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
          <button onClick={() => setCount((count) => count + 1)}>
            {I18n.t("0c1b17fb", {
              var0: count
            })}{" "}
          </button>
          <p>~</p>
          <p>2~</p>
          <p> ~2~ </p>
          <p>~2</p>
          <p>{a}~</p>
          <p>{a}{I18n.t("86221979")}</p>
        </div>

        <UserCard />
        <ProductList />

        <div className="description">
          <p>this 10% ddd 20%</p>
          <p>
            %The text wrapped with % symbols will be extracted for translation%
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default App;
