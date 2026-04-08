import { useState, useRef, useCallback } from "react";
import Head from "next/head";

const RISK = {
  high:     { bg: "#ff2d2d", text: "#fff",  label: "HIGH RISK" },
  moderate: { bg: "#ff8c00", text: "#fff",  label: "MODERATE"  },
  low:      { bg: "#f5c400", text: "#111",  label: "LOW CONCERN"},
  safe:     { bg: "#00c853", text: "#fff",  label: "GENERALLY SAFE" },
};

const STEPS = [
  { icon: "📷", label: "Capture" },
  { icon: "🔍", label: "Identify" },
  { icon: "🌐", label: "Fetch" },
  { icon: "⚗️", label: "Analyze" },
];

export default function Home() {
  const [screen, setScreen]             = useState("idle");
  const [step, setStep]                 = useState(0);
  const [stepMsg, setStepMsg]           = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64]   = useState(null);
  const [identified, setIdentified]     = useState(null);
  const [productInput, setProductInput] = useState("");
  const [results, setResults]           = useState(null);
  const [error, setError]               = useState(null);
  const [expanded, setExpanded]         = useState({});
  const fileRef = useRef(null);

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));
  const scoreColor = (s) => s >= 80 ? "#00c853" : s >= 50 ? "#f5c400" : s >= 30 ? "#ff8c00" : "#ff2d2d";

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);

    // Convert any format (including HEIC) to JPEG via canvas
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      // Resize to max 1200px wide to keep payload small
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(objectUrl);

      setImagePreview(jpegDataUrl);
      setImageBase64(jpegDataUrl.split(",")[1]);
      setScreen("camera");
    };
    img.onerror = () => {
      setError("Could not read image. Please try again.");
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const runIdentify = useCallback(async () => {
    setScreen("processing");
    setError(null);
    setResults(null);
    setExpanded({});
    setStep(1);
    setStepMsg("Identifying product…");
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIdentified(data);
      setScreen("confirm");
    } catch (err) {
      setError(err.message || "Could not identify product. Try typing the name instead.");
      setScreen("camera");
    }
  }, [imageBase64]);

  const runAnalysis = useCallback(async (productName, returnScreen = "manual") => {
    setScreen("processing");
    setError(null);
    setStep(2);
    setStepMsg(`Looking up "${productName}"…`);
    await new Promise(r => setTimeout(r, 400));
    setStep(3);
    setStepMsg("Analyzing additives and risk levels…");
    try {
      const res = await fetch("/api/search-and-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName }),
      });
      const data = await res.json();
      if (data.error) {
        const msg = data.hint ? `${data.error}\n\nHint: ${data.hint}` : data.error;
        throw new Error(msg);
      }
      setResults(data);
      setScreen("results");
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      setScreen(returnScreen);
    }
  }, []);

  const reset = () => {
    setScreen("idle"); setStep(0); setStepMsg(""); setImagePreview(null);
    setImageBase64(null); setIdentified(null); setProductInput("");
    setResults(null); setError(null); setExpanded({});
  };

  const mono = { fontFamily: "'DM Mono', monospace" };
  const muted = { color: "#555", fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "1.5px", textTransform: "uppercase" };
  const btnP = {
    width: "100%", background: "#c8f542", color: "#0a0a0a", border: "none",
    padding: "16px 24px", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  };
  const btnS = {
    width: "100%", background: "#161616", color: "#f0ece0", border: "1px solid #2a2a2a",
    padding: "16px 24px", borderRadius: 12, cursor: "pointer", fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  };

  return (
    <>
      <Head>
        <title>CleanLabel — Food Additive Scanner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="description" content="Scan food products to find harmful additives banned in other countries" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0ece0", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <header style={{
          borderBottom: "1px solid #1e1e1e", padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg,#c8f542 0%,#7bc900 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>🔬</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>CleanLabel</div>
              <div style={{ ...muted, fontSize: 10 }}>Additive Scanner</div>
            </div>
          </div>
          {screen !== "idle" && screen !== "processing" && (
            <button onClick={reset} style={{
              background: "none", border: "1px solid #2a2a2a", color: "#888",
              padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, ...mono,
            }}>← New Scan</button>
          )}
        </header>

        <main style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 80px" }}>

          {/* IDLE */}
          {screen === "idle" && (
            <div style={{ paddingTop: 48 }}>
              <div style={{ marginBottom: 36 }}>
                <div style={{ ...muted, color: "#c8f542", marginBottom: 12 }}>Know what you're eating</div>
                <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 16 }}>
                  Point. Scan.<br /><span style={{ color: "#555" }}>Know the truth.</span>
                </h1>
                <p style={{ color: "#777", fontSize: 15, lineHeight: 1.6 }}>
                  Photograph any food product. We identify it, look up the ingredients online,
                  and show every additive that's banned in other countries — and why.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 32 }}>
                {[
                  ["📷","Snap a photo","of any product"],
                  ["🔍","We identify","brand & product name"],
                  ["🌐","Fetch ingredients","from official sources"],
                  ["⚗️","Get the truth","additives + risk levels"],
                ].map(([icon, t, s]) => (
                  <div key={t} style={{ background: "#111", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e1e1e" }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{s}</div>
                  </div>
                ))}
              </div>

              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: "none" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => fileRef.current?.click()} style={btnP}>
                  <span style={{ fontSize: 20 }}>📷</span> Scan a Product
                </button>
                <button onClick={() => setScreen("manual")} style={btnS}>
                  <span style={{ fontSize: 18 }}>✏️</span> Type Product Name Instead
                </button>
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginTop: 36,
                background: "#1a1a1a", borderRadius: 12, overflow: "hidden",
              }}>
                {[["3,000+","FDA additives"],["11","Banned in EU"],["~40%","Processed foods"]].map(([n,l]) => (
                  <div key={n} style={{ background: "#111", padding: "14px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#c8f542" }}>{n}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 3, lineHeight: 1.3 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMERA PREVIEW */}
          {screen === "camera" && imagePreview && (
            <div style={{ paddingTop: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Product captured</h2>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Tap Identify to read the label.</p>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2a", marginBottom: 20, maxHeight: 300 }}>
                <img src={imagePreview} alt="Product" style={{ width: "100%", objectFit: "cover", display: "block" }} />
              </div>
              {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button onClick={runIdentify} style={btnP}>🔍 Identify This Product</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{ ...btnS, marginTop: 10 }}>Retake Photo</button>
              <button onClick={() => setScreen("manual")} style={{ ...btnS, marginTop: 8, color: "#666", fontSize: 13, padding: "12px 24px" }}>
                Or type name manually
              </button>
            </div>
          )}

          {/* MANUAL */}
          {screen === "manual" && (
            <div style={{ paddingTop: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Type product name</h2>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 6 }}>Brand + product name works best.</p>
              <p style={{ color: "#444", fontSize: 12, marginBottom: 20 }}>Examples: "Spam Classic" · "Oreo Original" · "Doritos Nacho Cheese"</p>
              <input
                type="text" value={productInput} onChange={e => setProductInput(e.target.value)} autoFocus
                onKeyDown={e => e.key === "Enter" && productInput.trim() && runAnalysis(productInput.trim(), "manual")}
                placeholder="e.g. Gatorade Fruit Punch"
                style={{
                  width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
                  color: "#f0ece0", padding: "16px", fontSize: 16, fontFamily: "'DM Sans', sans-serif",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{error}</div>}
              <button onClick={() => productInput.trim() && runAnalysis(productInput.trim(), "manual")} disabled={!productInput.trim()} style={{
                ...btnP, marginTop: 16,
                background: productInput.trim() ? "#c8f542" : "#1e1e1e",
                color: productInput.trim() ? "#0a0a0a" : "#444",
                cursor: productInput.trim() ? "pointer" : "not-allowed",
              }}>Search &amp; Analyze →</button>
            </div>
          )}

          {/* CONFIRM */}
          {screen === "confirm" && identified && (
            <div style={{ paddingTop: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Is this correct?</h2>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Confirm or edit before we search for ingredients.</p>
              {imagePreview && (
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #2a2a2a", marginBottom: 16, maxHeight: 180 }}>
                  <img src={imagePreview} alt="Product" style={{ width: "100%", objectFit: "cover", display: "block" }} />
                </div>
              )}
              <div style={{ background: "#111", borderRadius: 12, padding: "18px 20px", border: "1px solid #2a2a2a", marginBottom: 16 }}>
                <div style={{ ...muted, marginBottom: 8 }}>Identified as</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: "#c8f542" }}>{identified.full_name}</div>
                {identified.confidence === "low" && (
                  <div style={{ fontSize: 12, color: "#ff8c00", marginTop: 6 }}>⚠️ Low confidence — please correct if wrong</div>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Not right? Edit here:</div>
                <input type="text" defaultValue={identified.full_name} id="confirm-input" style={{
                  width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10,
                  color: "#f0ece0", padding: "12px 16px", fontSize: 15,
                  fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box",
                }} />
              </div>
              {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button onClick={() => { const v = document.getElementById("confirm-input").value.trim(); if (v) runAnalysis(v, "confirm"); }} style={btnP}>
                ✅ Yes, find ingredients
              </button>
              <button onClick={() => setScreen("camera")} style={{ ...btnS, marginTop: 10 }}>← Retake photo</button>
            </div>
          )}

          {/* PROCESSING */}
          {screen === "processing" && (
            <div style={{ paddingTop: 60, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 48 }}>
                {STEPS.map((st, i) => (
                  <div key={i} style={{ textAlign: "center", opacity: i < step ? 0.35 : i === step ? 1 : 0.18, transition: "opacity 0.4s" }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: "50%",
                      background: i === step ? "#c8f542" : i < step ? "#2a2a2a" : "#1a1a1a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: i < step ? 16 : 18, margin: "0 auto 6px",
                      border: i === step ? "2px solid #c8f542" : "1px solid #2a2a2a",
                      color: i === step ? "#0a0a0a" : "#f0ece0",
                    }}>{i < step ? "✓" : st.icon}</div>
                    <div style={{ fontSize: 10, color: i === step ? "#c8f542" : "#444", ...mono }}>{st.label}</div>
                  </div>
                ))}
              </div>
              <div style={{
                width: 60, height: 60, margin: "0 auto 24px", borderRadius: "50%",
                border: "2px solid #1e1e1e", borderTop: "2px solid #c8f542",
                animation: "spin 0.85s linear infinite",
              }} />
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{stepMsg}</div>
              <div style={{ color: "#444", fontSize: 12, ...mono }}>Takes about 15–20 seconds</div>
            </div>
          )}

          {/* RESULTS */}
          {screen === "results" && results && (
            <div style={{ paddingTop: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...muted, marginBottom: 6 }}>Scan complete</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 4 }}>{results.product_name}</h2>
                {results.ingredients_source && (
                  <div style={{ fontSize: 12, color: "#444" }}>Source: {results.ingredients_source}</div>
                )}
              </div>

              {/* Score */}
              <div style={{ background: "#111", borderRadius: 16, padding: 24, border: "1px solid #1e1e1e", marginBottom: 24, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: 3, borderRadius: "3px 3px 0 0", width: `${results.scan_score}%`, background: scoreColor(results.scan_score) }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ ...muted, marginBottom: 8 }}>Clean Score</div>
                    <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-2px", color: scoreColor(results.scan_score), lineHeight: 1 }}>{results.scan_score}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>out of 100</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{results.scan_score >= 80 ? "✅" : results.scan_score >= 50 ? "⚠️" : "🚨"}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{results.additives?.length || 0} additives</div>
                  </div>
                </div>
                <p style={{ margin: "16px 0 0", fontSize: 13, color: "#888", lineHeight: 1.6 }}>{results.summary}</p>
              </div>

              {/* Raw ingredients collapsible */}
              {results.ingredients_raw && (
                <details style={{ marginBottom: 20 }}>
                  <summary style={{ fontSize: 12, color: "#555", cursor: "pointer", padding: "8px 0", userSelect: "none" }}>View full ingredients list</summary>
                  <div style={{ marginTop: 8, background: "#0d0d0d", borderRadius: 8, padding: 14, fontSize: 12, color: "#666", lineHeight: 1.7, border: "1px solid #1e1e1e" }}>
                    {results.ingredients_raw}
                  </div>
                </details>
              )}

              {/* Additives list */}
              {results.additives?.length > 0 ? (
                <div>
                  <div style={{ ...muted, marginBottom: 12 }}>Flagged Additives</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...results.additives]
                      .sort((a, b) => ({ high:0, moderate:1, low:2, safe:3 }[a.risk_level] - { high:0, moderate:1, low:2, safe:3 }[b.risk_level]))
                      .map((additive, i) => {
                        const risk = RISK[additive.risk_level] || RISK.safe;
                        const open = expanded[i];
                        return (
                          <div key={i} style={{ background: "#111", borderRadius: 12, border: `1px solid ${open ? risk.bg + "44" : "#1e1e1e"}` }}>
                            <button onClick={() => toggle(i)} style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                              <div style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, ...mono, background: risk.bg, color: risk.text, whiteSpace: "nowrap" }}>{risk.label}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{additive.name}</div>
                                {additive.code && <div style={{ fontSize: 11, color: "#555", ...mono }}>{additive.code}</div>}
                              </div>
                              <div style={{ color: "#444" }}>{open ? "▲" : "▼"}</div>
                            </button>
                            {open && (
                              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1a1a1a" }}>
                                <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                                  {additive.concern && <div><div style={{ ...muted, marginBottom: 4 }}>Health concern</div><div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>{additive.concern}</div></div>}
                                  {additive.evidence && <div><div style={{ ...muted, marginBottom: 4 }}>Research evidence</div><div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>{additive.evidence}</div></div>}
                                  {additive.banned_in?.length > 0 && (
                                    <div>
                                      <div style={{ ...muted, marginBottom: 6 }}>Banned / restricted in</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {additive.banned_in.map(loc => <span key={loc} style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", padding: "3px 8px", borderRadius: 6, fontSize: 11, color: "#aaa" }}>{loc}</span>)}
                                      </div>
                                    </div>
                                  )}
                                  {additive.alternatives && (
                                    <div style={{ background: "#0d1a0d", border: "1px solid #1a2e1a", borderRadius: 8, padding: "10px 12px" }}>
                                      <div style={{ ...muted, color: "#4a7a4a", marginBottom: 4 }}>Cleaner alternatives</div>
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
                <div style={{ textAlign: "center", padding: "40px 24px", background: "#0d1a0d", borderRadius: 16, border: "1px solid #1a3a1a" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c8f542" }}>No concerning additives found!</div>
                  <div style={{ fontSize: 13, color: "#4a7a4a", marginTop: 8 }}>This product appears clean.</div>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => fileRef.current?.click()} style={{ ...btnP, flex: 1, padding: 14, fontSize: 14 }}>📷 Scan Another</button>
                <button onClick={reset} style={{ ...btnS, flex: 1, padding: 14, fontSize: 14 }}>Home</button>
              </div>
            </div>
          )}

        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
