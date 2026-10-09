import { describe, expect, it } from "vitest";
import { AAC_POSITIONING } from "@/lib/positioning";

describe("AAC positioning copy", () => {
  it("describes the platform as AAC-enabled and AAC-supported", () => {
    const blob = Object.values(AAC_POSITIONING).join(" ");
    expect(blob).toContain("AAC-enabled");
    expect(blob).toContain("AAC-supported");
  });

  it("explicitly avoids claiming to be an AAC system", () => {
    expect(AAC_POSITIONING.boundary).toMatch(/not a substitute for a full AAC system/i);
  });

  it("tells the reader every activity accepts multiple response modes", () => {
    expect(AAC_POSITIONING.responseModesLine).toMatch(/tap/i);
    expect(AAC_POSITIONING.responseModesLine).toMatch(/switch/i);
    expect(AAC_POSITIONING.responseModesLine).toMatch(/dwell/i);
  });
});
