import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

type Problem = { title?: string; detail?: string; errors?: FieldErrors };

const LOGIN_PATH = "/admin/login";

export function safeReturnTo(value: string | null | undefined): string {
  return value && value.startsWith("/admin") && !value.startsWith("//") && !value.startsWith(LOGIN_PATH)
    ? value
    : "/admin";
}

const sessionExpired: Middleware = {
  onResponse({ request, response }) {
    if (response.status !== 401 || typeof window === "undefined") {
      return response;
    }

    const isLogin = new URL(request.url, window.location.origin).pathname === "/api/auth/login";
    if (!isLogin && window.location.pathname !== LOGIN_PATH) {
      const returnTo = window.location.pathname + window.location.search;
      // Full reload on purpose: drops every cached query of the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${LOGIN_PATH}?expired=1&returnTo=${encodeURIComponent(returnTo)}`);
    }

    return response;
  },
};

export const api = createClient<paths>({ baseUrl: "", credentials: "include" });
api.use(sessionExpired);

export async function call<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, "unreachable");
  }

  const { data, error, response } = result;
  if (!response.ok) {
    const problem = (error ?? {}) as Problem;
    throw new ApiError(response.status, problem.title ?? problem.detail ?? response.statusText, problem.errors ?? {});
  }

  return data as T;
}
