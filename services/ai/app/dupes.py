"""Multilingual duplicate detection with a local ONNX model (provider `local`, works with AI offline)."""

import math
import os
from pathlib import Path

import numpy as np

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
CACHE = str(Path(__file__).resolve().parent.parent / "models")  # filled by the Render build step
# docs/AI.md says 0.75, but Marathi-vs-Hindi paraphrases score only ~0.53 cosine with this model, so the demo
# pair (000142 vs 000131, 250 m apart) lands at ~0.64. Calibration knob: DUPLICATE_THRESHOLD.
THRESHOLD = float(os.getenv("DUPLICATE_THRESHOLD", "0.6"))
_model = None


def model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        _model = TextEmbedding(MODEL, cache_dir=CACHE)
    return _model


def embed(texts: list[str]) -> np.ndarray:
    v = np.array(list(model().embed(texts)))
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def score(cosine: float, same_category: bool, distance_m: float | None) -> float:
    proximity = 0.0 if distance_m is None else max(0.0, 1 - distance_m / 500)
    return 0.6 * cosine + 0.25 * same_category + 0.15 * proximity


CANDIDATES = """
select r.id, r.ticket_no, r.description, r.ward_id, coalesce(r.category_code, r.category_hint) as category,
       coalesce(r.loc_x, l.x) as x, coalesce(r.loc_z, l.z) as z
from requests r left join landmarks l on l.id = r.landmark_id
where r.state not in ('CLOSED', 'REJECTED') and r.submitted_at > now_sim() - interval '72 hours'
  and r.id <> %(id)s
"""


def find(conn, req: dict, category: str) -> list[dict]:
    """Non-terminal requests in the last 72 sim-hours, same ward or within 500 m, scored per docs/AI.md."""

    def dist(c):
        if None in (req["x"], req["z"], c["x"], c["z"]):
            return None
        return math.hypot(req["x"] - c["x"], req["z"] - c["z"])

    cands = [c for c in conn.execute(CANDIDATES, {"id": req["id"]}).fetchall()
             if c["ward_id"] == req["ward_id"] or (dist(c) is not None and dist(c) <= 500)]
    if not cands:
        return []
    vecs = embed([req["description"]] + [c["description"] for c in cands])
    out = []
    for c, v in zip(cands, vecs[1:]):
        cos, d = float(vecs[0] @ v), dist(c)
        s = score(cos, c["category"] == category, d)
        if s >= THRESHOLD:
            out.append({"candidate_request_id": str(c["id"]), "ticket_no": c["ticket_no"], "score": round(s, 3),
                        "distance_m": None if d is None else round(d), "cosine": round(cos, 3)})
    return sorted(out, key=lambda o: -o["score"])
