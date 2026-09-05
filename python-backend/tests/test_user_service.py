from uuid import uuid4

from app.db.models.user import User, UserStatus
from app.db.models.user_sector import UserSector
from app.services import user_service


def add_user(db_session, *, username, status):
    user = User(
        id=uuid4(),
        name=username,
        email=f"{username}@example.com",
        username=username,
        password_hash="test-password-hash",
        position="Analyst",
        status=status,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_list_users_filters_by_status(db_session):
    pending = add_user(db_session, username="pending-user", status=UserStatus.pending)
    add_user(db_session, username="granted-user", status=UserStatus.granted)

    users = user_service.list_users(db_session, UserStatus.pending, None)

    assert [user.id for user in users] == [pending.id]


def test_list_users_filters_by_sector_key(db_session, seeded_sector):
    user = add_user(db_session, username="sector-user", status=UserStatus.granted)
    db_session.add(UserSector(user_id=user.id, sector_id=seeded_sector.id))
    db_session.commit()

    users = user_service.list_users(db_session, None, seeded_sector.key)

    assert [item.id for item in users] == [user.id]


def test_update_access_changes_status(db_session, seeded_user):
    updated = user_service.update_access(db_session, seeded_user.id, UserStatus.revoked)

    assert updated.status == UserStatus.revoked
    assert db_session.get(User, seeded_user.id).status == UserStatus.revoked
