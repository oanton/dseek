# Документація API / API Documentation

## Вступ / Introduction

Цей документ містить опис API нашого сервісу.
This document describes our service API.

## Автентифікація / Authentication

### API Ключі / API Keys

Для доступу до API потрібен ключ автентифікації.
To access the API, you need an authentication key.

Отримати ключ можна в налаштуваннях акаунту.
Keys can be obtained from account settings.

## Приклади / Examples

### Пошук / Search

```bash
curl -X POST https://api.example.com/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query": "пошуковий запит"}'
```

### Відповідь / Response

```json
{
  "results": [
    {
      "id": "doc-123",
      "title": "Результат пошуку",
      "snippet": "Фрагмент тексту..."
    }
  ],
  "total": 42
}
```

## Ліміти / Limits

- Безкоштовний план / Free plan: 100 запитів/день
- Про план / Pro plan: 10,000 запитів/день

## Підтримка / Support

Зв'яжіться з нами: support@example.com
Contact us: support@example.com
