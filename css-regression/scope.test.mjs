import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

import { JSDOM } from "jsdom";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

import { scopeEditorCss } from "../scripts/build-css.mjs";

const { document } = new JSDOM(`
  <div class="host">
    <section id="editor" class="react-image-editor flex dark">
      <button id="control" class="rie-action flex">Control</button>
    </section>
    <button id="outside" class="rie-action flex">Host</button>
    <button id="portal" class="rie-overlay rie-action flex" data-theme="light">Portal</button>
  </div>
`).window;

function matching(selector) {
  return [...document.querySelectorAll(selector)].map((element) => element.id);
}

test("utilities match editor/portal roots and descendants, never host class collisions", async () => {
  const css = postcss.parse(await scopeEditorCss(".flex, button.rie-action { display: flex }"));
  assert.deepEqual(matching(css.first.selector), ["editor", "control", "portal"]);
});

test("scopes the subject of complex selectors, including escaping siblings and selector lists", async () => {
  const css = postcss.parse(await scopeEditorCss(`
    .host > :is(.flex, .rie-action), .react-image-editor + button { color: red }
  `));
  assert.deepEqual(matching(css.first.selector), ["editor", "portal"]);
});

test("Tailwind :root/:host theme declarations belong to scope roots, including :host conditions", async () => {
  const css = postcss.parse(await scopeEditorCss(`
    :root, :host { --spacing: .25rem }
    :host(.dark), :host([data-theme="light"]) { --conditional: 1 }
  `));
  for (const rule of css.nodes) assert.deepEqual(matching(rule.selector), ["editor", "portal"]);
});

test("bare and qualified pseudo-elements keep the guard on their originating element", async () => {
  const css = postcss.parse(await scopeEditorCss(`
    ::before, ::after, :before, ::backdrop, ::file-selector-button { box-sizing: border-box }
    .flex::before, .flex::after { content: "test" }
  `));
  for (const rule of css.nodes) {
    selectorParser((selectors) => {
      selectors.each((selector) => {
        assert.equal(selector.nodes.some((node) => node.type === "combinator"), false);
        assert.equal(selector.last.type, "pseudo");
        selector.last.remove();
        assert.deepEqual(matching(selector.toString()), ["editor", "control", "portal"]);
      });
    }).processSync(rule.selector);
  }
});

test("keeps nested selectors, media/supports, keyframes and property registrations valid", async () => {
  const input = `
    @layer properties, rie-properties;
    @property --probe { syntax: "<number>"; inherits: false; initial-value: 0 }
    @keyframes probe { from { opacity: 0 } 50%, to { opacity: 1 } }
    @-webkit-keyframes legacy { from { opacity: 0 } to { opacity: 1 } }
    .flex {
      @media (min-width: 1px) {
        & > .rie-action { animation: probe 1s }
        @supports (display: grid) { & + button::before { content: "nested" } }
      }
    }
  `;
  const before = postcss.parse(input);
  const after = postcss.parse(await scopeEditorCss(input));
  assert.equal(after.first.params, "rie-properties, rie-properties");
  for (const name of ["property", "keyframes", "-webkit-keyframes"]) {
    assert.equal(after.nodes.find((node) => node.name === name).toString(), before.nodes.find((node) => node.name === name).toString());
  }
  const nested = [];
  after.walkRules((rule) => { if (rule.selector.includes("&")) nested.push(rule); });
  assert.equal(nested.length, 2);
  assert.equal(nested[0].parent.name, "media");
  assert.equal(nested[1].parent.name, "supports");
  assert.match(nested[0].selector, /\.rie-action:where\(/);
  assert.match(nested[1].selector, /button:where\(.+\)::before$/);
});

test("public CSS is compiled, locally scoped, and exported without a Tailwind peer", async () => {
  const css = postcss.parse(await readFile(new URL("../styles.css", import.meta.url), "utf8"));
  css.walkAtRules((rule) => {
    assert.equal(["import", "tailwind", "theme", "source", "apply", "custom-variant"].includes(rule.name), false, rule.toString());
    if (rule.name === "layer") {
      for (const name of rule.params.split(",")) assert.match(name.trim(), /^rie-(properties|theme|base|utilities)$/);
    }
  });
  css.walkRules((rule) => {
    if (rule.parent.type === "atrule" && rule.parent.name.endsWith("keyframes")) return;
    selectorParser((selectors) => {
      selectors.each((selector) => assert.match(selector.toString(), /:where\(\.react-image-editor,/));
      selectors.walkPseudos((pseudo) => assert.equal([":root", ":host"].includes(pseudo.value), false));
    }).processSync(rule.selector);
  });
  const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(metadata.exports["./styles.css"], "./styles.css");
  assert.ok(metadata.files.includes("styles.css"));
  assert.equal(metadata.peerDependencies.tailwindcss, undefined);
});
