const required = ["DATABASE_URL", "JWT_SECRET"] as const;

export function env(key: (typeof required)[number]): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }
  return value;
}

export function validateEnv() {
  for (const key of required) env(key);
}
