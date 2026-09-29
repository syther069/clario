import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavRail } from "./nav-rail";

describe("Clario navigation shell", () => {
  it("exposes named navigation and a truthful local development network", () => {
    const markup = renderToStaticMarkup(
      createElement(NavRail, {
        currentRoute: "expenses",
        onNavigate: () => undefined,
        connectedChainId: 31337,
        targetChainId: 31337,
      }),
    );

    expect(markup).toContain('aria-label="Primary"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Local development");
    expect(markup).not.toContain("Monad (31337)");
    expect(markup).toContain('aria-controls="primary-navigation"');
  });
});
