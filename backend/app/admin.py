import argparse

from sqlalchemy import select

from . import models  # noqa: F401
from .config import Settings
from .db import database
from .identity.models import User

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Local operator command: grant/revoke corpus administrator')
    parser.add_argument('email')
    parser.add_argument('--revoke', action='store_true')
    args = parser.parse_args()
    engine, sessions = database(Settings().database_url)
    with sessions() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()))
        if not user:
            parser.error('Account not found; register first.')
        user.is_admin = not args.revoke
        db.commit()
        print('Administrator role updated.')
    engine.dispose()
