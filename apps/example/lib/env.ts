export function getPublicEnv() {
  const endpoint = process.env.NEXT_PUBLIC_APPBASE_ENDPOINT;
  const apiKey = process.env.NEXT_PUBLIC_APPBASE_API_KEY;

  if (!endpoint) {
    throw new Error("Missing NEXT_PUBLIC_APPBASE_ENDPOINT");
  }

  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_APPBASE_API_KEY");
  }

  return { endpoint, apiKey };
}
