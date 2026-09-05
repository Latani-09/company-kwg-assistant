import os
from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base, get_db
from app.db.models import ChatQuery, KnowledgeGap, Sector, User, UserSector
from app.db.models.knowledge_gap import GapStatus
from app.db.models.user import UserRole, UserStatus
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://kwg:kwg@localhost:5432/kwg_assistant_test",
)


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            Base.metadata.create_all(connection)
    except SQLAlchemyError as error:
        engine.dispose()
        pytest.skip(f"test database unavailable: {error}")

    yield engine

    with engine.begin() as connection:
        Base.metadata.drop_all(connection)
    engine.dispose()


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    session_factory = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    session = session_factory()

    try:
        yield session
    finally:
        session.rollback()
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(delete(table))
        session.commit()
        session.close()


@pytest.fixture
def seeded_sector(db_session: Session) -> Sector:
    sector = Sector(id=uuid4(), key="product", label="Product", is_custom=False)
    db_session.add(sector)
    db_session.commit()
    db_session.refresh(sector)
    return sector


@pytest.fixture
def seeded_user(db_session: Session) -> User:
    user = User(
        id=uuid4(),
        name="Test User",
        email="test.user@example.com",
        username="test-user",
        password_hash="test-password-hash",
        position="Tester",
        role=UserRole.user,
        status=UserStatus.granted,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def seeded_gap(db_session: Session, seeded_user: User, seeded_sector: Sector) -> KnowledgeGap:
    db_session.add(UserSector(user_id=seeded_user.id, sector_id=seeded_sector.id))
    query = ChatQuery(
        id=uuid4(),
        asker_id=seeded_user.id,
        question_text="How do we test this?",
        is_gap=True,
    )
    db_session.add(query)
    db_session.flush()

    gap = KnowledgeGap(
        id=uuid4(),
        source_query_id=query.id,
        question_text=query.question_text,
        asker_id=seeded_user.id,
        status=GapStatus.open,
    )
    db_session.add(gap)
    db_session.commit()
    db_session.refresh(gap)
    return gap


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def public_client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
