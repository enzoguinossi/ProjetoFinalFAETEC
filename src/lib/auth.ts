import { cookies } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireUser(): Promise<TokenPayload> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}