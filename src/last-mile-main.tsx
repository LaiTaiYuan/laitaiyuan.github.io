import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import LastMile from "./LastMile";
import "./toolbox.css";
import "./lastMile.css";

// 「我的人生最後一哩路」(/last-mile/), prerendered like the other pages.
const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <LastMile />
  </StrictMode>
);
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
