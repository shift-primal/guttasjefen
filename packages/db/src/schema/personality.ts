import {
	boolean,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const loreEntry = pgTable("lore_entry", {
	key: text("key").primaryKey(),
	notes: text("notes").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profile = pgTable("profile", {
	userId: text("user_id").primaryKey(),
	name: text("name").notNull(),
	notes: text("notes").notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const example = pgTable("example", {
	id: serial("id").primaryKey(),
	text: text("text").notNull().unique(),
	liked: boolean("liked").notNull(),
	tags: jsonb("tags").$type<Record<string, number>>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
