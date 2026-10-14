import React from "react";
import { createRoot } from "react-dom/client";

import { ReactImageEditor } from "@mukeshsoni/react-image-editor";

function hostStyles() {
  const properties = [
    "display", "box-sizing", "margin", "padding", "font-family", "font-size",
    "font-weight", "line-height", "color", "background-color", "border", "border-radius",
    "min-height", "color-scheme", "--spacing", "--rie-background",
  ];
  return Object.fromEntries(["html", "body", "#browser-heading", "#browser-button", "#host-heading", "#host-button"].map((selector) => {
    const style = getComputedStyle(document.querySelector(selector));
    return [selector, Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]))];
  }));
}

// Capture real browser/host defaults before the package stylesheet is loaded.
window.cssRegression = { hostStyles, baseline: hostStyles(), react: React.version };
await import("@mukeshsoni/react-image-editor/styles.css");
await import("./selectors.css");

const image = document.createElement("canvas");
image.width = 320;
image.height = 240;
const context = image.getContext("2d");
context.fillStyle = "#ad583c";
context.fillRect(0, 0, 320, 240);
context.fillStyle = "#dfb858";
context.fillRect(80, 60, 160, 120);
const theme = new URLSearchParams(window.location.search).get("theme") ?? "light";
createRoot(document.getElementById("root")).render(<ReactImageEditor imageSrc={image.toDataURL()} themeMode={theme} />);
