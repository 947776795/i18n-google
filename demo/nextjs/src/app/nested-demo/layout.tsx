// Nested Demo Layout - demonstrating 4 levels of component nesting
import React from "react";
import LevelOneComponent from "@/components/nested/LevelOneComponent";
import AlternateBranch from "../../components/nested/AlternateBranch";

export const metadata = {
  title: "Nested Demo - Four Level Component Nesting",
  description: "Demonstrating deep component nesting with i18n extraction",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="nested-demo-container">
          <h1>Nested Component Demo</h1>
          <p className="main-intro">
            This layout demonstrates four levels of component nesting for i18n
            extraction testing.
          </p>

          <LevelOneComponent />
          <AlternateBranch />

          <div className="content-area">{children}</div>
        </div>
      </body>
    </html>
  );
}
