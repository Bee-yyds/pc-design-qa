import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const issueState = sqliteTable("issue_state", {
  issueId: text("issue_id").primaryKey(),
  description: text("description").notNull(),
  handlingNote: text("handling_note").notNull().default(""),
  repaired: integer("repaired").notNull().default(0),
  confirmed: integer("confirmed").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  editNonce: text("edit_nonce").notNull().default(""),
});

export const issueHistory = sqliteTable(
  "issue_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    issueId: text("issue_id").notNull(),
    revision: integer("revision").notNull(),
    beforeJson: text("before_json").notNull(),
    afterJson: text("after_json").notNull(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    changedAt: text("changed_at").notNull(),
  },
  (table) => [uniqueIndex("issue_history_issue_revision").on(table.issueId, table.revision)],
);
