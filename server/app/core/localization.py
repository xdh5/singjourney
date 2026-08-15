from fastapi import Header


def resolve_request_locale(
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> str:
    """Resolve every API request to one of the product's supported locales."""
    preferred = (accept_language or "zh-Hans").split(",", 1)[0].strip().lower()
    return "en" if preferred.startswith("en") else "zh-Hans"
