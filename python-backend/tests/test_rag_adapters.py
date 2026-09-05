from types import SimpleNamespace
from uuid import uuid4

from app.db.models.qa_entry import EMBEDDING_DIM, QAEntry
from app.services.rag import embeddings, gap_detection, generation, retrieval


def test_embedding_client_is_created_from_settings(monkeypatch):
    created = []
    fake_client = object()
    monkeypatch.setattr(embeddings, "_client", None)
    monkeypatch.setattr(embeddings, "get_settings", lambda: SimpleNamespace(gemini_api_key="embedding-key"))
    monkeypatch.setattr(embeddings.genai, "Client", lambda api_key: created.append(api_key) or fake_client)

    assert embeddings._get_client() is fake_client
    assert created == ["embedding-key"]


def test_generation_client_is_created_from_settings(monkeypatch):
    created = []
    fake_client = object()
    monkeypatch.setattr(generation, "_client", None)
    monkeypatch.setattr(generation, "get_settings", lambda: SimpleNamespace(gemini_api_key="generation-key"))
    monkeypatch.setattr(generation.genai, "Client", lambda api_key: created.append(api_key) or fake_client)

    assert generation._get_client() is fake_client
    assert created == ["generation-key"]


def test_embed_text_calls_gemini_with_model_and_dimension(monkeypatch):
    calls = {}

    class FakeModels:
        def embed_content(self, **kwargs):
            calls.update(kwargs)
            return SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1, 0.2])])

    monkeypatch.setattr(embeddings, "_get_client", lambda: SimpleNamespace(models=FakeModels()))

    result = embeddings.embed_text("release process")

    assert result == [0.1, 0.2]
    assert calls["model"] == embeddings.EMBEDDING_MODEL
    assert calls["contents"] == "release process"
    assert calls["config"].output_dimensionality == EMBEDDING_DIM


def test_generate_builds_grounded_json_prompt(monkeypatch):
    entry_id = uuid4()
    entry = SimpleNamespace(
        id=entry_id,
        question="How are releases approved?",
        answer="Product reviews every release.",
    )
    calls = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.update(kwargs)
            return SimpleNamespace(
                text='{"answer":"Product review is required.","used_source_ids":["%s"],"sufficient":true}'
                % entry_id
            )

    monkeypatch.setattr(generation, "_get_client", lambda: SimpleNamespace(models=FakeModels()))

    result = generation.generate("How are releases approved?", [(entry, 0.9)])

    assert result["answer"] == "Product review is required."
    assert result["used_source_ids"] == [str(entry_id)]
    assert result["sufficient"] is True
    assert calls["model"] == generation.GENERATION_MODEL
    assert "How are releases approved?" in calls["contents"]
    assert str(entry_id) in calls["contents"]
    assert calls["config"].response_mime_type == "application/json"


def test_generate_raises_for_invalid_json(monkeypatch):
    class FakeModels:
        def generate_content(self, **kwargs):
            return SimpleNamespace(text="not-json")

    monkeypatch.setattr(generation, "_get_client", lambda: SimpleNamespace(models=FakeModels()))

    try:
        generation.generate("Question", [])
    except ValueError:
        pass
    else:
        raise AssertionError("Expected invalid JSON to raise ValueError")


def test_retrieval_returns_similarity_scores_in_descending_order(db_session, seeded_user, seeded_sector):
    first = QAEntry(
        id=uuid4(),
        sector_id=seeded_sector.id,
        question="Closest",
        answer="Closest answer",
        embedding=[1.0] + [0.0] * (EMBEDDING_DIM - 1),
        created_by=seeded_user.id,
    )
    second = QAEntry(
        id=uuid4(),
        sector_id=seeded_sector.id,
        question="Further",
        answer="Further answer",
        embedding=[0.0, 1.0] + [0.0] * (EMBEDDING_DIM - 2),
        created_by=seeded_user.id,
    )
    db_session.add_all([first, second])
    db_session.commit()

    results = retrieval.search(db_session, [1.0] + [0.0] * (EMBEDDING_DIM - 1), top_k=1)

    assert len(results) == 1
    assert results[0][0].id == first.id
    assert results[0][1] > 0.99


def test_retrieval_returns_empty_for_empty_database(db_session):
    assert retrieval.search(db_session, [0.0] * EMBEDDING_DIM) == []


def test_gap_detection_covers_threshold_and_llm_veto_cases():
    assert gap_detection.decide(None, None) is True
    assert gap_detection.decide(0.54, True) is True
    assert gap_detection.decide(0.9, False) is True
    assert gap_detection.decide(0.9, True) is False
    assert gap_detection.decide(0.9, None) is False
