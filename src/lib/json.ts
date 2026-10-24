   import type { Prisma } from "@/generated/prisma/client";

   export function toJson<T>(value: T): Prisma.InputJsonValue {
     return value as unknown as Prisma.InputJsonValue;
   }