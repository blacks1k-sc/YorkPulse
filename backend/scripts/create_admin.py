"""
Script to create an admin user directly in the database.
Bypasses OTP verification for admin account setup.

Usage:
    python scripts/create_admin.py --email admin@yorku.ca --name "Admin User"
"""

import asyncio
import argparse
import uuid
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.user import User


async def create_admin(email: str, name: str) -> None:
    """Create an admin user directly in the database."""

    async with async_session_maker() as db:
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == email))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            if existing_user.is_admin:
                print(f"User {email} is already an admin.")
                return
            else:
                # Upgrade existing user to admin
                existing_user.is_admin = True
                existing_user.email_verified = True
                existing_user.name_verified = True
                await db.commit()
                print(f"Upgraded existing user {email} to admin.")
                return

        # Create new admin user
        admin_user = User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            email_verified=True,  # Bypass OTP verification
            name_verified=True,   # Bypass name verification
            is_admin=True,
            is_active=True,
            is_banned=False,
        )

        db.add(admin_user)
        await db.commit()

        print(f"Admin user created successfully!")
        print(f"  Email: {email}")
        print(f"  Name: {name}")
        print(f"  ID: {admin_user.id}")
        print(f"\nYou can now login with this email using dev mode toggle.")


def main():
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--name", required=True, help="Admin display name")

    args = parser.parse_args()

    asyncio.run(create_admin(args.email, args.name))


if __name__ == "__main__":
    main()
