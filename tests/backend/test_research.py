from __future__ import annotations


def test_research_overview_is_available(client):
    response = client.get("/api/v1/research")
    assert response.status_code == 200
    body = response.json()
    assert body["project"]["primary_architecture"] == "convnext_tiny"
    assert [d["id"] for d in body["datasets"]] == ["leaf", "seed", "final"]
    assert [s["id"] for s in body["training_stages"]] == ["leaf", "seed", "final"]


def test_experiment_endpoint_never_fabricates_metrics(client):
    response = client.get("/api/v1/research/experiments")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"pending", "partial", "complete"}
    assert {r["id"] for r in body["routes"]} == {"baseline", "leaf_to_final", "seed_to_final", "progressive"}
    for route in body["routes"]:
        if route["status"] == "pending":
            assert all(value is None for value in route["metrics"].values())
