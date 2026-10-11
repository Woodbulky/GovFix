# GovFix AI service

FastAPI on :8787 (`npm run ai`). Endpoints: `/health`, `/suggest`, `/draft-reply`, `/tts`, `/niva/session`.
Writes only to `ai_suggestions` as the `ai_writer` role. Provider chain: Groq (`llm`) → keyword classifier (`keyword`); duplicates via multilingual MiniLM, int8 ONNX + sentencepiece, ~260 MB RAM (`local`).

## Accuracy (tests/data/labelled.jsonl, 20 examples, en/hi/mr)

Run: `PYTHONIOENCODING=utf-8 uv run --env-file ../../.env python -m app.eval`

| Provider | Correct | Accuracy |
|---|---|---|
| llm (Groq, openai/gpt-oss-120b) | 20/20 | 100% |
| keyword | 15/20 | 75% |

Marathi water-leak sample → `water_leak`, confidence 0.97 (`llm`).
