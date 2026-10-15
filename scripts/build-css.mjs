import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { build } from "vite";

const repo = fileURLToPath(new URL("../", import.meta.url));
const roots = selectorParser().astSync(":where(.react-image-editor, .rie-overlay)").first.first;
const targets = selectorParser().astSync(
  ":where(.react-image-editor, .react-image-editor *, .rie-overlay, .rie-overlay *)",
).first.first;

function isKeyframe(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && /(?:^|-)keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

export async function scopeEditorCss(css) {
  const result = await postcss([{
    postcssPlugin: "scope-react-image-editor",
    Once(root) {
      // Tailwind emits a fallback layer for its registered custom properties.
      root.walkAtRules("layer", (rule) => {
        rule.params = rule.params.split(",").map((name) =>
          name.trim() === "properties" ? name.replace("properties", "rie-properties") : name).join(",");
      });
      root.walkRules((rule) => {
        // `from`, `to`, and percentages are animation steps, not DOM selectors.
        // @property declarations likewise remain intact.
        if (isKeyframe(rule)) return;
        rule.selector = selectorParser((selectors) => {
          selectors.walkPseudos((pseudo) => {
            if (pseudo.value !== ":root" && pseudo.value !== ":host") return;
            const condition = pseudo.nodes?.length
              ? selectorParser.pseudo({ value: ":is", nodes: pseudo.nodes.map((node) => node.clone()) })
              : null;
            pseudo.replaceWith(roots.clone(), ...(condition ? [condition] : []));
          });
          selectors.each((selector) => {
            // Gate the matched element, rather than prefixing an ancestor. This
            // includes utility classes on the editor/portal root and prevents
            // nested sibling selectors from escaping it. :where adds no weight.
            const subject = selector.nodes.slice(selector.nodes.findLastIndex((node) => node.type === "combinator") + 1);
            const pseudoElement = subject.find((node) => node.type === "pseudo" &&
              (node.value.startsWith("::") || /^:(before|after|first-line|first-letter)$/.test(node.value)));
            if (pseudoElement) {
              const scope = targets.clone();
              // Leading whitespace after a comma belongs before the new guard,
              // not between the guard and the pseudo-element (a combinator).
              scope.rawSpaceBefore = pseudoElement.rawSpaceBefore;
              pseudoElement.rawSpaceBefore = "";
              selector.insertBefore(pseudoElement, scope);
            } else selector.append(targets.clone());
          });
        }).processSync(rule.selector);
      });
    },
  }]).process(css, { from: undefined });
  return result.css;
}

async function buildEditorCss(watch) {
  const result = await build({
    configFile: false,
    root: repo,
    publicDir: false,
    logLevel: "warn",
    css: { postcss: { plugins: [] } },
    plugins: [tailwindcss(), {
      name: "emit-scoped-editor-css",
      enforce: "post",
      async generateBundle(_options, bundle) {
        const assets = Object.values(bundle).filter((entry) => entry.type === "asset" && entry.fileName.endsWith(".css"));
        if (assets.length !== 1) throw new Error(`Expected one editor CSS asset, received ${assets.length}`);
        const css = await scopeEditorCss(String(assets[0].source));
        await writeFile(path.join(repo, "styles.css"), `/* Generated from styles.source.css by npm run build:css. Do not edit. */\n${css}`);
      },
    }],
    build: {
      write: false,
      cssMinify: false,
      watch: watch ? {} : null,
      rollupOptions: { input: path.join(repo, "styles.source.css") },
    },
  });
  if (watch) {
    await new Promise((resolve, reject) => {
      result.on("event", (event) => {
        if (event.code === "END") resolve();
        if (event.code === "ERROR") reject(event.error);
      });
    }).catch(async (error) => { await result.close(); throw error; });
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dev = process.argv[2] === "--dev";
  const watch = dev || process.argv[2] === "--watch";
  const watcher = await buildEditorCss(watch);
  if (dev) {
    // Keep Vite's CLI flags and config working, and close the CSS watcher with it.
    const vite = spawn(process.execPath, [path.join(repo, "node_modules/vite/bin/vite.js"), ...process.argv.slice(3)], { stdio: "inherit" });
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => vite.kill(signal));
    vite.once("exit", async (code) => { await watcher.close(); process.exitCode = code ?? 0; });
    vite.once("error", async (error) => { await watcher.close(); throw error; });
  } else if (watch) {
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await watcher.close(); });
  }
}
