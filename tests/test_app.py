from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_home_renders():
    r = client.get("/")
    assert r.status_code == 200
    assert "Alcohol Verification App" in r.text


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_extract_not_implemented_yet():
    r = client.post("/api/extract")
    assert r.status_code == 501
    assert "error" in r.json()
