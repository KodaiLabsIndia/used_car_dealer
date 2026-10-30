from app.adapters.assistant_context import AssistantContext
from app.adapters.assistant_store import AssistantStore
from app.adapters.ollama import OllamaDraftModel
from app.application.assistant import AssistantRunner


def compose_assistant(settings, workflows, commercial, documents):
    context = AssistantContext(workflows, commercial, documents, settings.media_path)
    store = AssistantStore(context, settings)
    model = OllamaDraftModel(settings.ai_url, settings.ai_model, settings.ai_allow_remote)
    return store, AssistantRunner(store, context, model)
