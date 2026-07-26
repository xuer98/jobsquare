// Generic mount point. `@problem/App` is aliased to whichever problem folder you ran,
// so the problem folder itself only ever needs to contain App.tsx (or App.jsx).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@problem/App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
