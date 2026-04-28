import { describe, expect, it } from "vitest";
import { codexHandoffCropUrl, codexHandoffScreenshotUrl, codexHandoffStatusUrl } from "./client";

describe("Codex handoff client helpers", () => {
  it("builds the resume status URL for a handoff ID", () => {
    expect(codexHandoffStatusUrl("1331d7ff-2153-4168-8223-beefd02a1d69")).toBe(
      "/api/codex-handoff?id=1331d7ff-2153-4168-8223-beefd02a1d69",
    );
  });

  it("builds the screenshot preview URL for a handoff ID", () => {
    expect(codexHandoffScreenshotUrl("1331d7ff-2153-4168-8223-beefd02a1d69")).toBe(
      "/api/codex-handoff?id=1331d7ff-2153-4168-8223-beefd02a1d69&asset=screenshot",
    );
  });

  it("URL encodes handoff IDs before placing them in query strings", () => {
    expect(codexHandoffScreenshotUrl("id with spaces")).toBe("/api/codex-handoff?id=id%20with%20spaces&asset=screenshot");
  });

  it("builds a field-specific crop URL for a handoff item confirmation", () => {
    expect(codexHandoffCropUrl("handoff id", "shopItems.0.name")).toBe(
      "/api/codex-handoff?id=handoff%20id&asset=crop&field=shopItems.0.name",
    );
  });
});
