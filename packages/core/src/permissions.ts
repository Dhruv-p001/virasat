import type { FamilyRole } from "./enums.ts";

// UI hints only. RLS in the database is the enforcement point, and these must agree with it.

export function canWriteContent(role: FamilyRole): boolean {
  return role !== "viewer";
}

export function canManageMembers(role: FamilyRole): boolean {
  return role === "owner" || role === "admin";
}

export function canExportVault(role: FamilyRole): boolean {
  return role === "owner";
}
