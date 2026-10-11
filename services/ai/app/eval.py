"""Accuracy per provider on tests/data/labelled.jsonl. Run: uv run python -m app.eval  (llm row needs GROQ_* env)."""

import json
import re
from pathlib import Path

from .classify import keyword_classify, llm_classify

ROOT = Path(__file__).resolve().parents[1]


def seed_keywords() -> dict[str, list[str]]:
    """categories.keywords straight from supabase/seed/03_reference.sql, so tests need no database."""
    sql = (ROOT.parents[1] / "supabase/seed/03_reference.sql").read_text(encoding="utf-8")
    return {code: re.findall(r"'([^']*)'", body) for code, body in re.findall(r"\('(\w+)', array\[(.*?)\]", sql, re.S)}


def labelled() -> list[dict]:
    return [json.loads(line) for line in (ROOT / "tests/data/labelled.jsonl").read_text(encoding="utf-8").splitlines()]


if __name__ == "__main__":
    kw, data = seed_keywords(), labelled()
    for name, fn in [("keyword", lambda t: keyword_classify(t, kw)), ("llm", lambda t: llm_classify(t, set(kw)))]:
        misses, ok = [], 0
        for ex in data:
            c = fn(ex["text"])
            if c and c.category_code == ex["label"]:
                ok += 1
            else:
                misses.append(f"  {ex['lang']}: {ex['label']} -> {c.category_code if c else 'no answer'}: {ex['text']}")
        print(f"{name}: {ok}/{len(data)}")
        print("\n".join(misses))
