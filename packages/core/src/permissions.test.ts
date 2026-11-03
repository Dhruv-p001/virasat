import { describe, expect, it } from "vitest";
import { canExportVault, canManageMembers, canWriteContent } from "./permissions.ts";

describe("role permissions", () => {
  it("matches the role table", () => {
    const table = (["owner", "admin", "member", "viewer"] as const).map((role) => ({
      role,
      write: canWriteContent(role),
      manage: canManageMembers(role),
      export: canExportVault(role),
    }));
    expect(table).toEqual([
      { role: "owner", write: true, manage: true, export: true },
      { role: "admin", write: true, manage: true, export: false },
      { role: "member", write: true, manage: false, export: false },
      { role: "viewer", write: false, manage: false, export: false },
    ]);
  });
});
