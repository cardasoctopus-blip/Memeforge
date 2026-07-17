/** Mount point. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { EditorProvider } from "./EditorContext";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("No #root element to mount MemeForge into.");

createRoot(container).render(
  <StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </StrictMode>,
);
