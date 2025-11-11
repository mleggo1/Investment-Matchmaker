import React from "react";

export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1220",
      color: "#e6eefc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <div style={{
        background: "#111827",
        padding: 32,
        borderRadius: 20,
        border: "1px solid #233054",
        maxWidth: 520
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          MJL React + GitHub Pages Template
        </h1>
        <p style={{ color: "#9fb0d1", marginBottom: 16 }}>
          Use this as the starting point for your next tools — Ultimate Target, Wealth Engine, dashboards.
        </p>
        <ol style={{ lineHeight: 1.6 }}>
          <li>Edit <code>package.json</code> → change REPLACE_ME</li>
          <li>Edit <code>vite.config.js</code> → change REPLACE_ME</li>
          <li>Run <code>npm run deploy</code></li>
        </ol>
        <p style={{ color: "#9fb0d1", fontSize: 12, marginTop: 16 }}>
          Built for Michael 🏄‍♂️
        </p>
      </div>
    </div>
  );
}
