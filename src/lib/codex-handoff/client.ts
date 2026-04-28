export function codexHandoffStatusUrl(handoffId: string): string {
  return `/api/codex-handoff?id=${encodeURIComponent(handoffId)}`;
}

export function codexHandoffScreenshotUrl(handoffId: string): string {
  return `${codexHandoffStatusUrl(handoffId)}&asset=screenshot`;
}
