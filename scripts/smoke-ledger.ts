import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { members, users } from "../src/db/schema";
import { awardXp, mutateCredits } from "../src/lib/ledgers";

async function main() {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "member@cult.local"))
    .limit(1);
  const [m] = await db
    .select()
    .from(members)
    .where(eq(members.userId, user!.id))
    .limit(1);

  const r1 = await awardXp({
    memberId: m.id,
    delta: 10,
    reason: "smoke",
    idempotencyKey: "smoke-xp-1",
  });
  const r2 = await awardXp({
    memberId: m.id,
    delta: 10,
    reason: "smoke",
    idempotencyKey: "smoke-xp-1",
  });
  const c1 = await mutateCredits({
    memberId: m.id,
    delta: 5,
    reason: "smoke",
    idempotencyKey: "smoke-cr-1",
  });

  console.log(
    JSON.stringify(
      {
        xpReplay: r2.replayed,
        xp: r2.member?.xpBalance,
        firstXp: r1.member?.xpBalance,
        credits: c1.member?.creditBalance,
        creditReplay: c1.replayed,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
