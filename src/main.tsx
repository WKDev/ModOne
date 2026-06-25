import { enableMapSet } from "immer";
enableMapSet();

// Install the browser runtime BEFORE anything imports @tauri-apps/api so that
// `invoke()` calls resolve against our JS/IndexedDB backend when running as a
// pure web app. No-op under native Tauri (guarded by __TAURI_INTERNALS__).
import { installBrowserRuntime } from "./platform/browser";
installBrowserRuntime();

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
