import { useLang } from "../context/LangContext";

export default function LangToggle() {
  const { lang, toggleLang } = useLang();

  return (
    <button onClick={toggleLang} style={{
      display: "flex", alignItems: "center", gap: 0,
      padding: 0, borderRadius: 8, border: "1px solid rgba(148,163,184,0.12)",
      background: "rgba(15,23,42,0.5)", cursor: "pointer", overflow: "hidden",
      fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{
        padding: "5px 8px",
        background: lang === "en" ? "rgba(52,211,153,0.15)" : "transparent",
        color: lang === "en" ? "#34d399" : "#475569",
        transition: "all 0.2s",
      }}>EN</span>
      <span style={{
        padding: "5px 8px",
        background: lang === "fi" ? "rgba(96,165,250,0.15)" : "transparent",
        color: lang === "fi" ? "#60a5fa" : "#475569",
        transition: "all 0.2s",
      }}>FI</span>
    </button>
  );
}
