// Level 2 Component
import React from "react";
import LevelThreeComponent from "./LevelThreeComponent";

export default function LevelTwoComponent() {
  return (
    <div className="level-two">
      <h3>Level Two Component</h3>
      <p>Welcome to the second level of component nesting</p>
      <p className="level-two-desc">This component contains Level Three</p>
      <LevelThreeComponent />
    </div>
  );
}
