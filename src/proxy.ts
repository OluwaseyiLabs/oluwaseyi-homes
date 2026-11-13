import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Any path with a segment that starts with a dot (.env, .git, .DS_Store...) except /.well-known, which services use to verify a domain. */
const isDotfile = (path: string) => /(^|\/)\.(?!well-known(\/|$))/.test(decodeURIComponent(path));

/** Blocks dotfiles for every request, keeps the dashboard session fresh, and sends anyone who is not signed in to the login page. */
export async function proxy(request: NextRequest) {
  let path = request.nextUrl.pathname;
  try {
    if (isDotfile(path)) return new NextResponse("Not found", { status: 404 });
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!path.startsWith("/admin")) return NextResponse.next();
  path = path.replace(/\/+$/, "") || "/";
  let response = NextResponse.next({ request });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await db.auth.getUser();
  const onLogin = path === "/admin/login";
  // The invitation page is opened from an email by someone who has no account session yet.
  const open = onLogin || path === "/admin/join";
  if (!data.user && !open) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (data.user && onLogin) return NextResponse.redirect(new URL("/admin", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|images/).*)"] };
