import type { StasContext } from "@/lib/types";
import localSnapshot from "@/data/stas-profile.json";

export async function fetchStasContext(): Promise<{
  data: StasContext | null;
  source: "local" | "remote" | "unavailable";
}> {
  const url = process.env.STAS_CONTEXT_URL;

  if (!url) {
    return { data: localSnapshot as StasContext, source: "local" };
  }

  try {
    const token = process.env.STAS_CONTEXT_BEARER_TOKEN;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: "no-store"
    });

    if (!res.ok) throw new Error(`STAS context provider failed (${res.status})`);
    return { data: await res.json() as StasContext, source: "remote" };
  } catch {
    return { data: localSnapshot as StasContext, source: "local" };
  }
}
