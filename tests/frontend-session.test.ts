import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("local browser session recovery", () => {
  it("refreshes a stale session token and retries only the rejected request once", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "before-restart" }))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "INVALID_SESSION", message: "Restarted" } },
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ token: "after-restart" }))
      .mockResolvedValueOnce(Response.json({ id: "preview" }));
    vi.stubGlobal("fetch", fetch);
    const { request } = await import("../src/web/client");
    expect(
      await request("/api/preview", { baseRevision: 1, commands: [] }),
    ).toEqual({ id: "preview" });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[1]?.[1].headers["X-GitFlash-Token"]).toBe(
      "before-restart",
    );
    expect(fetch.mock.calls[3]?.[1].headers["X-GitFlash-Token"]).toBe(
      "after-restart",
    );
  });

  it("does not replay a failed mutation for an unrelated server error", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "current" }))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "STALE_PREVIEW", message: "Refresh your preview" } },
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const { request } = await import("../src/web/client");
    await expect(request("/api/apply", { previewId: "old" })).rejects.toThrow(
      "Refresh your preview",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
