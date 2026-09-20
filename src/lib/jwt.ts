import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "nexus-dev-secret-change-in-production";

export interface TokenPayload {
  id_usuario: number;
  login: string;
  super_admin: boolean;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}