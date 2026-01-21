// Alternate nested branch - Level 1
import React from "react";
import BranchLevelTwo from "./BranchLevelTwo";

export default function AlternateBranch() {
  return (
    <div className="alternate-branch">
      <h3>Alternate Component Branch</h3>
      <p>This is a separate nested component path</p>
      <div className="branch-content">
        <p>Branch level one text</p>
        <BranchLevelTwo />
      </div>
    </div>
  );
}
