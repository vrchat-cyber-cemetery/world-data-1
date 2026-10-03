import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "config/repository.json"), "utf8"));
assert.equal(config.schema_version, 1);
assert.equal(config.repository, path.basename(root));
assert.equal(config.main_repository, config.organization + ".github.io");
assert.equal(config.protocol_version, 1);
if (config.role === "runtime-shard") {
  assert([0, 1].includes(config.shard_index));
  assert.equal(config.first_pack, config.shard_index * 256);
  assert.equal(config.last_pack, config.first_pack + 255);
  assert.equal(config.pack_count, 256);
  assert.equal(config.max_pack_bytes, 2228256);
  assert(config.max_pack_bytes * config.pack_count < config.max_site_bytes);
  assert.equal(config.site_base, "https://" + config.organization + ".github.io/" + config.repository);
} else {
  assert.equal(config.role, "unity-world");
  assert.equal(config.target_platform, "windows_pc_pcvr");
  assert.equal(config.catalog_url, "https://" + config.organization + ".github.io/catalog.json");
  assert.equal(config.data_site_bases.length, 2);
}
for (const file of ["README.md", "LICENSE", ".gitignore"]) assert(fs.existsSync(path.join(root, file)));
console.log("PASS " + config.repository + " role, protocol, endpoint and repository foundation");
