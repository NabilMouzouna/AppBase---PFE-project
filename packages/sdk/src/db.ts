import type { AppBaseConfig } from "./appbase";
import type { AuthClient } from "./auth";
import type { CollectionRecord, ListResponse, ChangeEvent } from "@appbase/types";

export class CollectionRef<T extends Record<string, unknown> = Record<string, unknown>> {
  constructor(
    private name: string,
    private baseUrl: string,
    private headers: () => Record<string, string>
  ) {}

  async create(data: T): Promise<CollectionRecord> {
    const res = await fetch(`${this.baseUrl}/${this.name}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: CollectionRecord };
    return json.data;
  }

  async list(): Promise<ListResponse<CollectionRecord>> {
    const res = await fetch(`${this.baseUrl}/${this.name}`, { headers: this.headers() });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: ListResponse<CollectionRecord> };
    return json.data;
  }

  async get(id: string): Promise<CollectionRecord> {
    const res = await fetch(`${this.baseUrl}/${this.name}/${id}`, { headers: this.headers() });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: CollectionRecord };
    return json.data;
  }

  async update(id: string, data: Partial<T>): Promise<CollectionRecord> {
    const res = await fetch(`${this.baseUrl}/${this.name}/${id}`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: CollectionRecord };
    return json.data;
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${this.name}/${id}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  subscribe(callback: (event: ChangeEvent) => void): () => void {
    const url = `${this.baseUrl}/${this.name}/subscribe`;
    const headers = this.headers();
    const params = new URLSearchParams({ "x-api-key": headers["x-api-key"] ?? "" });
    if (headers["Authorization"]) params.set("token", headers["Authorization"].replace("Bearer ", ""));
    const es = new EventSource(`${url}?${params.toString()}`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as ChangeEvent;
        callback(event);
      } catch {
        // ignore malformed events
      }
    };
    return () => es.close();
  }
}

export class DbClient {
  constructor(
    private config: AppBaseConfig,
    private auth: AuthClient
  ) {}

  private get baseUrl() {
    return `${this.config.endpoint}/db/collections`;
  }

  private headers(): Record<string, string> {
    const token = this.auth.getAccessToken();
    return {
      "x-api-key": this.config.apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  collection<T extends Record<string, unknown> = Record<string, unknown>>(name: string): CollectionRef<T> {
    return new CollectionRef<T>(name, this.baseUrl, () => this.headers());
  }
}
