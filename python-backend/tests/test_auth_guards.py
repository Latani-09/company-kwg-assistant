from uuid import uuid4

from app.core.security import create_access_token
from app.db.models.user import User, UserRole, UserStatus


def add_admin(db_session):
    admin = User(
        id=uuid4(),
        name="Test Admin",
        email="test-admin@example.com",
        username="test-admin",
        password_hash="test-password-hash",
        position="Administrator",
        role=UserRole.superAdmin,
        status=UserStatus.granted,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


def test_protected_endpoint_requires_token(client, seeded_sector):
    response = client.get(f"/api/v1/knowledge/qa?sector={seeded_sector.id}")

    assert response.status_code == 401


def test_protected_endpoint_rejects_invalid_token(client, seeded_sector):
    response = client.get(
        f"/api/v1/knowledge/qa?sector={seeded_sector.id}",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_protected_endpoint_accepts_valid_token(client, seeded_user, seeded_sector):
    token = create_access_token(seeded_user.id)

    response = client.get(
        f"/api/v1/knowledge/qa?sector={seeded_sector.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_admin_route_rejects_regular_user(client, seeded_user):
    token = create_access_token(seeded_user.id)

    response = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_admin_route_allows_super_admin(client, db_session):
    admin = add_admin(db_session)
    token = create_access_token(admin.id)

    response = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()[0]["username"] == admin.username
