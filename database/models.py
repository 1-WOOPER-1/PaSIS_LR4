"""Database schema. Authentication and HTTP access checks belong to the backend."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "pk": "pk_%(table_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ix": "ix_%(table_name)s_%(column_0_name)s",
        }
    )


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", BigInteger, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_user_roles_role_id", "role_id"),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", BigInteger, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "permission_id",
        BigInteger,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Index("ix_role_permissions_permission_id", "permission_id"),
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("login", name="uq_users_login"),
        CheckConstraint("login ~ '^[A-Za-z0-9_.-]{3,32}$'", name="ck_users_login_format"),
        CheckConstraint("length(password_hash) > 0", name="ck_users_password_hash_not_empty"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    login: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    roles: Mapped[list[Role]] = relationship(
        secondary=user_roles, back_populates="users", passive_deletes=True
    )


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("name", name="uq_roles_name"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    users: Mapped[list[User]] = relationship(
        secondary=user_roles, back_populates="roles", passive_deletes=True
    )
    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, back_populates="roles", passive_deletes=True
    )


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("code", name="uq_permissions_code"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    roles: Mapped[list[Role]] = relationship(
        secondary=role_permissions, back_populates="permissions", passive_deletes=True
    )
