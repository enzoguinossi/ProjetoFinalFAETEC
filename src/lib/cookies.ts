import { cookies } from "next/headers";

const EIGHT_HOURS = 60 * 60 * 8;
const TEMP_TTL = 60 * 10;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("nexus_token", token, { ...baseOptions, maxAge: EIGHT_HOURS });
}

export async function setTempAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("nexus_temp_token", token, { ...baseOptions, maxAge: TEMP_TTL });
}

export async function clearTempAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("nexus_temp_token");
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("nexus_token");
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("nexus_token")?.value;
}

export async function getTempAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("nexus_temp_token")?.value;
}
