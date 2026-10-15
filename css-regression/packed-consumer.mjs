/* global document, window, getComputedStyle */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

import { build, preview } from "vite";

import { scopeEditorCss } from "../scripts/build-css.mjs";

const execute = promisify(execFile);
const repo = fileURLToPath(new URL("../", import.meta.url));
const fixture = fileURLToPath(new URL("./fixture/", import.meta.url));
const artifacts = await mkdtemp(path.join(process.env.RIE_CSS_ARTIFACTS ?? tmpdir(), "rie-css-package-"));

async function run(command, args, cwd = repo) {
  const { stdout } = await execute(command, args, { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

console.info(`CSS regression artifacts: ${artifacts}`);
// Exercise the real prepack hook as well as the published export map.
await run("npm", ["pack", "--pack-destination", artifacts]);
const archives = (await readdir(artifacts)).filter((name) => name.endsWith(".tgz"));
assert.equal(archives.length, 1);
const archive = path.join(artifacts, archives[0]);

for (const react of ["18.2.0", "19.0.0"]) {
  const root = path.join(artifacts, `react-${react}`);
  await mkdir(root);
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    name: "editor-css-only-consumer", private: true, type: "module",
    dependencies: { "@mukeshsoni/react-image-editor": `file:${archive}`, react, "react-dom": react },
  }, null, 2));
  for (const file of ["index.html", "main.jsx"]) await copyFile(path.join(fixture, file), path.join(root, file));
  await writeFile(path.join(root, "selectors.css"), await scopeEditorCss(await readFile(path.join(fixture, "selectors.source.css"), "utf8")));
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], root);

  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(Object.keys(lock.packages).some((name) => /node_modules\/(tailwindcss|@tailwindcss\/[^/]+)$/.test(name)), false, "Consumer must not install a Tailwind compiler/plugin");
  const packedCss = await readFile(path.join(root, "node_modules/@mukeshsoni/react-image-editor/styles.css"), "utf8");
  assert.equal(packedCss, await readFile(path.join(repo, "styles.css"), "utf8"));

  // No inherited Vite config, aliases, PostCSS config, or Tailwind/React plugin.
  // Vite only bundles the installed package, React, and already-compiled CSS.
  const config = {
    configFile: false, root: await realpath(root), publicDir: false, plugins: [], logLevel: "warn",
    css: { postcss: { plugins: [] } },
    build: { target: "es2022", outDir: "site" },
    preview: { host: "127.0.0.1", port: 0, strictPort: true },
  };
  await build(config);
  const server = await preview(config);
  const session = `rie-css-${process.pid}-${react}`;

  async function browser(...args) {
    const result = JSON.parse(await run("agent-browser", ["--session", session, "--json", ...args]));
    assert.equal(result.success, true, result.error);
    return result.data;
  }
  async function evaluate(fn) {
    return (await browser("eval", `(${fn.toString()})()`)).result;
  }
  async function ref(role, name) {
    const { snapshot, refs } = await browser("snapshot", "-i");
    const entry = Object.entries(refs).find(([, element]) => element.role === role && element.name === name);
    assert.ok(entry, `Missing ${role} ${name}:\n${snapshot}`);
    return `@${entry[0]}`;
  }
  async function click(role, name) {
    await browser("click", await ref(role, name));
  }
  async function open(theme) {
    await browser("open", `${server.resolvedUrls.local[0]}?theme=${theme}`);
    await browser("wait", "--fn", 'Array.from(document.querySelectorAll("#root button")).some(button => button.textContent === "Download" && !button.disabled)');
  }
  async function hostUnchanged() {
    const host = await evaluate(() => ({ before: window.cssRegression.baseline, after: window.cssRegression.hostStyles(), react: window.cssRegression.react }));
    assert.equal(host.react, react);
    assert.deepEqual(host.after, host.before, "Package CSS must preserve browser and custom host styles, even on colliding class names");
    assert.equal(host.after["#browser-heading"]["font-size"], "32px");
    assert.equal(host.after["#browser-heading"].display, "block");
  }

  try {
    await browser("set", "viewport", "1280", "1000");
    for (const theme of ["light", "dark"]) {
      await open(theme);
      await hostUnchanged();
      const styles = await evaluate(() => {
        const editor = document.querySelector('[data-testid="react-image-editor"]');
        const button = [...editor.querySelectorAll("button")].find((element) => element.textContent === "Download");
        const style = getComputedStyle(button);
        const rootStyle = getComputedStyle(editor);
        return {
          display: rootStyle.display, direction: rootStyle.flexDirection, height: rootStyle.height,
          rootBox: rootStyle.boxSizing, theme: rootStyle.colorScheme,
          button: [style.display, style.paddingLeft, style.fontSize, style.fontWeight, style.minHeight, style.borderTopWidth, style.borderTopStyle, style.borderRadius],
          background: style.backgroundColor, icon: getComputedStyle(button.querySelector("svg")).width,
        };
      });
      assert.deepEqual(styles, {
        display: "flex", direction: "column", height: "620px", rootBox: "border-box", theme,
        // An inline-flex button is blockified when it is itself a flex item.
        button: ["flex", "12px", "12px", "500", "36px", "1px", "solid", "6px"],
        background: theme === "light" ? "rgb(21, 128, 61)" : "rgb(74, 222, 128)", icon: "16px",
      });

      const probes = await evaluate(() => {
        const read = (id) => {
          const element = document.getElementById(id), style = getComputedStyle(element);
          const before = getComputedStyle(element, "::before");
          return [style.getPropertyValue("--rie-css-theme"), style.getPropertyValue("--rie-css-host"), style.getPropertyValue("--rie-css-root"), style.opacity, style.getPropertyValue("--rie-css-progress"), before.content, before.boxSizing, getComputedStyle(element, "::after").content];
        };
        return {
          editor: read("probe-editor"), portal: read("probe-portal"), outside: read("probe-outside"),
          nested: ["probe-child", "probe-portal-child"].map((id) => getComputedStyle(document.getElementById(id)).getPropertyValue("--rie-css-nested")),
          escaped: getComputedStyle(document.getElementById("probe-escape")).getPropertyValue("--rie-css-escaped"),
          htmlTheme: getComputedStyle(document.documentElement).getPropertyValue("--rie-css-theme"),
        };
      });
      const expectedProbe = ["local", "conditional", "matched", "0.5", "5", '"scoped-before"', "border-box", '"scoped-after"'];
      assert.deepEqual(probes.editor, expectedProbe);
      assert.deepEqual(probes.portal, expectedProbe);
      assert.deepEqual(probes.outside, ["", "", "", "1", "0", "none", "content-box", "none"]);
      assert.deepEqual(probes.nested, ["matched", "matched"]);
      assert.equal(probes.escaped, "");
      assert.equal(probes.htmlTheme, "");

      await click("button", "Crop");
      await click("combobox", "Aspect ratio");
      await browser("hover", await ref("option", "Custom"));
      const menu = await evaluate(() => {
        const element = document.querySelector('[role="listbox"]');
        const style = getComputedStyle(element);
        return {
          scoped: element.classList.contains("rie-overlay"), portaled: !document.getElementById("root").contains(element),
          background: style.backgroundColor, border: style.borderTopWidth, padding: style.paddingLeft, radius: style.borderRadius, zIndex: style.zIndex,
          highlighted: getComputedStyle(element.querySelector("[data-highlighted]")).backgroundColor,
        };
      });
      assert.deepEqual(menu, {
        scoped: true, portaled: true, background: theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 24, 27)",
        border: "1px", padding: "4px", radius: "6px", zIndex: "50",
        highlighted: theme === "light" ? "rgb(228, 228, 231)" : "rgb(39, 39, 42)",
      });
      await click("option", "Custom");
      await browser("wait", '[role="dialog"]');
      const dialog = await evaluate(() => {
        const element = document.querySelector('[role="dialog"]'), style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const backdrop = [...document.querySelectorAll(".rie-overlay")].find((node) => node.classList.contains("bg-black/50"));
        const shade = getComputedStyle(backdrop), shadeRect = backdrop.getBoundingClientRect();
        const title = getComputedStyle(element.querySelector("h2"));
        return {
          position: style.position, padding: style.paddingLeft, width: rect.width, border: style.borderTopWidth,
          background: style.backgroundColor, box: style.boxSizing,
          centered: Math.abs(rect.x + rect.width / 2 - window.innerWidth / 2) < 1 && Math.abs(rect.y + rect.height / 2 - window.innerHeight / 2) < 1,
          title: [title.fontSize, title.marginTop, title.marginBottom], inputHeight: getComputedStyle(element.querySelector("input")).minHeight,
          backdrop: [shade.position, shade.zIndex, shadeRect.x, shadeRect.y, shadeRect.width, shadeRect.height], shade: shade.backgroundColor,
        };
      });
      assert.deepEqual(dialog, {
        position: "fixed", padding: "24px", width: 384, border: "1px", box: "border-box", centered: true,
        background: theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 24, 27)", title: ["18px", "0px", "16px"], inputHeight: "44px",
        backdrop: ["fixed", "40", 0, 0, 1280, 1000], shade: dialog.shade,
      });
      assert.match(dialog.shade, /(?:0\.5|50%)/);
      await browser("screenshot", path.join(root, `${theme}-dialog.png`));
      await click("button", "Cancel");
      console.info(`PASS React ${react} ${theme}: styled controls, select/dialog/backdrop, selector edge cases, host isolation`);
    }

    await browser("set", "viewport", "390", "844");
    await open("light");
    await hostUnchanged();
    const mobile = await evaluate(() => {
      const button = [...document.querySelectorAll("#root button")].find((element) => element.textContent === "Download");
      return { minHeight: getComputedStyle(button).minHeight, rootWidth: document.getElementById("root").getBoundingClientRect().width, editorWidth: document.querySelector('[data-testid="react-image-editor"]').getBoundingClientRect().width };
    });
    assert.equal(mobile.minHeight, "44px");
    assert.equal(mobile.editorWidth, mobile.rootWidth);
    await browser("screenshot", path.join(root, "mobile.png"));
    console.info(`PASS React ${react} mobile: scoped responsive controls and host isolation; no Tailwind installed`);
  } catch (error) {
    await writeFile(path.join(root, "failure.json"), JSON.stringify({ snapshot: await browser("snapshot"), errors: await browser("errors") }, null, 2));
    await browser("screenshot", path.join(root, "failure.png"));
    throw error;
  } finally {
    await browser("close");
    await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
}
