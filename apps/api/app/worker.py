"""Local notification and bounded AI worker; no customer messaging or banking."""

import argparse
import logging
from threading import Event

from app.adapters.commercial import CommercialStore
from app.adapters.database import create_database
from app.adapters.documents import DocumentStore
from app.adapters.notifications import NotificationStore
from app.adapters.operations import OperationsStore
from app.adapters.purchases import PurchaseStore
from app.adapters.workflows import WorkflowStore
from app.assistant_composition import compose_assistant
from app.config import Settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    settings.validate_runtime()
    engine = create_database(settings.sqlalchemy_url)
    store = NotificationStore(engine)
    workflows = WorkflowStore(OperationsStore(engine))
    _, assistant = compose_assistant(
        settings,
        workflows,
        CommercialStore(PurchaseStore(workflows)),
        DocumentStore(workflows, settings.media_path),
    )
    stop = Event()
    try:
        while True:
            try:
                expired = store.expire_bookings()
                delivered = store.drain()
                reminded = store.reminders()
                assistant.process_one()
                logging.info("Worker cycle expired=%d events=%d reminders=%d", expired, delivered, reminded)
            except Exception as error:
                logging.error("Worker cycle failed error_type=%s", type(error).__name__)
                if args.once:
                    raise
            if args.once:
                break
            stop.wait(30)
    except KeyboardInterrupt:
        pass
    finally:
        engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
