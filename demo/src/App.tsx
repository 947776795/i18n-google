import { I18n } from "@utils";
import { useState } from "react";
import Header from "./components/Header";
import UserCard from "./components/UserCard";
import ProductList from "./components/ProductList";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Header />
      <div className="app-container">
        <h1>{I18n.t("4ac6728e")}</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            %Count is% {count}
          </button>
          <p>{I18n.t("62ae121c")}</p>
        </div>

        <UserCard />
        <ProductList />

        <div className="description">
          <p>
            %This is a demo application for testing i18n Google Sheets
            integration%
          </p>
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
