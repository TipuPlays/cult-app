"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(input: { email: string; password: string }) {
  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Invalid credentials" };
    }
    throw e;
  }
}
