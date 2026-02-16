import { createContext, useContext, useState, useCallback } from "react";
import { translations } from "../i18n";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("gh_lang") || "en"; }
    catch { return "en"; }
  });

  const t = useCallback((key) => {
    return (translations[lang] && translations[lang][key]) || key;
  }, [lang]);

  const toggleLang = useCallback(() => {
    const next = lang === "en" ? "fi" : "en";
    setLang(next);
    try { localStorage.setItem("gh_lang", next); } catch {}
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
