"""Guard the dependency direction; policies and use cases must remain portable."""

import ast
from pathlib import Path


def test_domain_and_application_do_not_import_infrastructure():
    root = Path(__file__).parents[1] / "app"
    forbidden = (
        "sqlalchemy",
        "fastapi",
        "starlette",
        "httpx",
        "requests",
        "PIL",
        "app.adapters",
        "app.http",
        "app.main",
    )
    violations = []
    for layer in ("domain", "application"):
        for path in (root / layer).glob("*.py"):
            for node in ast.walk(ast.parse(path.read_text())):
                modules = (
                    [node.module]
                    if isinstance(node, ast.ImportFrom)
                    else [alias.name for alias in node.names]
                    if isinstance(node, ast.Import)
                    else []
                )
                violations.extend(
                    f"{path.name}:{node.lineno} → {module}"
                    for module in modules
                    if module
                    and any(module == prefix or module.startswith(prefix + ".") for prefix in forbidden)
                )
    assert not violations, "\n".join(violations)
