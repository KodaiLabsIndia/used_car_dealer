import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { sessionSchema, type Session } from "@arihant/contracts";
import { ApiClient } from "../adapters/api";
import { words, isLanguage, type Language } from "./copy";
type AppState = {
  session: Session | null;
  booting: boolean;
  api: ApiClient;
  language: Language;
  t: ReturnType<typeof words>;
  setLanguage: (l: Language) => void;
  signIn: (code: string, account: "owner" | "employee") => Promise<void>;
  signInPassword: (
    dealer: string,
    username: string,
    secret: string,
  ) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  signOut: () => Promise<void>;
  revision: number;
  changed: () => void;
};
const Context = createContext<AppState | null>(null);
let sessionWrite: Promise<void> = Promise.resolve();
function persistSession(value: Session | null) {
  sessionWrite = sessionWrite
    .catch(() => {})
    .then(() =>
      value
        ? SecureStore.setItemAsync("arihant.session", JSON.stringify(value))
        : SecureStore.deleteItemAsync("arihant.session"),
    );
  return sessionWrite;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [booting, setBooting] = useState(true),
    [language, setLanguageState] = useState<Language>("en"),
    [revision, setRevision] = useState(0);
  const activeToken = useRef<string | null>(null);
  const api = useMemo(() => {
    const token = session?.token || null;
    return new ApiClient(token, undefined, () => {
      if (activeToken.current === token) {
        activeToken.current = null;
        setSession(null);
        void persistSession(null).catch(() => {});
      }
    });
  }, [session?.token]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [saved, lang] = await Promise.all([
          SecureStore.getItemAsync("arihant.session"),
          SecureStore.getItemAsync("arihant.language"),
        ]);
        if (active && isLanguage(lang)) setLanguageState(lang);
        if (saved) {
          const parsed = sessionSchema.safeParse(JSON.parse(saved));
          if (
            parsed.success &&
            Date.parse(parsed.data.expiresAt) > Date.now() &&
            active
          ) {
            activeToken.current = parsed.data.token;
            setSession(parsed.data);
            const preference = await SecureStore.getItemAsync(
              `arihant.language.${parsed.data.actor.id}`,
            );
            if (active)
              setLanguageState(isLanguage(preference) ? preference : "en");
          } else await persistSession(null);
        }
      } catch {
        await SecureStore.deleteItemAsync("arihant.session").catch(() => {});
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    api
      .me()
      .then((actor) => {
        if (active && JSON.stringify(actor) !== JSON.stringify(session.actor)) {
          const next = { ...session, actor };
          setSession(next);
          void persistSession(next).catch(() => {});
        }
      })
      .catch((e) => {
        if (active && e.status === 401) {
          setSession(null);
          activeToken.current = null;
          void persistSession(null);
        }
      });
    return () => {
      active = false;
    };
  }, [session?.token]);
  async function signIn(code: string, account: "owner" | "employee") {
    const next = await new ApiClient(null).signIn(code, account);
    await acceptSession(next);
  }
  async function acceptSession(next: Session) {
    activeToken.current = next.token;
    try {
      await persistSession(next);
      const preference = await SecureStore.getItemAsync(
        `arihant.language.${next.actor.id}`,
      );
      setLanguageState(isLanguage(preference) ? preference : "en");
      setSession(next);
    } catch (error) {
      activeToken.current = null;
      setSession(null);
      throw error;
    }
  }
  async function signInPassword(
    dealer: string,
    username: string,
    secret: string,
  ) {
    await acceptSession(
      await new ApiClient(null).signInPassword(dealer, username, secret),
    );
  }
  async function changePassword(current: string, next: string) {
    await acceptSession(await api.changeSecret(current, next));
  }
  async function signOut() {
    await api.logout().catch(() => {});
    activeToken.current = null;
    await persistSession(null);
    setSession(null);
  }
  function setLanguage(l: Language) {
    setLanguageState(l);
    void SecureStore.setItemAsync(
      session ? `arihant.language.${session.actor.id}` : "arihant.language",
      l,
    );
  }
  return (
    <Context.Provider
      value={{
        session,
        booting,
        api,
        language,
        t: words(language),
        setLanguage,
        signIn,
        signInPassword,
        changePassword,
        signOut,
        revision,
        changed: () => setRevision((n) => n + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("AppProvider is missing");
  return c;
}
