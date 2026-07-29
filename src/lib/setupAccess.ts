const SESSION_KEY = "board-game-inventory:setup-access:v1";
const NONCE_KEY = "board-game-inventory:setup-auth-nonce:v1";

export interface SetupAccessSession {
  grant: string;
  login: string;
  expiresAt: string;
}

export interface VerifiedSetupAccess {
  login: string;
  expiresAt: string;
}

interface StorageReader {
  getItem(key: string): string | null;
}

interface StorageWriter {
  setItem(key: string, value: string): void;
}

interface StorageRemover {
  removeItem(key: string): void;
}

const isLocalHttp = (url: URL) =>
  url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");

export const parseSetupServiceUrl = (value: string | undefined): URL | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password || (url.protocol !== "https:" && !isLocalHttp(url))) {
      return undefined;
    }
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  } catch {
    return undefined;
  }
};

export const readSetupAccessSession = (
  storage: StorageReader = globalThis.sessionStorage
): SetupAccessSession | undefined => {
  try {
    const value = JSON.parse(storage.getItem(SESSION_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.grant !== "string" ||
      !candidate.grant ||
      typeof candidate.login !== "string" ||
      !candidate.login ||
      typeof candidate.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.expiresAt))
    ) {
      return undefined;
    }
    return {
      grant: candidate.grant,
      login: candidate.login,
      expiresAt: candidate.expiresAt
    };
  } catch {
    return undefined;
  }
};

export const storeSetupAccessSession = (
  session: SetupAccessSession,
  storage: StorageWriter = globalThis.sessionStorage
) => storage.setItem(SESSION_KEY, JSON.stringify(session));

export const clearSetupAccessSession = (storage: StorageRemover = globalThis.sessionStorage) =>
  storage.removeItem(SESSION_KEY);

const parseAccessResponse = (value: unknown): VerifiedSetupAccess => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GitHub returned an invalid verification response.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.verified !== true ||
    typeof candidate.login !== "string" ||
    !candidate.login ||
    typeof candidate.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.expiresAt))
  ) {
    throw new Error("GitHub could not confirm collaborator access.");
  }
  return { login: candidate.login, expiresAt: candidate.expiresAt };
};

export const verifySetupAccess = async (
  serviceUrl: URL,
  session: SetupAccessSession,
  fetcher: typeof fetch = fetch
): Promise<VerifiedSetupAccess> => {
  const response = await fetcher(new URL("api/setup/session", serviceUrl), {
    headers: { authorization: `Bearer ${session.grant}` },
    method: "POST"
  });
  if (!response.ok) throw new Error("GitHub could not confirm collaborator access.");
  return parseAccessResponse(await response.json());
};

export const exchangeSetupCode = async (
  serviceUrl: URL,
  code: string,
  state: string,
  nonce: string,
  fetcher: typeof fetch = fetch
): Promise<SetupAccessSession> => {
  const response = await fetcher(new URL("api/setup/exchange", serviceUrl), {
    body: JSON.stringify({ code, state, nonce }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok)
    throw new Error("GitHub verification failed or this account is not a collaborator.");
  const value = (await response.json()) as Record<string, unknown>;
  const verified = parseAccessResponse(value);
  if (typeof value.grant !== "string" || !value.grant) {
    throw new Error("GitHub returned an invalid verification response.");
  }
  return { grant: value.grant, ...verified };
};

const randomNonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

export const beginSetupVerification = (
  serviceUrl: URL,
  location: { assign(url: string): void; origin: string; pathname: string } = window.location,
  storage: StorageWriter = globalThis.sessionStorage
) => {
  const nonce = randomNonce();
  storage.setItem(NONCE_KEY, nonce);
  const startUrl = new URL("auth/github/start", serviceUrl);
  startUrl.searchParams.set("callback", `${location.origin}${location.pathname}`);
  startUrl.searchParams.set("nonce", nonce);
  location.assign(startUrl.href);
};

export const takeSetupAuthNonce = (
  storage: StorageReader & StorageRemover = globalThis.sessionStorage
) => {
  const nonce = storage.getItem(NONCE_KEY);
  storage.removeItem(NONCE_KEY);
  return nonce;
};

export const removeSetupAuthQuery = (
  location: { href: string } = window.location,
  history: {
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  } = window.history
) => {
  const url = new URL(location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
};
