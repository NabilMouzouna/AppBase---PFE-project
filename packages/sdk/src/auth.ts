import type { AppBaseConfig } from "./appbase";
import type {
  Session,
  RegisterRequest,
  LoginRequest,
  RefreshResponse,
  LogoutResponse,
} from "@appbase/types";

export class AuthClient {
  private session: Session | null = null;

  constructor(private config: AppBaseConfig) {}

  private get baseUrl() {
    return `${this.config.endpoint}/auth`;
  }

  signUp = async (data: RegisterRequest): Promise<Session> => {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: Session };
    this.session = json.data;
    return this.session;
  };

  signIn = async (data: LoginRequest): Promise<Session> => {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: Session };
    this.session = json.data;
    return this.session;
  };

  refresh = async (): Promise<RefreshResponse> => {
    if (!this.session) {
      throw new Error("No active session");
    }

    const res = await fetch(`${this.baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.session.refreshToken}`,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: RefreshResponse };
    this.session = {
      ...this.session,
      accessToken: json.data.accessToken,
      expiresIn: json.data.expiresIn,
    };
    return json.data;
  };

  signOut = async (): Promise<void> => {
    if (!this.session) return;
    const res = await fetch(`${this.baseUrl}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.session.refreshToken}`,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    await res.json() as { data: LogoutResponse };
    this.session = null;
  };

  getSession = (): Session | null => {
    return this.session;
  };

  getAccessToken = (): string | null => {
    return this.session?.accessToken ?? null;
  };
}
