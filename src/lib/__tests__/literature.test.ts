import { describe, expect, it } from "vitest";

import { LITERATURE, LITERATURE_THEMES } from "@/lib/literature";

describe("literature evidence", () => {
  it("keeps a concise, sourced review across the three research themes", () => {
    expect(LITERATURE).toHaveLength(6);
    expect(new Set(LITERATURE.map((paper) => paper.theme))).toEqual(new Set(LITERATURE_THEMES));
    expect(LITERATURE.every((paper) => paper.url.startsWith("https://"))).toBe(true);
    expect(LITERATURE.every((paper) => paper.method && paper.finding && paper.connection)).toBe(true);
  });

  it("does not claim that progressive cotton transfer is already proven", () => {
    const claims = LITERATURE.map((paper) => paper.connection).join(" ").toLowerCase();
    expect(claims).toContain("does not test");
    expect(claims).toContain("testing rather than assuming benefit");
  });
});
