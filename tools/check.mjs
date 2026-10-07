import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
  // Every deployed pack must match the approved build manifest by header, index math and SHA-256.
  const manifestPath = path.join(root, "public/manifest.json");
  assert(fs.existsSync(manifestPath), "public/manifest.json missing; regenerate packs with the main repository builder");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.layout_version, config.layout_version);
  assert.equal(manifest.pack_count, config.pack_count);
  assert.equal(manifest.packs.length, config.pack_count);
  assert.equal(manifest.repository, config.organization + "/" + config.repository);
  let total = 0;
  for (const record of manifest.packs) {
    assert(Number.isInteger(record.pack) && record.pack >= config.first_pack && record.pack <= config.last_pack, "pack index outside this shard");
    assert.equal(record.region, Math.floor(record.pack / 8));
    assert.equal(record.group, record.pack % 8);
    const file = path.join(root, "public/packs", String(record.pack).padStart(3, "0") + ".bin");
    assert(fs.existsSync(file), "missing pack " + record.pack);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.length, record.bytes, "pack size drift " + record.pack);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), record.sha256, "pack hash drift " + record.pack);
    assert(bytes.length <= config.max_pack_bytes);
    assert.equal(bytes.subarray(0, 8).toString("ascii"), "CCPACK01");
    const jsonLength = bytes.readUInt32LE(8);
    assert.equal(bytes.readUInt32LE(12), 0, "metadata-only shard must not declare pixels");
    assert(bytes.readUInt16LE(16) === 0 && bytes.readUInt16LE(18) === 0 && bytes[20] === 0 && bytes[21] === 0 && bytes.readUInt16LE(22) === 0, "non-empty texture header fields");
    assert(bytes.subarray(24, 32).every(x => x === 0), "reserved header bytes must stay zero");
    assert.equal(bytes.length, 32 + jsonLength, "trailing or truncated pack " + record.pack);
    const meta = JSON.parse(bytes.subarray(32, 32 + jsonLength).toString("utf8"));
    assert.equal(meta.schema, 1);
    assert.equal(meta.community_id, config.organization);
    assert.equal(meta.layout_version, config.layout_version);
    assert.equal(meta.region, record.region);
    assert.equal(meta.group, record.group);
    assert.equal(meta.revision, record.revision);
    assert.equal(meta.entries.length, 8);
    total += bytes.length;
  }
  assert.equal(total, manifest.total_bytes);
  assert(total < config.max_site_bytes);
  for (const file of ["public/.nojekyll", "public/index.html"]) assert(fs.existsSync(path.join(root, file)));
} else {
  assert.equal(config.role, "unity-world");
  assert.equal(config.target_platform, "windows_pc_pcvr");
  assert.equal(config.catalog_url, "https://" + config.organization + ".github.io/catalog.json");
  assert.equal(config.data_site_bases.length, 2);
}
for (const file of ["README.md", "LICENSE", ".gitignore"]) assert(fs.existsSync(path.join(root, file)));
console.log("PASS " + config.repository + " role, protocol and " + config.pack_count + " verified packs");
