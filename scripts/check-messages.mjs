import { readdirSync, readFileSync } from "node:fs";

// JSON.parse silently keeps the last of two equal keys, which once broke a label; fail loudly instead.
let failed = false;
for (const file of readdirSync("messages").filter((f) => f.endsWith(".json"))) {
  const source = readFileSync(`messages/${file}`, "utf8");
  const scopes = [{ path: "", keys: new Set() }];
  let lastKey = "";

  for (const match of source.matchAll(/(\{)|(\})|"((?:[^"\\]|\\.)*)"\s*:/g)) {
    if (match[1]) {
      const parent = scopes.at(-1).path;
      scopes.push({ path: lastKey ? `${parent}${lastKey}.` : parent, keys: new Set() });
      lastKey = "";
    } else if (match[2]) {
      scopes.pop();
    } else {
      const scope = scopes.at(-1);
      if (scope.keys.has(match[3])) {
        console.error(`${file}: duplicate key "${scope.path}${match[3]}"`);
        failed = true;
      }
      scope.keys.add(match[3]);
      lastKey = match[3];
    }
  }
}

if (failed) {
  process.exit(1);
}
