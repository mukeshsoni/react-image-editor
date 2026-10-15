import console from "node:console";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packages = path.join(repo, ".e2e-packages");
await mkdir(packages, { recursive: true });

function run(command, args, cwd = repo) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

const packed = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", packages]));
const tarball = path.join(packages, packed[0].filename);
const hash = createHash("sha256").update(await readFile(tarball)).digest("hex").slice(0, 16);
const archive = path.join(packages, `editor-${hash}.tgz`);
await rename(tarball, archive);

for (const [major, react, reactTypes, domTypes] of [[18, "18.2.0", "18.3.3", "18.3.0"], [19, "19.0.0", "19.0.7", "19.0.3"]]) {
  const root = path.join(repo, ".e2e-consumers", `react-${major}`);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    name: `editor-consumer-react-${major}`, private: true, type: "module",
    dependencies: { "@mukeshsoni/react-image-editor": `file:${archive}`, react, "react-dom": react, tailwindcss: "4.1.8" },
    devDependencies: { "@types/react": reactTypes, "@types/react-dom": domTypes },
  }, null, 2));
  let html = await readFile(path.join(repo, "e2e/host/index.html"), "utf8");
  html = html.replace('src="/main.tsx"', `src="/@fs/${path.join(repo, "e2e/host/main.tsx")}"`);
  await writeFile(path.join(root, "index.html"), html);
  await writeFile(path.join(root, "styles.css"), '@import "@mukeshsoni/react-image-editor/styles.css";\n@source "./node_modules/@mukeshsoni/react-image-editor/dist";\n');
  await writeFile(path.join(root, "consumer.tsx"), `import { useState } from "react";
import { ReactImageEditor, type ImageEditorEdits } from "@mukeshsoni/react-image-editor";
export function Consumer() {
  const [edits, setEdits] = useState<ImageEditorEdits | null>(null);
  return <><ReactImageEditor imageSrc="image.png" themeMode="light" onEditsChange={setEdits} /><output>{edits?.version}</output></>;
}
`);
  await writeFile(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
    target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx",
    strict: true, noEmit: true, skipLibCheck: true, types: ["react", "react-dom"],
  }, include: ["consumer.tsx"] }, null, 2));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], root);
  run("node", [path.join(repo, "node_modules/typescript/bin/tsc"), "-p", path.join(root, "tsconfig.json")]);
  console.info(`Prepared and type-checked React ${react} consumer (${hash})`);
}
