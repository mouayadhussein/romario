/**
 * RLS / auth smoke checks.
 * Usage: npm run rls-check
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Optional SUPABASE_SERVICE_ROLE_KEY for elevated deny checks.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  STAFF_HAS_RECORDS_MSG,
  canHardDeleteStaff,
} from "../lib/staff-guards";

function loadEnvFile(file: string) {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

type CheckResult = {
  name: string;
  expected: "deny" | "allow";
  passed: boolean;
  detail: string;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: CheckResult[] = [];

  async function expectDeny(
    name: string,
    run: () => Promise<{ error: { message: string } | null; data: unknown }>
  ) {
    const { error, data } = await run();
    const empty =
      data == null ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        Object.keys(data as object).length === 0);
    const denied = Boolean(error) || empty;
    results.push({
      name,
      expected: "deny",
      passed: denied,
      detail:
        error?.message ??
        (empty ? "empty/null (treated as deny)" : "unexpected data returned"),
    });
  }

  async function expectAllow(
    name: string,
    run: () => Promise<{ error: { message: string } | null; data: unknown }>
  ) {
    const { error, data } = await run();
    const ok = !error;
    results.push({
      name,
      expected: "allow",
      passed: ok,
      detail:
        error?.message ??
        (Array.isArray(data) ? `rows=${data.length}` : "ok"),
    });
  }

  await expectDeny("select orders", async () => {
    const res = await supabase.from("orders").select("id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select order_items", async () => {
    const res = await supabase.from("order_items").select("id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select admins", async () => {
    const res = await supabase.from("admins").select("user_id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select staff", async () => {
    const res = await supabase.from("staff").select("user_id, full_name, phone").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select staff phone/name only", async () => {
    const res = await supabase.from("staff").select("full_name, phone").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select orders sensitive cols", async () => {
    const res = await supabase
      .from("orders")
      .select("id, customer_phone, customer_address, assigned_to, tracking_token")
      .limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select staff_branches", async () => {
    const res = await supabase.from("staff_branches").select("staff_id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select cash_settlements", async () => {
    const res = await supabase.from("cash_settlements").select("id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("select order_events", async () => {
    const res = await supabase.from("order_events").select("id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("rpc claim_order (anon)", async () => {
    const res = await supabase.rpc("claim_order", {
      p_order_id: "00000000-0000-0000-0000-000000000000",
    });
    return { error: res.error, data: res.data };
  });

  if (serviceKey) {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await expectDeny("rpc claim_order (service_role)", async () => {
      const res = await service.rpc("claim_order", {
        p_order_id: "00000000-0000-0000-0000-000000000000",
      });
      return { error: res.error, data: res.data };
    });

    const email = `rls-inactive-${Date.now()}@example.com`;
    const password = `Tmp!${Date.now()}aA1`;
    const { data: created, error: createErr } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (!createErr && created.user) {
      const uid = created.user.id;
      const { error: staffInsErr } = await service.from("staff").insert({
        user_id: uid,
        full_name: "RLS Inactive",
        is_active: false,
      });

      if (staffInsErr) {
        results.push({
          name: "rpc claim_order (inactive staff)",
          expected: "deny",
          passed: false,
          detail: staffInsErr.message,
        });
        await service.auth.admin.deleteUser(uid);
      } else {
        const staffClient = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: signErr } = await staffClient.auth.signInWithPassword({
          email,
          password,
        });

        if (!signErr) {
          await expectDeny("rpc claim_order (inactive staff)", async () => {
            const res = await staffClient.rpc("claim_order", {
              p_order_id: "00000000-0000-0000-0000-000000000000",
            });
            return { error: res.error, data: res.data };
          });
          await staffClient.auth.signOut();
        } else {
          results.push({
            name: "rpc claim_order (inactive staff)",
            expected: "deny",
            passed: false,
            detail: `sign-in failed: ${signErr.message}`,
          });
        }

        await service.from("staff").delete().eq("user_id", uid);
        await service.auth.admin.deleteUser(uid);
      }
    } else {
      results.push({
        name: "rpc claim_order (inactive staff)",
        expected: "deny",
        passed: false,
        detail: createErr?.message ?? "could not create temp staff user",
      });
    }
  } else {
    results.push({
      name: "rpc claim_order (service_role)",
      expected: "deny",
      passed: false,
      detail: "SKIPPED — set SUPABASE_SERVICE_ROLE_KEY",
    });
    results.push({
      name: "rpc claim_order (inactive staff)",
      expected: "deny",
      passed: false,
      detail: "SKIPPED — set SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const deleteBlocked = !canHardDeleteStaff({
    assignedOrderCount: 1,
    settlementCount: 0,
  });
  results.push({
    name: "delete staff with records rejected (app rule)",
    expected: "deny",
    passed: deleteBlocked && STAFF_HAS_RECORDS_MSG.includes("تعطيله"),
    detail: deleteBlocked
      ? STAFF_HAS_RECORDS_MSG
      : "canHardDeleteStaff unexpectedly allowed deletion",
  });

  await expectDeny("select branch_counters", async () => {
    const res = await supabase.from("branch_counters").select("branch_id").limit(5);
    return { error: res.error, data: res.data };
  });

  await expectDeny("insert orders", async () => {
    const res = await supabase.from("orders").insert({
      order_number: "HACK-1",
      branch_id: "00000000-0000-0000-0000-000000000000",
      customer_name: "x",
      customer_phone: "12345678",
      order_type: "pickup",
      total: 1,
      subtotal: 1,
    });
    return { error: res.error, data: res.data };
  });

  await expectDeny("update branches", async () => {
    const res = await supabase
      .from("branches")
      .update({ name: "hacked" })
      .eq("is_active", true);
    return { error: res.error, data: res.data };
  });

  await expectDeny("delete categories", async () => {
    const res = await supabase
      .from("categories")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    return { error: res.error, data: res.data };
  });

  await expectDeny("rpc generate_order_number", async () => {
    const res = await supabase.rpc("generate_order_number", {
      p_branch_id: "00000000-0000-0000-0000-000000000000",
    });
    return { error: res.error, data: res.data };
  });

  await expectDeny("storage upload", async () => {
    const res = await supabase.storage
      .from("menu-images")
      .upload(`rls-check/${Date.now()}.txt`, new Blob(["nope"]), {
        contentType: "text/plain",
        upsert: false,
      });
    return { error: res.error, data: res.data };
  });

  await expectAllow("select active branches", async () => {
    const res = await supabase
      .from("branches")
      .select("id, name, slug")
      .eq("is_active", true)
      .limit(5);
    return { error: res.error, data: res.data };
  });

  await expectAllow("select active categories", async () => {
    const res = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .limit(5);
    return { error: res.error, data: res.data };
  });

  await expectAllow("select menu items (available and unavailable)", async () => {
    const res = await supabase
      .from("items")
      .select("id, name, price, is_available")
      .limit(5);
    return { error: res.error, data: res.data };
  });

  const failed = results.filter((r) => !r.passed);
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.expected.toUpperCase()} ${r.name} — ${r.detail}`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }

  console.log(`\nAll ${results.length} RLS checks passed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "rls-check failed");
  process.exit(1);
});
