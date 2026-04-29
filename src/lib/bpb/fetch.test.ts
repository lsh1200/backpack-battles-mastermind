import { describe, expect, it } from "vitest";
import { fetchTextWithTimeout } from "./fetch";

describe("BPB fetch helper", () => {
  it("passes an abort signal to fetch requests", async () => {
    let sawSignal = false;

    const text = await fetchTextWithTimeout("https://bpb-builds.vercel.app/items", {
      fetchImpl: async (_, init) => {
        sawSignal = init?.signal instanceof AbortSignal;
        return new Response("ok");
      },
    });

    expect(text).toBe("ok");
    expect(sawSignal).toBe(true);
  });

  it("fails stalled requests after the timeout", async () => {
    await expect(
      fetchTextWithTimeout("https://bpb-builds.vercel.app/items", {
        timeoutMs: 1,
        fetchImpl: async (_, init) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      }),
    ).rejects.toThrow("Timed out fetching https://bpb-builds.vercel.app/items");
  });

  it("fails stalled body reads after the timeout", async () => {
    await expect(
      fetchTextWithTimeout("https://bpb-builds.vercel.app/items", {
        timeoutMs: 1,
        fetchImpl: async () =>
          ({
            ok: true,
            text: async () => new Promise<string>(() => {}),
          }) as Response,
      }),
    ).rejects.toThrow("Timed out fetching https://bpb-builds.vercel.app/items");
  });
});
