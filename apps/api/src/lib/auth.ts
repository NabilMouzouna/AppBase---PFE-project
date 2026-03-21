import { betterAuth } from "better-auth";
import { bearer, jwt, admin } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppDb } from "@appbase/db";
import * as schema from "@appbase/db/schema";

export function createAuth(db: AppDb, baseUrl: string, secret: string) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema,
        apiKey: schema.apiKeys,
        api_keys: schema.apiKeys,
      },
    }),
    baseURL: baseUrl,
    secret,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        metadata: {
          type: "string",
          required: false,
          input: true,
          defaultValue: "{}",
        },
        appId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      bearer(),
      jwt({
        jwt: {
          expirationTime: "15m",
          definePayload: ({ user }) => ({
            sub: user.id,
            email: user.email,
            appId: user.appId,
            metadata: user.metadata,
          }),
        },
      }),
      admin(),
      apiKey({
        defaultPrefix: "hs_live_",
        schema: {
          apikey: {
            modelName: "api_keys",
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
