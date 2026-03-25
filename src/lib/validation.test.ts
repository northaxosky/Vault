import { describe, it, expect } from "vitest";
import { validatePassword, BCRYPT_ROUNDS } from "./validation";

describe("BCRYPT_ROUNDS", () => {
  it("should be 12", () => {
    expect(BCRYPT_ROUNDS).toBe(12);
  });
});

describe("validatePassword", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = validatePassword("Abc1!short");
    expect(result).toEqual({
      valid: false,
      message: "Password must be at least 12 characters",
    });
  });

  it("rejects passwords without a lowercase letter", () => {
    const result = validatePassword("ABCDEFGH1234!");
    expect(result).toEqual({
      valid: false,
      message: "Password must contain a lowercase letter",
    });
  });

  it("rejects passwords without an uppercase letter", () => {
    const result = validatePassword("abcdefgh1234!");
    expect(result).toEqual({
      valid: false,
      message: "Password must contain an uppercase letter",
    });
  });

  it("rejects passwords without a digit", () => {
    const result = validatePassword("Abcdefghijkl!");
    expect(result).toEqual({
      valid: false,
      message: "Password must contain a number",
    });
  });

  it("rejects passwords without a special character", () => {
    const result = validatePassword("Abcdefgh1234");
    expect(result).toEqual({
      valid: false,
      message: "Password must contain a special character",
    });
  });

  it("accepts a valid password meeting all requirements", () => {
    const result = validatePassword("StrongPass1!");
    expect(result).toEqual({ valid: true, message: "" });
  });

  it("accepts a long complex password", () => {
    const result = validatePassword("MyS3cure!Passw0rd#2024");
    expect(result).toEqual({ valid: true, message: "" });
  });

  it("rejects an empty string", () => {
    const result = validatePassword("");
    expect(result).toEqual({
      valid: false,
      message: "Password must be at least 12 characters",
    });
  });

  it("checks length before other rules", () => {
    // Short password with no uppercase, digit, or special char
    const result = validatePassword("short");
    expect(result.message).toBe("Password must be at least 12 characters");
  });
});
