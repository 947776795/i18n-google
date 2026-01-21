// Level 3 Component
import React from "react";
import LevelFourComponent from "./LevelFourComponent";

export default function LevelThreeComponent() {
  return (
    <div className="level-three">
      <h4>Level Three Component</h4>
      <p>Text from the third level of nesting</p>
      <LevelFourComponent />
    </div>
  );
}
