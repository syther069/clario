import { describe, expect, it } from "vitest";

import { productDescription, productName } from "./project";

describe("project identity", () => {
  it("states the product without claiming unimplemented functionality", () => {
    expect(productName).toBe("Clario");
    expect(productDescription).toContain("expense evidence");
    expect(productDescription).toContain("verifiable");
  });
});
