import { z } from "zod";

export const LanguageSchema = z.enum(["en", "hi", "gu"]);
export type Language = z.infer<typeof LanguageSchema>;

export const FamilyRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type FamilyRole = z.infer<typeof FamilyRoleSchema>;

export const VisibilitySchema = z.enum(["private", "family", "link", "public"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const SourceTypeSchema = z.enum(["voice", "handwriting", "typed", "whatsapp"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const VersionStatusSchema = z.enum(["draft", "confirmed"]);
export type VersionStatus = z.infer<typeof VersionStatusSchema>;

export const CaptureStatusSchema = z.enum([
  "uploaded",
  "transcribing",
  "structuring",
  "ready_for_review",
  "failed",
  "confirmed",
]);
export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;

export const MediaKindSchema = z.enum([
  "original_audio",
  "handwriting_scan",
  "dish_photo",
  "family_photo",
]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const HandoverStatusSchema = z.enum(["pending", "delivered", "opened"]);
export type HandoverStatus = z.infer<typeof HandoverStatusSchema>;
