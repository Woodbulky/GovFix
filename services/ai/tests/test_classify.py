from fastapi.testclient import TestClient

from app.classify import Extracted, keyword_classify, spans
from app.dupes import score
from app.eval import labelled, seed_keywords
from app.main import app

KW = seed_keywords()


def test_keyword_fallback_on_labelled_set():
    data = labelled()
    assert len(data) == 20
    right = sum(keyword_classify(ex["text"], KW).category_code == ex["label"] for ex in data)
    assert right >= 15, right  # README reports the exact number and every miss


def test_keyword_confidence_formula():
    c = keyword_classify("pipe burst, water leaking, गळती", KW)
    assert c.category_code == "water_leak" and c.confidence == 0.6
    none = keyword_classify("the park bench is painted blue", KW)
    assert (none.category_code, none.confidence) == ("other", 0.2)


def test_spans_point_into_original_text():
    text = "आमच्या गल्लीत दोन दिवसांपासून पाणी गळतंय, घंटाघर चौकाजवळ."
    s = spans(text, Extracted(landmark_text="घंटाघर चौकाजवळ", since_text="दोन दिवसांपासून", ward_text="Ward 9"))
    assert [text[x["start"]:x["end"]] for x in s] == ["दोन दिवसांपासून", "घंटाघर चौकाजवळ"]


def test_duplicate_score_weights():
    assert score(1.0, True, 0) == 1.0
    assert round(score(0.8, True, 250), 3) == 0.805
    assert score(0.9, False, None) < 0.75


def test_endpoints_need_a_session():
    c = TestClient(app)
    assert c.post("/suggest", json={"request_id": "00000000-0000-0000-0000-000000000000"}).status_code == 401
    assert c.post("/tts", json={"text": "hi"}, headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401
