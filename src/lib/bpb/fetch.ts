export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

type FetchTextOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function fetchTextWithTimeout(
  url: string,
  { fetchImpl = fetch, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS }: FetchTextOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timeoutError = new Error(`Timed out fetching ${url} after ${timeoutMs}ms`);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([fetchImpl(url, { signal: controller.signal }), timeoutPromise]);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return await Promise.race([response.text(), timeoutPromise]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Timed out fetching ${url} after ${timeoutMs}ms`, { cause: error });
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
