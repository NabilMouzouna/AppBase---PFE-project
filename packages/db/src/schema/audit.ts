import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  userId: text("user_id"),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
