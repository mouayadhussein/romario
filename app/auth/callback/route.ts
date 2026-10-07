import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/supabase/server";


function safeAdminNext(nextParam: string | null): string {
  if (nextParam && nextParam.startsWith("/admin/")) return nextParam;
  return "/admin/login";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeAdminNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const fail = new URL("/admin/forgot-password", origin);
  fail.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(fail);
}
