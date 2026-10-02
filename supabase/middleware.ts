import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Fail closed for admin routes when misconfigured
    if (request.nextUrl.pathname.startsWith("/admin")) {
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

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";
  const isMfaVerify = pathname === "/admin/mfa/verify";
  const isMfaSetup = pathname === "/admin/mfa/setup";

  if (isAdminRoute && !isLoginPage && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAdminRoute && !isLoginPage) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/login";
      return NextResponse.redirect(redirectUrl);
    }

    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

    if (needsMfa && !isMfaVerify) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/mfa/verify";
      return NextResponse.redirect(redirectUrl);
    }

    if (!needsMfa && isMfaVerify) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isLoginPage && user) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const needsMfa =
        aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = needsMfa ? "/admin/mfa/verify" : "/admin";
      return NextResponse.redirect(redirectUrl);
    }
    await supabase.auth.signOut();
  }

  // Prevent caching of admin HTML for unauthenticated crawlers
  if (isAdminRoute) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
  }

  void isMfaSetup;
  return supabaseResponse;
}
