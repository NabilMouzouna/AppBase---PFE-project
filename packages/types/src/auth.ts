export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface LogoutResponse {
  loggedOut: boolean;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  appId: string;
  createdAt: string;
}
