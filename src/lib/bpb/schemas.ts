import { z } from "zod";

export const BpbItemSchema = z.object({
  id: z.number().int().nonnegative(),
  gid: z.number().int().nonnegative().optional(),
  name: z.string().min(1),
  aliases: z.array(z.string()).min(1),
  imageUrl: z.string().url().optional(),
  className: z.string().optional(),
  rarity: z.string().optional(),
  type: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  tags: z.array(z.string()).default([]),
  effectText: z.string().optional(),
  recipe: z.array(z.string()).optional(),
  shape: z.array(z.array(z.number().int().nonnegative())).optional(),
  gridWidth: z.number().int().positive().optional(),
  gridHeight: z.number().int().positive().optional(),
  publicBuildIds: z.array(z.number().int().nonnegative()).optional(),
  grounded: z.boolean(),
});

export const BpbBuildTierSchema = z.object({
  color: z.string().nullable(),
  title: z.string().nullable(),
  itemIds: z.array(z.number().int().nonnegative()),
});

export const BpbBuildAuthorSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().url().nullable().optional(),
  rating: z.number().nullable().optional(),
});

export const BpbBuildSnapshotSchema = z.object({
  order: z.number().int().nonnegative(),
  buildId: z.number().int().nonnegative(),
  name: z.string().nullable(),
  itemIds: z.array(z.number().int().nonnegative()),
});

export const BpbBuildSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string().nullable().optional(),
  className: z.string().nullable(),
  subclass: z.string().nullable(),
  bag: z.string().nullable(),
  difficulty: z.string().nullable(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable(),
  totalRating: z.number().nullable().optional(),
  views: z.number().nullable().optional(),
  commentsCount: z.number().nullable().optional(),
  tiers: z.array(BpbBuildTierSchema).optional(),
  author: BpbBuildAuthorSchema.nullable().optional(),
  snapshotCount: z.number().int().nonnegative().optional(),
  snapshots: z.array(BpbBuildSnapshotSchema).optional(),
  itemIds: z.array(z.number().int().nonnegative()),
});

export const BpbCacheSchema = z.object({
  fetchedAt: z.string(),
  patchVersion: z.string().nullable().default(null),
  patchDate: z.string().nullable().default(null),
  sourceUrls: z.array(z.string().url()),
  items: z.array(BpbItemSchema),
  builds: z.array(BpbBuildSchema),
});

export type BpbItem = z.infer<typeof BpbItemSchema>;
export type BpbBuild = z.infer<typeof BpbBuildSchema>;
export type BpbCache = z.infer<typeof BpbCacheSchema>;
