import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Toolbox from "./Toolbox";
import "./toolbox.css";

// Marks the page for reveal-on-scroll before the first paint, so sections
// below the fold never flash before fading in (see useReveal in Toolbox.tsx).
if ("IntersectionObserver" in window) {
  document.documentElement.classList.add("tb-js");
}

// Standalone public entry for Leonard's personal website.
const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Toolbox />
  </StrictMode>
);
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
