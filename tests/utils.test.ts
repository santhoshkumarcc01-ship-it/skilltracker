import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins present class names", () => {
    expect(cn("rounded-xl", false, undefined, "bg-card")).toBe("rounded-xl bg-card");
  });
});
