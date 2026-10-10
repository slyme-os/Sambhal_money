import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { as, count, createDb, type Actor } from "./helpers/pg";

// Fixed identities. "U" = auth user id, plain ids are row ids.
const OP_A = "a0000000-0000-0000-0000-00000000000a";
const OP_B = "b0000000-0000-0000-0000-00000000000b";
const U_OP_A = "a1000000-0000-0000-0000-000000000001";
const U_OP_B = "b1000000-0000-0000-0000-000000000001";
const R1 = "11000000-0000-0000-0000-000000000001"; // fleet A, pilot, consented to sharing
const R2 = "22000000-0000-0000-0000-000000000002"; // fleet A, control, NOT consented
const R3 = "33000000-0000-0000-0000-000000000003"; // fleet B, consented
const U_R1 = "11100000-0000-0000-0000-000000000001";
const U_R2 = "22200000-0000-0000-0000-000000000002";
const U_R3 = "33300000-0000-0000-0000-000000000003";
const U_NEW = "44400000-0000-0000-0000-000000000004";

const rider1: Actor = { role: "authenticated", userId: U_R1 };
const rider2: Actor = { role: "authenticated", userId: U_R2 };
const operatorA: Actor = { role: "authenticated", userId: U_OP_A };
const operatorB: Actor = { role: "authenticated", userId: U_OP_B };
const anon: Actor = { role: "anon" };

/** Tables holding rider financial or personal data an operator must never read. */
const OPERATOR_FORBIDDEN = [
  "payouts",
  "pots",
  "allocations",
  "withdrawals",
  "shock_events",
  "spends",
  "nudges",
  "consents",
] as const;

async function seed(db: PGlite) {
  await db.exec(`
    insert into operators (id, name, city, code, payee_vpa) values
      ('${OP_A}', 'QuickRide EV', 'Bengaluru', 'QRDEMO', 'quickride.rent@okicici'),
      ('${OP_B}', 'Other Fleet', 'Bengaluru', 'OTHER', 'other.rent@ybl');
    insert into operator_members (auth_user_id, operator_id) values ('${U_OP_A}', '${OP_A}'), ('${U_OP_B}', '${OP_B}');

    insert into riders (id, auth_user_id, name, phone, operator_id, cohort) values
      ('${R1}', '${U_R1}', 'Ravi Kumar', '+919800000001', '${OP_A}', 'pilot'),
      ('${R2}', '${U_R2}', 'Suresh Gowda', '+919800000002', '${OP_A}', 'control'),
      ('${R3}', '${U_R3}', 'Imran Pasha', '+919800000003', '${OP_B}', 'pilot');

    insert into consents (rider_id, purpose, granted, version) values
      ('${R1}', 'app_use', true, 'v1'), ('${R1}', 'operator_share', true, 'v1'),
      ('${R2}', 'app_use', true, 'v1'),
      ('${R3}', 'app_use', true, 'v1'), ('${R3}', 'operator_share', true, 'v1');

    insert into pots (rider_id, kind, label_hi, label_en, target_paise)
      select r.id, k.kind, k.hi, k.en, null
      from riders r cross join (values ('rent','किराया','Rent'), ('emergency','इमरजेंसी','Emergency'),
                                       ('savings','बचत','Savings')) as k(kind, hi, en);

    insert into payouts (id, rider_id, amount_paise, source, occurred_at, entry_method) values
      ('91000000-0000-0000-0000-000000000001', '${R1}', 140000, 'rapido', now(), 'seed'),
      ('92000000-0000-0000-0000-000000000002', '${R2}', 90000, 'zepto', now(), 'seed'),
      ('93000000-0000-0000-0000-000000000003', '${R3}', 80000, 'swiggy', now(), 'seed');

    insert into allocations (payout_id, pot_id, amount_paise)
      select p.id, pot.id, 50000 from payouts p join pots pot on pot.rider_id = p.rider_id and pot.kind = 'rent';

    insert into withdrawals (pot_id, amount_paise, reason, status)
      select id, 10000, 'user', 'pending' from pots where kind = 'rent';

    insert into spends (rider_id, amount_paise, occurred_at, entry_method)
      select id, 15000, now(), 'seed' from riders;
    insert into shock_events (rider_id, description, amount_paise, covered_by)
      select id, 'puncture', 40000, 'pot' from riders;
    insert into nudges (rider_id, kind) select id, 'rent_now' from riders;

    insert into rent_agreements (id, rider_id, operator_id, amount_paise, cadence, due_weekday, next_due_on, payee_vpa, payee_name) values
      ('a1100000-0000-0000-0000-000000000001', '${R1}', '${OP_A}', 245000, 'weekly', 6, current_date, 'quickride.rent@okicici', 'QuickRide EV'),
      ('a2200000-0000-0000-0000-000000000002', '${R2}', '${OP_A}', 245000, 'weekly', 6, current_date, 'quickride.rent@okicici', 'QuickRide EV'),
      ('a3300000-0000-0000-0000-000000000003', '${R3}', '${OP_B}', 245000, 'weekly', 6, current_date, 'other.rent@ybl', 'Other Fleet');

    insert into rent_events (id, rent_agreement_id, due_on, amount_paise) values
      ('e1100000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', current_date, 245000),
      ('e2200000-0000-0000-0000-000000000002', 'a2200000-0000-0000-0000-000000000002', current_date, 245000),
      ('e3300000-0000-0000-0000-000000000003', 'a3300000-0000-0000-0000-000000000003', current_date, 245000);
  `);
}

