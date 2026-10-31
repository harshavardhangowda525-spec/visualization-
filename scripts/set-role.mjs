import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const [userId, role] = process.argv.slice(2);
if (
  !/^[a-f0-9-]{36}$/i.test(userId || "") ||
  !["ADMIN", "STAFF", "CUSTOMER"].includes(role)
)
  throw new Error(
    "Usage: node scripts/set-role.mjs EXISTING_VERIFIED_USER_UUID ADMIN|STAFF|CUSTOMER",
  );
const db = new PrismaClient();
try {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.user.update({ where: { id: userId }, data: { role } });
    await tx.authSession.deleteMany({ where: { userId } });
    if (role === "STAFF")
      await tx.staffProfile.upsert({
        where: { userId },
        create: { userId, title: "Studio staff" },
        update: { active: true },
      });
    await tx.auditLog.create({
      data: {
        action: "OPERATOR_ROLE_CHANGE",
        entityId: userId,
        detail: {
          previousRole: user.role,
          newRole: role,
          source: "authenticated-deployment-operator",
        },
      },
    });
  });
  console.log("Role updated; all existing sessions revoked.");
} finally {
  await db.$disconnect();
}
