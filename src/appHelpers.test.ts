import { describe, expect, it } from "vitest";
import { recentName } from "./appHelpers";

describe("recentName", () => {
  it("shows only the file name of a Windows path", () => {
    expect(recentName(String.raw`C:\Users\a\Documents\Production One\Backups\Untitled.pone`)).toBe("Untitled.pone");
  });
  it("shows only the file name of a posix path", () => {
    expect(recentName("/home/a/films/Amina.pone")).toBe("Amina.pone");
  });
  it("falls back to the whole text when there is no separator", () => {
    expect(recentName("Amina.pone")).toBe("Amina.pone");
  });
});
