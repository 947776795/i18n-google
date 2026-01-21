// Level 1 Component
import React from "react";
import LevelTwoComponent from "./LevelTwoComponent";

export default function LevelOneComponent() {
  return (
    <div className="level-one">
      <h2>Level One Component</h2>
      <p>This is the first nested component</p>
      <p className="intro-text">Starting point of our nested journey</p>
      <LevelTwoComponent />
    </div>
  );
}
