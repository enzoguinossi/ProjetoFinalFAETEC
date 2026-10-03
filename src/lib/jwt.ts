import { SignJWT, jwtVerify } from "jose";

const ISSUER = "nexus";
const AUDIENCE = "nexus-web";
const EXPIRES_IN = "8h";

export interface TokenPayload {
  id_usuario: number;
  login: string;
  super_admin: boolean;
  /** Versão de sessão — ms da última alteração de senha (invalida tokens antigos). */
  sv: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não definida. Configure a variável de ambiente.");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return {
      id_usuario: Number(payload.id_usuario),
      login: String(payload.login),
      super_admin: Boolean(payload.super_admin),
      sv: Number(payload.sv ?? 0),
    };
  } catch {
    return null;
  }
}
