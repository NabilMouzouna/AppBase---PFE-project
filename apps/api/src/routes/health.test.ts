import { describe, expect, it } from "vitest";

import { registerHealthRoutes } from "./health";

describe("health route module", () => {
  it("exports registerHealthRoutes", () => {
    expect(typeof registerHealthRoutes).toBe("function");
  });
});

