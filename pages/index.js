import { useState, useRef, useCallback } from "react";
import Head from "next/head";

const RISK_COLORS = {
  high:     { bg: "#ff2d2d", text: "#fff",  label: "HIGH RISK" },
  moderate: { bg: "#ff8c00", text: "#fff",  label: "MODERATE"  },
  low:      { bg: "#f5c400", text: "#111",  label: "LOW CONCERN"},
  safe:     { bg: "#00c853", text: "#fff",  label: "GENERALLY SAFE" },
};

export default function Home() {
  const [mode, setMode]               = useState("idle");
  const [inputText, setInputText]     = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [results, setResults]         = useState(null);
  const [error, setError]             = useState(null);
  const [expanded, setExpanded]       = useState({});
  const fileInputRef = useRef(null);

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setMode("camera");
    };
    reader.readAsDataURL(file);
  };

  const analyze = useCallback(async () => {
    setMode("scanning");
    setError(null);
    setResults(null);
    try {
      const body = imageBase64
        ? { imageBase64 }
        : { text: inputText };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      setMode("results");
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      setMode(imageBase64 ? "camera" : "text");
    }
  }, [imageBase64, inputText]);

  const reset = () => {
    setMode("idle"); setInputText(""); setImagePreview(null);
    setImageBase64(null); setResults(null); setError(null); setExpanded({});
  };

  const scoreColor = (s) =>
    s >= 80 ? "#00c853" : s >= 50 ? "#f5c400" : s >= 30 ? "#ff8c00" : "#ff2d2d";

  const s = {
    page: {
      minHeight: "100vh", background: "#0a0a0a",
      fontFamily: "'DM Sans', sans-serif", color: "#f0ece0",
    },
    header: {
      borderBottom: "1px solid #1e1e1e", padding: "20px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
    },
    logo: {
      width: 32, height: 32, borderRadius: 8,
      background: "linear-gradient(135deg,#c8f542 0%,#7bc900 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
    },
    main: { maxWidth: 480, margin: "0 auto", padding: "0 16px 80px" },
    btn: (primary) => ({
      width: "100%", border: primary ? "none" : "1px solid #2a2a2a",
      background: primary ? "#c8f542" : "#161616",
      color: primary ? "#0a0a0a" : "#f0ece0",
      padding: "18px 24px", borderRadius: 12, cursor: "pointer",
      fontSize: 15, fontWeight: primary ? 700 : 500,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    }),
    mono: { fontFamily: "'DM Mono', monospace" },
    label: { fontSize: 11, letterSpacing: "1.5px", color: "#555", textTransform: "uppercase" },
  };

  return (
    <>
      <Head>
        <title>CleanLabel — Food Additive Scanner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="description" content="Scan food labels to find additives banned in other countries" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={s.page}>
        {/* Header */}
        <header style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={s.logo}>🔬</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>CleanLabel</div>
              <div style={{ ...s.mono, ...s.label, fontSize: 10 }}>Additive Scanner</div>
            </div>
          </div>
          {mode !== "idle" && (
            <button onClick={reset} style={{
              background: "none", border: "1px solid #2a2a2a", color: "#888",
              padding: "6px 14px", borderRadius: 6, cursor: "pointer",
              fontSize: 12, ...s.mono,
            }}>← New Scan</button>
          )}
        </header>

        <main style={s.main}>

          {/* ── IDLE ── */}
          {mode === "idle" && (
            <div style={{ paddingTop: 48 }} className="fade-in">
              <div style={{ marginBottom: 40 }}>
                <div style={{ ...s.mono, ...s.label, color: "#c8f542", marginBottom: 12 }}>
                  Know What You're Eating
                </div>
                <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 16 }}>
                  Scan any food label.<br />
                  <span style={{ color: "#555" }}>See what's inside.</span>
                </h1>
                <p style={{ color: "#777", fontSize: 15, lineHeight: 1.6 }}>
                  Point your camera at an ingredient list and instantly see which additives
                  have been banned in other countries — and why.
                </p>
              </div>

              {/* Stats */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
                marginBottom: 40, background: "#1a1a1a", borderRadius: 12, overflow: "hidden",
              }}>
                {[["3,000+","FDA-approved additives"],["11","Banned in EU, legal here"],["~40%","Processed foods affected"]].map(([n,l]) => (
                  <div key={n} style={{ background: "#111", padding: "16px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#c8f542", letterSpacing: "-0.5px" }}>{n}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.3 }}>{l}</div>
                  </div>
                ))}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                onChange={handleImage} style={{ display: "none" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => fileInputRef.current?.click()} style={s.btn(true)}>
                  <span style={{ fontSize: 20 }}>📷</span> Scan Ingredient Label
                </button>
                <button onClick={() => setMode("text")} style={s.btn(false)}>
                  <span style={{ fontSize: 20 }}>✏️</span> Paste Ingredients Manually
                </button>
              </div>

              {/* Common offenders */}
              <div style={{ marginTop: 48 }}>
                <div style={{ ...s.mono, ...s.label, marginBottom: 16 }}>Common Offenders to Watch</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["Red 40","Hyperactivity, potential carcinogen","high"],
                    ["BHA / BHT","Possible endocrine disruptor","high"],
                    ["Titanium Dioxide","Possible genotoxicity","moderate"],
                    ["Carrageenan","Gut inflammation","moderate"],
                  ].map(([name, concern, level]) => (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#111", borderRadius: 8, padding: "10px 14px",
                      border: "1px solid #1e1e1e",
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLORS[level].bg, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{concern}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TEXT INPUT ── */}
          {mode === "text" && (
            <div style={{ paddingTop: 32 }} className="fade-in">
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8 }}>Paste Ingredients</h2>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Copy the full ingredients list from the product packaging.</p>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="e.g. Enriched flour, sugar, high fructose corn syrup, Red 40, BHT (to preserve freshness)..."
                style={{
                  width: "100%", minHeight: 160, background: "#111",
                  border: "1px solid #2a2a2a", borderRadius: 12, color: "#f0ece0",
                  padding: 16, fontSize: 14, lineHeight: 1.6, resize: "vertical",
                  fontFamily: "'DM Sans', sans-serif", outline: "none",
                }}
              />
              {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{error}</div>}
              <button onClick={analyze} disabled={!inputText.trim()} style={{
                ...s.btn(true), marginTop: 16,
                background: inputText.trim() ? "#c8f542" : "#1e1e1e",
                color: inputText.trim() ? "#0a0a0a" : "#444",
                cursor: inputText.trim() ? "pointer" : "not-allowed",
              }}>Analyze Ingredients →</button>
            </div>
          )}

          {/* ── CAMERA PREVIEW ── */}
          {mode === "camera" && imagePreview && (
            <div style={{ paddingTop: 32 }} className="fade-in">
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 16 }}>Label Captured</h2>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2a", marginBottom: 20, maxHeight: 280 }}>
                <img src={imagePreview} alt="Label" style={{ width: "100%", objectFit: "cover", display: "block" }} />
              </div>
              {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button onClick={analyze} style={s.btn(true)}>🔬 Analyze This Label</button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                onChange={handleImage} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...s.btn(false), marginTop: 10 }}>
                Retake Photo
              </button>
            </div>
          )}

          {/* ── SCANNING ── */}
          {mode === "scanning" && (
            <div style={{ paddingTop: 80, textAlign: "center" }} className="fade-in">
              <div style={{
                width: 80, height: 80, margin: "0 auto 24px",
                borderRadius: "50%", border: "2px solid #1e1e1e",
                borderTop: "2px solid #c8f542",
                animation: "spin 1s linear infinite",
              }} />
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Analyzing ingredients…</div>
              <div style={{ color: "#555", fontSize: 13, ...s.mono }}>Cross-referencing research database</div>
            </div>
          )}

          {/* ── RESULTS ── */}
          {mode === "results" && results && (
            <div style={{ paddingTop: 32 }} className="fade-in">

              {/* Score card */}
              <div style={{
                background: "#111", borderRadius: 16, padding: 24,
                border: "1px solid #1e1e1e", marginBottom: 24, position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: 3,
                  borderRadius: "3px 3px 0 0", width: `${results.scan_score}%`,
                  background: scoreColor(results.scan_score),
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ ...s.mono, ...s.label, marginBottom: 8 }}>Clean Score</div>
                    <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-2px", color: scoreColor(results.scan_score), lineHeight: 1 }}>
                      {results.scan_score}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>out of 100</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>
                      {results.scan_score >= 80 ? "✅" : results.scan_score >= 50 ? "⚠️" : "🚨"}
                    </div>
                    <div style={{ fontSize: 12, color: "#555" }}>{results.additives?.length || 0} additives found</div>
                  </div>
                </div>
                <p style={{ margin: "16px 0 0", fontSize: 13, color: "#888", lineHeight: 1.6 }}>{results.summary}</p>
              </div>

              {/* Additives */}
              {results.additives?.length > 0 ? (
                <div>
                  <div style={{ ...s.mono, ...s.label, marginBottom: 12 }}>Flagged Additives</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...results.additives]
                      .sort((a, b) => ({ high:0, moderate:1, low:2, safe:3 }[a.risk_level] - { high:0, moderate:1, low:2, safe:3 }[b.risk_level]))
                      .map((additive, i) => {
                        const risk = RISK_COLORS[additive.risk_level] || RISK_COLORS.safe;
                        const open = expanded[i];
                        return (
                          <div key={i} style={{
                            background: "#111", borderRadius: 12,
                            border: `1px solid ${open ? risk.bg + "44" : "#1e1e1e"}`,
                          }}>
                            <button onClick={() => toggle(i)} style={{
                              width: "100%", background: "none", border: "none",
                              padding: "14px 16px", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                            }}>
                              <div style={{
                                padding: "3px 8px", borderRadius: 6, fontSize: 10,
                                ...s.mono, fontWeight: 500,
                                background: risk.bg, color: risk.text, whiteSpace: "nowrap",
                              }}>{risk.label}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ece0" }}>{additive.name}</div>
                                {additive.code && <div style={{ fontSize: 11, color: "#555", ...s.mono }}>{additive.code}</div>}
                              </div>
                              <div style={{ color: "#444" }}>{open ? "▲" : "▼"}</div>
                            </button>

                            {open && (
                              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1a1a1a" }}>
                                <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                                  {[
                                    ["Health Concern", additive.concern, "#ccc"],
                                    ["Research Evidence", additive.evidence, "#ccc"],
                                  ].map(([label, val, col]) => val && (
                                    <div key={label}>
                                      <div style={{ ...s.mono, ...s.label, marginBottom: 4, fontSize: 10 }}>{label}</div>
                                      <div style={{ fontSize: 13, color: col, lineHeight: 1.5 }}>{val}</div>
                                    </div>
                                  ))}

                                  {additive.banned_in?.length > 0 && (
                                    <div>
                                      <div style={{ ...s.mono, ...s.label, marginBottom: 6, fontSize: 10 }}>Banned / Restricted In</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {additive.banned_in.map(loc => (
                                          <span key={loc} style={{
                                            background: "#1e1e1e", border: "1px solid #2a2a2a",
                                            padding: "3px 8px", borderRadius: 6, fontSize: 11, color: "#aaa",
                                          }}>{loc}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {additive.alternatives && (
                                    <div style={{ background: "#0d1a0d", border: "1px solid #1a2e1a", borderRadius: 8, padding: "10px 12px" }}>
                                      <div style={{ ...s.mono, fontSize: 10, color: "#4a7a4a", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>
                                        Cleaner Alternatives
                                      </div>
                                      <div style={{ fontSize: 13, color: "#7bc900" }}>{additive.alternatives}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: "center", padding: "40px 24px",
                  background: "#0d1a0d", borderRadius: 16, border: "1px solid #1a3a1a",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c8f542" }}>No concerning additives found!</div>
                  <div style={{ fontSize: 13, color: "#4a7a4a", marginTop: 8 }}>This product looks clean.</div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                onChange={handleImage} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ ...s.btn(true), flex: 1, padding: 14, fontSize: 14 }}>
                  📷 Scan Another
                </button>
                <button onClick={reset} style={{ ...s.btn(false), flex: 1, padding: 14, fontSize: 14 }}>
                  Start Over
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
