from app.adapters.catalogue import CatalogueStore, import_catalogue
from app.adapters.database import create_database
from app.config import Settings

if __name__ == "__main__":
    settings = Settings()
    settings.validate_runtime()
    engine = create_database(settings.sqlalchemy_url)
    try:
        import_catalogue(engine)
        print(CatalogueStore(engine).coverage().model_dump_json())
    finally:
        engine.dispose()
