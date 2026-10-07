import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isStaffRoute = pathname.startsWith("/staff");

  if (!url || !anonKey) {
    // Fail closed for protected routes when misconfigured
    if (isAdminRoute || isStaffRoute) {
      return new NextResponse("Service unavailable", { status: 503 });
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminLogin = pathname === "/admin/login";
  const isAdminForgotPassword = pathname === "/admin/forgot-password";
  const isAdminResetPassword = pathname === "/admin/reset-password";
  const isAdminPublicAuth =
    isAdminLogin || isAdminForgotPassword || isAdminResetPassword;
  const isStaffLogin = pathname === "/staff/login";
  const isMfaVerify = pathname === "/admin/mfa/verify";
  const isMfaSetup = pathname === "/admin/mfa/setup";

  function redirectTo(path: string) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = path;
    return NextResponse.redirect(redirectUrl);
  }

  // ---------- Staff routes ----------
  if (isStaffRoute) {
    if (!isStaffLogin && !user) {
      return redirectTo("/staff/login");
    }

    if (user && isStaffLogin) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) return redirectTo("/admin");

      const { data: isStaff } = await supabase.rpc("is_staff");
      if (isStaff) {
        const { data: row } = await supabase
          .from("staff")
          .select("is_active")
          .eq("user_id", user.id)
          .maybeSingle();
        if (row?.is_active) return redirectTo("/staff");
      }
      await supabase.auth.signOut();
    }

    if (user && !isStaffLogin) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) {
        // Admins use /admin; keep them out of staff app unless also staff
        const { data: isStaff } = await supabase.rpc("is_staff");
        if (!isStaff) return redirectTo("/admin");
      }

      const { data: isStaff } = await supabase.rpc("is_staff");
      if (!isStaff) {
        await supabase.auth.signOut();
        return redirectTo("/staff/login");
      }

      const { data: row } = await supabase
        .from("staff")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!row?.is_active) {
        await supabase.auth.signOut();
        return redirectTo("/staff/login");
      }
    }

    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
    return supabaseResponse;
  }

  // ---------- Admin routes ----------
  if (isAdminRoute && !isAdminPublicAuth && !user) {
    return redirectTo("/admin/login");
  }

  if (user && isAdminRoute && !isAdminPublicAuth) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      const { data: isStaff } = await supabase.rpc("is_staff");
      if (isStaff) {
        return redirectTo("/staff");
      }
      await supabase.auth.signOut();
      return redirectTo("/admin/login");
    }

    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

    if (needsMfa && !isMfaVerify && !isAdminResetPassword) {
      return redirectTo("/admin/mfa/verify");
    }

    if (!needsMfa && isMfaVerify) {
      return redirectTo("/admin");
    }
  }

  if (isAdminPublicAuth && user && !isAdminResetPassword) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa =
        aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";
      return redirectTo(needsMfa ? "/admin/mfa/verify" : "/admin");
    }

    const { data: isStaff } = await supabase.rpc("is_staff");
    if (isStaff) {
      return redirectTo("/staff");
    }
    await supabase.auth.signOut();
  }

  if (isAdminRoute) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
  }

  void isMfaSetup;
  return supabaseResponse;
}
