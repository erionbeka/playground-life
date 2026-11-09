import { beforeEach, describe, expect, it } from "vitest";
import { fakeApi, resetFakeApi } from "@/test/support/fakeApi";

beforeEach(() => {
  resetFakeApi();
});

describe("fake API child archiving", () => {
  it("hides archived children from family access while preserving history and allowing restoration", async () => {
    await fakeApi.login("555-0101", "emma123");

    const familyBefore = await fakeApi.getFamilySession();

    expect(familyBefore.children.map((child) => child.id)).toContain("child-1");
    expect(familyBefore.assignments.map((assignment) => assignment.id)).toContain("hw-1");

    await fakeApi.deleteChild("child-1");

    const familyAfterArchive = await fakeApi.getFamilySession();
    const staffAssignmentsAfterArchive = await fakeApi.listAssignments();

    expect(familyAfterArchive.children.map((child) => child.id)).not.toContain("child-1");
    expect(familyAfterArchive.assignments.map((assignment) => assignment.id)).not.toContain("hw-1");

    // Staff history must remain available after the child is archived.
    expect(staffAssignmentsAfterArchive.assignments.map((assignment) => assignment.id)).toContain("hw-1");

    await fakeApi.restoreChild("child-1");

    const familyAfterRestore = await fakeApi.getFamilySession();

    expect(familyAfterRestore.children.map((child) => child.id)).toContain("child-1");
    expect(familyAfterRestore.assignments.map((assignment) => assignment.id)).toContain("hw-1");
  });
});
