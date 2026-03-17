import type { AppBaseConfig } from "./appbase";
import type { Session, RegisterRequest, LoginRequest, RefreshRequest } from "@appbase/types";

export class AuthClient {
  private session: Session | null = null;

  constructor(private config: AppBaseConfig) {}

  private get baseUrl() {
    return `${this.config.endpoint}/auth`;
  }

  async signUp(data: RegisterRequest): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.config.apiKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: Session };
    this.session = json.data;
    return this.session;
  }

  async signIn(data: LoginRequest): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.config.apiKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: Session };
    this.session = json.data;
    return this.session;
  }

  async refresh(data: RefreshRequest): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.config.apiKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: Session };
    this.session = json.data;
    return this.session;
  }

  async signOut(): Promise<void> {
    if (!this.session) return;
    await fetch(`${this.baseUrl}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        Authorization: `Bearer ${this.session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: this.session.refreshToken }),
    });
    this.session = null;
  }

  getSession(): Session | null {
    return this.session;
  }

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }
}
