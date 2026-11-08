import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), handle: text("handle").notNull(),
  name: text("name").notNull(), avatarUrl: text("avatar_url"),
  location: text("location").notNull().default(""),
  language: text("language").notNull().default("en"),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("users_handle_unique").on(t.handle)]);

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  handle: text("handle").notNull(), name: text("name").notNull(),
  description: text("description").notNull().default(""),
  avatarUrl: text("avatar_url"), bannerUrl: text("banner_url"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [uniqueIndex("channels_handle_unique").on(t.handle), uniqueIndex("channels_owner_unique").on(t.ownerId)]);

export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(), channelId: text("channel_id").notNull(),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  category: text("category").notNull().default("Other"), tags: text("tags").notNull().default(""),
  mediaKey: text("media_key"), thumbnailKey: text("thumbnail_key"),
  sampleUrl: text("sample_url"), sampleThumb: integer("sample_thumb"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  status: text("status").notNull().default("draft"),
  views: integer("views").notNull().default(0),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [
  index("videos_channel_created_idx").on(t.channelId,t.createdAt),
  index("videos_status_created_idx").on(t.status,t.createdAt),
  index("videos_category_idx").on(t.category),
]);

export const videoReactions = sqliteTable("video_reactions", {
  userId: text("user_id").notNull(), videoId: text("video_id").notNull(),
  value: integer("value").notNull(),
}, t => [primaryKey({columns:[t.userId,t.videoId]}), index("video_reactions_video_idx").on(t.videoId)]);

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id").notNull(), channelId: text("channel_id").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [primaryKey({columns:[t.userId,t.channelId]}), index("subscriptions_channel_idx").on(t.channelId)]);

export const watchHistory = sqliteTable("watch_history", {
  userId: text("user_id").notNull(), videoId: text("video_id").notNull(),
  progressSeconds: integer("progress_seconds").notNull().default(0),
  watchedAt: integer("watched_at").notNull(),
}, t => [primaryKey({columns:[t.userId,t.videoId]}), index("watch_history_user_time_idx").on(t.userId,t.watchedAt)]);

export const watchLater = sqliteTable("watch_later", {
  userId: text("user_id").notNull(), videoId: text("video_id").notNull(),
  addedAt: integer("added_at").notNull(),
}, t => [primaryKey({columns:[t.userId,t.videoId]})]);

export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  visibility: text("visibility").notNull().default("private"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [index("playlists_owner_idx").on(t.ownerId,t.createdAt)]);

export const playlistItems = sqliteTable("playlist_items", {
  playlistId: text("playlist_id").notNull(), videoId: text("video_id").notNull(),
  addedAt: integer("added_at").notNull(),
}, t => [primaryKey({columns:[t.playlistId,t.videoId]})]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(), videoId: text("video_id").notNull(),
  parentId: text("parent_id"), authorId: text("author_id").notNull(),
  body: text("body").notNull(), normalizedBody: text("normalized_body").notNull(),
  language: text("language").notNull().default("en"),
  status: text("status").notNull().default("visible"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
  version: integer("version").notNull().default(1),
  reportCount: integer("report_count").notNull().default(0),
}, t => [
  index("comments_video_created_idx").on(t.videoId,t.createdAt),
  index("comments_parent_idx").on(t.parentId),
  index("comments_author_duplicate_idx").on(t.authorId,t.normalizedBody,t.createdAt),
  index("comments_report_idx").on(t.reportCount,t.createdAt),
]);

export const commentRevisions = sqliteTable("comment_revisions", {
  id: text("id").primaryKey(), commentId: text("comment_id").notNull(),
  body: text("body").notNull(), language: text("language").notNull(),
  version: integer("version").notNull(), editedBy: text("edited_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [index("revisions_comment_idx").on(t.commentId,t.version)]);

export const commentReactions = sqliteTable("comment_reactions", {
  userId: text("user_id").notNull(), commentId: text("comment_id").notNull(),
  value: integer("value").notNull(),
}, t => [primaryKey({columns:[t.userId,t.commentId]})]);

export const commentReports = sqliteTable("comment_reports", {
  id: text("id").primaryKey(), commentId: text("comment_id").notNull(),
  reporterId: text("reporter_id").notNull(), reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("comment_report_once_idx").on(t.commentId,t.reporterId)]);

export const moderationActions = sqliteTable("moderation_actions", {
  id: text("id").primaryKey(), commentId: text("comment_id"),
  actorId: text("actor_id"), action: text("action").notNull(),
  reason: text("reason").notNull(), createdAt: integer("created_at").notNull(),
}, t => [index("moderation_comment_idx").on(t.commentId,t.createdAt)]);

export const postAttempts = sqliteTable("post_attempts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull(), outcome: text("outcome").notNull(),
}, t => [index("attempts_user_time_idx").on(t.userId,t.createdAt)]);

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  answer: integer("answer").notNull(), expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

export const translations = sqliteTable("translations", {
  commentId: text("comment_id").notNull(), version: integer("version").notNull(),
  language: text("language").notNull(), body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [primaryKey({columns:[t.commentId,t.version,t.language]})]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(), value: text("value").notNull(),
});

// Used only by the self-hosted launcher. The Sites deployment keeps its
// managed sign-in identity and never reads these credentials.
export const localAccounts = sqliteTable("local_accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("local_accounts_email_unique").on(t.email)]);

export const localSessions = sqliteTable("local_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, t => [index("local_sessions_user_idx").on(t.userId), index("local_sessions_expiry_idx").on(t.expiresAt)]);

export const authAttempts = sqliteTable("auth_attempts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
  outcome: text("outcome").notNull(),
}, t => [index("auth_attempts_email_time_idx").on(t.email,t.createdAt)]);
