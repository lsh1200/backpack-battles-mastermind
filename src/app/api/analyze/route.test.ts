import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }
});

async function screenshotFile(): Promise<File> {
  const image = await sharp({
    create: {
      width: 1200,
      height: 700,
      channels: 3,
      background: "#202020",
    },
  })
    .png()
    .toBuffer();

  const bytes = new Uint8Array(image.byteLength);
  bytes.set(image);

  return new File([bytes.buffer], "round.png", { type: "image/png" });
}

describe("POST /api/analyze", () => {
  it("returns a JSON setup error when the OpenAI API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const form = new FormData();
    form.append("screenshot", await screenshotFile());

    const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: form }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "OPENAI_API_KEY is not set" });
  });
});
