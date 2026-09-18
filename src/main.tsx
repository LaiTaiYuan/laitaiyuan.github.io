import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Home from "./Home";
import "./toolbox.css";
import "./portfolio.css";

// Belt and braces for the inline script in index.html: mark the page for
// reveal-on-scroll before hydration (see useReveal in motion.ts).
if ("IntersectionObserver" in window) {
  document.documentElement.classList.add("tb-js");
}

const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Home />
  </StrictMode>
);
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
