import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import authRoutes from "./routes/auth.js";
import verifyToken from "./middleware/authMiddleware.js";

dotenv.config();
const app = express();

app.use(cors());
// --- Get correct __dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Serve Static Frontend Files ---
// Assumes your 'frontend' folder is one level up from your 'backend' folder
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);

app.post("/api/review", async (req, res) => {
  try {
    const { code, model } = req.body;

    // 1. Get the model name. We'll default to mistral.
    // You can add logic here to map your dropdown values
    // (e.g., "Mistral Standard (Fast)") to an Ollama model name ("mistral").
    let ollamaModel = "mistral"; // default
    if (model === "qwen2.5:0.5b") {
      ollamaModel = "qwen2.5:0.5b";
    }
    if (model === "llama3.2:1b") {
      ollamaModel = "llama3.2:1b";
    }
    if (model === "deepseek-coder:6.7b") {
      ollamaModel = "deepseek-coder:6.7b";
    }
    // Add other model mappings here
    // else if (model === "Advanced (Better detection)") {
    //   ollamaModel = "some-other-model";
    // }

    // 2. Create the prompt for the AI
    const prompt = `
      Please act as an expert code reviewer.
      Review the following code for bugs, errors, and performance issues.
      Provide a list of identified issues and a suggested fix.

      Code:
      \`\`\`
      ${code}
      \`\`\`
    `;

    // 3. Call the local Ollama API
    const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        stream: false, // Set to false for a single, complete response
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
    }

    const ollamaResult = await ollamaResponse.json();

    // 4. Send the AI's response back to the frontend
    res.json({ review: ollamaResult.response });

  } catch (err) {
    console.error("Error in /api/review:", err);
    res.status(500).json({ error: "Failed to review code." });
  }
});

// Protected example route
app.get("/profile", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);
