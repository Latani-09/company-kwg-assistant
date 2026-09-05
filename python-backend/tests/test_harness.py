def test_health_smoke(public_client):
    response = public_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seeded_gap_fixture(db_session, seeded_gap, seeded_user, seeded_sector):
    assert seeded_gap.question_text == "How do we test this?"
    assert seeded_gap.asker_id == seeded_user.id
    assert seeded_sector.key == "product"
