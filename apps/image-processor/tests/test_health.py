from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def test_health_reports_ok() -> None:
    response = client.get('/health')

    assert response.status_code == 200
    body = response.json()
    assert body['status'] == 'ok'
    assert body['uptime'] >= 0
    assert body['timestamp'].endswith(('Z', '+00:00'))
