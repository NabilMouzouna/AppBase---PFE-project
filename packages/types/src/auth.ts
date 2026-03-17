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

export interface RefreshRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  token: string;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  appId: string;
  createdAt: string;
}
