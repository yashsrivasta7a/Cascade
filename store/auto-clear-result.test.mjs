// Self-check for the "auto-clear stale result" rule in flow-store's updateNode.
// Run: node store/auto-clear-result.test.mjs
// Mirrors the logic in updateNode; keep in sync if that branch changes.
import assert from "node:assert/strict";

const MEDIA_INPUT_FIELDS = [
  "inputImage", "inputVideo", "inputAudio", "inputVideo1", "inputVideo2",
  "inputFrame", "referenceImages", "video", "audio", "image", "video1", "video2",
];

const assetKey = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(assetKey).join("|");
  if (typeof value === "object" && "url" in value) return String(value.url ?? "");
  return JSON.stringify(value);
};

// Returns true when updateNode would wipe the existing result.
function clearsResult(oldData, data) {
  const isExecutionWrite = "result" in data || "status" in data;
  const changed = !isExecutionWrite && MEDIA_INPUT_FIELDS.some((f) =>
    f in data && assetKey(data[f]) !== assetKey(oldData[f])
  );
  return changed && oldData.result !== undefined;
}

// A completed node reporting its output must never clear its own result.
assert.equal(
  clearsResult(
    { result: "https://cdn/old.mp4", inputVideo: "https://cdn/in.mp4" },
    { result: "https://cdn/new.mp4", status: "completed", progress: 100 }
  ),
  false,
  "execution write must not self-clear"
);

// Propagation replaying an identical upstream URL is not a change.
assert.equal(
  clearsResult(
    { result: "https://cdn/out.mp4", inputVideo: "https://cdn/in.mp4" },
    { inputVideo: "https://cdn/in.mp4" }
  ),
  false,
  "identical media re-write must not clear"
);

// Same asset in object form is still the same asset.
assert.equal(
  clearsResult(
    { result: "https://cdn/out.png", image: "https://cdn/a.png" },
    { image: { url: "https://cdn/a.png" } }
  ),
  false,
  "object/string forms of one URL must not clear"
);

// A genuine user swap of the input does invalidate the old result.
assert.equal(
  clearsResult(
    { result: "https://cdn/out.mp4", inputVideo: "https://cdn/a.mp4" },
    { inputVideo: "https://cdn/b.mp4" }
  ),
  true,
  "changed media must clear stale result"
);

// Clearing the input also invalidates the result.
assert.equal(
  clearsResult(
    { result: "https://cdn/out.mp4", inputVideo: "https://cdn/a.mp4" },
    { inputVideo: null }
  ),
  true,
  "removed media must clear stale result"
);

// Nothing to clear when there is no result yet.
assert.equal(
  clearsResult({ inputVideo: "https://cdn/a.mp4" }, { inputVideo: "https://cdn/b.mp4" }),
  false,
  "no result means nothing to clear"
);

console.log("auto-clear-result: all checks passed");
