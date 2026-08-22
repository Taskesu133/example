import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { loadClientConfig, buildSystemPrompt } from "./lib/loadClientConfig.js";

const app = express();
const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { businessId, message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Nedostaje 'message'." });
  }

  const config = loadClientConfig(businessId);
  if (!config) {
    return res.status(404).json({ error: `Nepoznat biznis: ${businessId}` });
  }

  const priorTurns = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    ...priorTurns
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(config),
      output_config: { effort: "medium" },
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    res.json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Neispravan API kljuc:", error.message);
      return res.status(500).json({ error: "Server nije podesen ispravno (API kljuc)." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      console.error("Rate limit:", error.message);
      return res.status(429).json({ error: "Previse zahteva u ovom trenutku, pokusaj ponovo za malo." });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("API greska:", error.status, error.message);
      return res.status(502).json({ error: "Greska pri komunikaciji sa AI servisom." });
    }
    console.error("Neocekivana greska:", error);
    res.status(500).json({ error: "Neocekivana greska na serveru." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI biznis asistent radi na http://localhost:${PORT}`);
  console.log(`Demo stranica: http://localhost:${PORT}/demo.html`);
});
