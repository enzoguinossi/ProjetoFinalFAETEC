import { afterAll, beforeEach } from "vitest";
import { prismaTeste } from "./helpers/prisma";
import { resetarBanco } from "./helpers/db";

beforeEach(async () => {
  await resetarBanco();
});

afterAll(async () => {
  await prismaTeste.$disconnect();
});
