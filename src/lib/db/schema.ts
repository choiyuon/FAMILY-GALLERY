import {
  pgTable, pgEnum, uuid, text, timestamp,
  bigserial, jsonb, index, integer, bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "member"]);
export const themeEnum = pgEnum("theme", ["light", "dark"]);
export const kindEnum = pgEnum("kind", ["photo", "video"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("member"),
  theme: themeEnum("theme").notNull().default("light"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    action: text("action").notNull(),
    targetMediaId: uuid("target_media_id"),
    targetUserId: uuid("target_user_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorId),
    index("audit_log_created_idx").on(t.createdAt),
  ]
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    titleLower: text("title_lower").notNull().unique(),
    kind: kindEnum("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    durationMs: integer("duration_ms"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    blobOriginalKey: text("blob_original_key").notNull(),
    blobMediumKey: text("blob_medium_key"),
    blobThumbKey: text("blob_thumb_key").notNull(),
    blobEditedKey: text("blob_edited_key"),
    shortEdgePx: integer("short_edge_px").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("media_owner_idx").on(t.ownerId),
    index("media_created_idx").on(t.createdAt),
    index("media_deleted_idx").on(t.deletedAt),
  ]
);
