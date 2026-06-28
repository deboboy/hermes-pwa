export type HermesConfig = {
  apiUrl: string;
  apiKey: string;
};

export function resolveHermesConfig(): HermesConfig | null {
  const rawUrl =
    process.env.HERMES_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_HERMES_API_URL?.trim();
  const rawKey = process.env.HERMES_API_KEY?.trim();
  if (!rawUrl || !rawKey) return null;

  const apiKey = rawKey.replace(/%+$/, "");
  let apiUrl = rawUrl.replace(/\/$/, "");
  if (!apiUrl.endsWith("/v1")) {
    apiUrl = `${apiUrl}/v1`;
  }

  return { apiUrl, apiKey };
}

export function isHermesConfigured(): boolean {
  return resolveHermesConfig() !== null;
}
