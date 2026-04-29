export function codexHandoffStatusUrl(handoffId: string): string {
  return `/api/codex-handoff?id=${encodeURIComponent(handoffId)}`;
}

export function codexHandoffScreenshotUrl(handoffId: string): string {
  return `${codexHandoffStatusUrl(handoffId)}&asset=screenshot`;
}

export function codexHandoffCropUrl(handoffId: string, field: string): string {
  return `${codexHandoffStatusUrl(handoffId)}&asset=crop&field=${encodeURIComponent(field)}`;
}
