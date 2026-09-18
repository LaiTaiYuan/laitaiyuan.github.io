import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Home from "./Home";
import "./toolbox.css";
import "./portfolio.css";

const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Home />
  </StrictMode>
);
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