let db: PGlite;
beforeEach(async () => {
  db = await createDb();
  await seed(db);
});

describe("riders see only their own rows", () => {
  for (const table of ["riders", "payouts", "pots", "allocations", "withdrawals", "spends", "shock_events", "nudges", "consents", "rent_agreements", "rent_events"]) {
    it(`${table}: rider 1 sees only his own rows`, async () => {
      const total = await count(db, table);
      const mine = await as(db, rider1, () => count(db, table));
      expect(total).toBeGreaterThan(mine);
      expect(mine).toBeGreaterThan(0);
    });
  }

  it("a rider cannot insert a payout for someone else", async () => {
    await expect(
      as(db, rider1, () =>
        db.query(
          `insert into payouts (rider_id, amount_paise, source, occurred_at, entry_method) values ($1, 100, 'cash', now(), 'manual')`,
          [R2],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a rider cannot move his cohort or operator (cherry-picking guard)", async () => {
    await expect(as(db, rider1, () => db.query(`update riders set cohort = 'control'`))).rejects.toThrow(/permission denied/);
    await expect(as(db, rider1, () => db.query(`update riders set operator_id = null`))).rejects.toThrow(/permission denied/);
  });

  it("a rider can change his floor and language", async () => {
    await as(db, rider1, () => db.query(`update riders set floor_paise = 35000, language = 'en'`));
    const res = await db.query<{ floor_paise: number }>(`select floor_paise from riders where id = $1`, [R1]);
    expect(Number(res.rows[0].floor_paise)).toBe(35000);
  });

  it("a rider cannot write pot balances directly", async () => {
    await expect(as(db, rider1, () => db.query(`update pots set balance_paise = 99999999`))).rejects.toThrow(/permission denied/);
  });

  it("a rider cannot write rent events directly", async () => {
    await expect(as(db, rider1, () => db.query(`update rent_events set status = 'paid_on_time'`))).rejects.toThrow(/permission denied/);
  });

  it("anonymous users can read nothing", async () => {
    await expect(as(db, anon, () => count(db, "riders"))).rejects.toThrow(/permission denied/);
    await expect(as(db, anon, () => count(db, "rent_events"))).rejects.toThrow(/permission denied/);
  });
});

describe("operators can NEVER read rider financial tables (HR-7)", () => {
  for (const table of OPERATOR_FORBIDDEN) {
    it(`operator cannot read ${table}`, async () => {
      expect(await count(db, table)).toBeGreaterThan(0); // rows exist…
      expect(await as(db, operatorA, () => count(db, table))).toBe(0); // …but none are visible
    });
  }

  it("operator cannot read the riders table directly", async () => {
    expect(await as(db, operatorA, () => count(db, "riders"))).toBe(0);
  });

  it("operator_riders() returns only name, phone, cohort — for consented riders of his fleet", async () => {
    const res = await as(db, operatorA, () => db.query(`select * from operator_riders()`));
    expect(res.fields.map((f) => f.name)).toEqual(["rider_id", "name", "phone", "cohort"]);
    expect(res.rows).toHaveLength(1);
    expect((res.rows[0] as { rider_id: string }).rider_id).toBe(R1);
  });

  it("operator cannot call internal helpers that would leak consent state", async () => {
    await expect(as(db, operatorA, () => db.query(`select operator_share_granted($1)`, [R2]))).rejects.toThrow(/permission denied/);
  });
});

describe("operators read rent status only with consent", () => {
  it("sees rent events for his consented riders only", async () => {
    const res = await as(db, operatorA, () => db.query<{ id: string }>(`select id from rent_events`));
    expect(res.rows.map((r) => r.id)).toEqual(["e1100000-0000-0000-0000-000000000001"]);
  });

  it("never sees another fleet's riders, even consented ones", async () => {
    const res = await as(db, operatorB, () => db.query<{ id: string }>(`select id from rent_events`));
    expect(res.rows.map((r) => r.id)).toEqual(["e3300000-0000-0000-0000-000000000003"]);
  });

  it("withdrawing consent hides rent status immediately — and savings keep working", async () => {
    await as(db, rider1, () =>
      db.query(`update consents set withdrawn_at = now() where purpose = 'operator_share' and withdrawn_at is null`),
    );
    expect(await as(db, operatorA, () => count(db, "rent_events"))).toBe(0);
    expect((await as(db, operatorA, () => db.query(`select * from operator_riders()`))).rows).toHaveLength(0);

    await as(db, rider1, () =>
      db.query(`insert into payouts (rider_id, amount_paise, source, occurred_at, entry_method) values ($1, 50000, 'zepto', now(), 'manual')`, [R1]),
    );
    expect(await as(db, rider1, () => count(db, "payouts"))).toBe(2);
    expect(await as(db, rider1, () => count(db, "pots"))).toBe(3);
  });

  it("re-granting consent restores visibility", async () => {
    await as(db, rider1, async () => {
      await db.query(`update consents set withdrawn_at = now() where purpose = 'operator_share'`);
      await db.query(`insert into consents (rider_id, purpose, granted, version) values ($1, 'operator_share', true, 'v2')`, [R1]);
    });
    expect(await as(db, operatorA, () => count(db, "rent_events"))).toBe(1);
  });
});

describe("rent reporting: rider is provisional, operator is authoritative", () => {
  const E1 = "e1100000-0000-0000-0000-000000000001";

  it("rider self-report sets a provisional paid status via upi_intent", async () => {
    await as(db, rider1, () => db.query(`select rider_report_rent($1, true)`, [E1]));
    const res = await db.query<{ status: string; rider_report: string; method: string; operator_report: null }>(
      `select status, rider_report, method, operator_report from rent_events where id = $1`, [E1]);
    expect(res.rows[0]).toMatchObject({ status: "paid_on_time", rider_report: "paid_on_time", method: "upi_intent", operator_report: null });
  });

  it("operator report overrides the status without erasing the rider's report", async () => {
    await as(db, rider1, () => db.query(`select rider_report_rent($1, true)`, [E1]));
    await as(db, operatorA, () => db.query(`select operator_mark_rent($1, 'missed')`, [E1]));
    const res = await db.query<{ status: string; rider_report: string; operator_report: string }>(
      `select status, rider_report, operator_report from rent_events where id = $1`, [E1]);
    expect(res.rows[0]).toMatchObject({ status: "missed", rider_report: "paid_on_time", operator_report: "missed" });
  });

  it("an operator cannot mark another fleet's rent", async () => {
    await expect(as(db, operatorB, () => db.query(`select operator_mark_rent($1, 'paid_on_time')`, [E1]))).rejects.toThrow(/not found/);
  });

  it("a rider cannot report someone else's rent", async () => {
    await expect(
      as(db, rider2, () => db.query(`select rider_report_rent($1, true)`, [E1])),
    ).rejects.toThrow(/not found/);
  });
});

describe("operator payout import is write-only", () => {
  it("inserts the payout but the operator still cannot read payouts", async () => {
    await as(db, operatorA, () => db.query(`select operator_import_payout($1, 70000, 'rapido', now())`, [R1]));
    expect(await as(db, rider1, () => count(db, "payouts"))).toBe(2);
    expect(await as(db, operatorA, () => count(db, "payouts"))).toBe(0);
  });

  it("refuses riders without consent", async () => {
    await expect(as(db, operatorA, () => db.query(`select operator_import_payout($1, 70000, 'rapido', now())`, [R2]))).rejects.toThrow(/no consent/);
  });
});

describe("onboarding RPC", () => {
  const newUser: Actor = { role: "authenticated", userId: U_NEW };

  it("creates rider, three pots, consents and rent agreement; cohort is balanced", async () => {
    const id = await as(db, newUser, async () => {
      const res = await db.query<{ id: string }>(
        `select onboard_rider('Manju', '+919800000004', 'kn', 'qrdemo', 30000, 245000, 'weekly', 6::smallint, 'v1', true) as id`,
      );
      return res.rows[0].id;
    });
    const rider = await db.query<{ cohort: string; operator_id: string }>(`select cohort, operator_id from riders where id = $1`, [id]);
    expect(rider.rows[0].operator_id).toBe(OP_A);
    expect(["pilot", "control"]).toContain(rider.rows[0].cohort); // fleet A has 1 pilot + 1 control → either
    expect(await as(db, newUser, () => count(db, "pots"))).toBe(3);
    expect(await as(db, newUser, () => count(db, "consents"))).toBe(2);
    expect(await as(db, newUser, () => count(db, "rent_agreements"))).toBe(1);
  });

  it("assigns the under-filled cohort", async () => {
    await db.exec(`update riders set cohort = 'pilot' where id = '${R2}'`); // fleet A: 2 pilot, 0 control
    await as(db, newUser, () =>
      db.query(`select onboard_rider('Manju', '+919800000004', 'hi', 'QRDEMO', 30000, 0, 'weekly', 6::smallint, 'v1', false)`),
    );
    const res = await db.query<{ cohort: string }>(`select cohort from riders where auth_user_id = $1`, [U_NEW]);
    expect(res.rows[0].cohort).toBe("control");
  });

  it("cannot onboard twice, and rejects unknown operator codes", async () => {
    await expect(
      as(db, rider1, () => db.query(`select onboard_rider('x', 'y', 'hi', null, 30000, 0, 'weekly', 6::smallint, 'v1', false)`)),
    ).rejects.toThrow(/already onboarded/);
    await expect(
      as(db, newUser, () => db.query(`select onboard_rider('x', 'y', 'hi', 'NOPE', 30000, 0, 'weekly', 6::smallint, 'v1', false)`)),
    ).rejects.toThrow(/unknown operator code/);
  });
});

describe("ledger invariant in the database", () => {
  async function balanceMatchesLedger(rider: string) {
    const res = await db.query<{ kind: string; balance: string; ledger: string }>(
      `select p.kind, p.balance_paise as balance,
              coalesce((select sum(amount_paise) from allocations a where a.pot_id = p.id), 0)
            - coalesce((select sum(amount_paise) from withdrawals w where w.pot_id = p.id and w.status <> 'cancelled'), 0) as ledger
       from pots p where p.rider_id = $1`, [rider]);
    for (const row of res.rows) expect(String(row.balance)).toBe(String(row.ledger));
  }

  it("pot balance always equals SUM(allocations) − SUM(live withdrawals)", async () => {
    await balanceMatchesLedger(R1);
    await as(db, rider1, async () => {
      await db.query(`insert into allocations (payout_id, pot_id, amount_paise)
                      select '91000000-0000-0000-0000-000000000001', id, 12345 from pots where kind = 'savings'`);
      await db.query(`insert into withdrawals (pot_id, amount_paise, reason) select id, 5000, 'user' from pots where kind = 'savings'`);
      await db.query(`update withdrawals set status = 'cancelled' where amount_paise = 10000`);
    });
    await balanceMatchesLedger(R1);

    // Removing an allocation that a live withdrawal depends on would go negative: refused.
    await expect(as(db, rider1, () => db.query(`delete from allocations where amount_paise = 12345`))).rejects.toThrow(
      /pots_balance_paise_check/,
    );
    await as(db, rider1, async () => {
      await db.query(`update withdrawals set status = 'cancelled' where amount_paise = 5000`);
      await db.query(`delete from allocations where amount_paise = 12345`);
    });
    await balanceMatchesLedger(R1);
  });

  it("a withdrawal can never overdraw a pot", async () => {
    await expect(
      as(db, rider1, () => db.query(`insert into withdrawals (pot_id, amount_paise, reason) select id, 99999999, 'user' from pots where kind = 'rent'`)),
    ).rejects.toThrow(/balance_paise_check|violates check constraint/);
  });

  it("an allocation cannot move one rider's payout into another rider's pot", async () => {
    await expect(
      db.query(`insert into allocations (payout_id, pot_id, amount_paise)
                select '91000000-0000-0000-0000-000000000001', id, 100 from pots where rider_id = $1 and kind = 'rent'`, [R2]),
    ).rejects.toThrow(/different riders/);
  });
});
