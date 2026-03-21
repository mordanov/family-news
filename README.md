# 📰 Семейная лента

Приложение для хранения семейных новостей — с фотографиями, цветными карточками и удобным интерфейсом.

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS (ES modules), без сборщика |
| Backend | Python 3.12, FastAPI, asyncpg |
| База данных | PostgreSQL 16 |
| Хранилище фото | Docker volume |
| Прокси | Nginx |

---

## Быстрый старт

### 1. Клонируйте репозиторий и перейдите в папку
```bash
cd newsfeed
```

### 2. Создайте `.env`
```bash
make setup
# или вручную:
cp .env.example .env
```

Отредактируйте `.env` — смените пароли:
```env
POSTGRES_PASSWORD=ваш_надёжный_пароль
SECRET_KEY=длинная_случайная_строка_32+символа
USER1_LOGIN=admin
USER1_PASSWORD=ваш_пароль_admin
USER2_LOGIN=мама
USER2_PASSWORD=ваш_пароль_мамы
```

### 3. Запустите
```bash
make up
# или:
docker compose up -d
```

Приложение доступно на: **http://localhost:8080**

---

## Структура проекта

```
newsfeed/
├── docker-compose.yml
├── .env.example
├── Makefile
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── app/
│       ├── main.py          # FastAPI app, lifespan
│       ├── config.py        # Настройки из .env
│       ├── database.py      # asyncpg pool, init_db, seed users
│       ├── api/
│       │   ├── auth.py      # POST /api/auth/login, GET /api/auth/me
│       │   └── news.py      # CRUD новостей и фотографий
│       ├── services/
│       │   ├── auth.py      # bcrypt, JWT
│       │   ├── news.py      # SQL запросы
│       │   └── photos.py    # сохранение + thumbnail (Pillow)
│       └── tests/
│           └── test_backend.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── tests/
    │   └── test_frontend.js
    ├── src/                 # исходники (для разработки)
    └── public/              # то, что раздаёт nginx
        ├── index.html
        ├── style.css
        ├── app.js
        ├── api.js
        ├── state.js
        └── components/
            ├── Login.js
            ├── Feed.js
            ├── NewsCard.js
            ├── NewsForm.js
            └── Lightbox.js
```

---

## API

### Авторизация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Получить JWT токен |
| GET | `/api/auth/me` | Информация о текущем пользователе |

### Новости
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/news?page=1` | Список новостей (10 на страницу) |
| POST | `/api/news` | Создать новость (multipart/form-data) |
| GET | `/api/news/{id}` | Получить одну новость |
| PUT | `/api/news/{id}` | Обновить новость |
| DELETE | `/api/news/{id}` | Удалить новость + фото |
| DELETE | `/api/news/{id}/photos/{pid}` | Удалить одно фото |
| GET | `/api/news/meta/colors` | Список доступных цветов |

Все эндпоинты (кроме `/login`) требуют заголовок:
```
Authorization: Bearer <token>
```

### Пользователи и роли

**Роли доступа:**
- `full_access` — полный доступ: создание, редактирование, удаление новостей, управление пользователями
- `read_only` — только чтение новостей

**Все текущие пользователи** при обновлении получают роль `full_access` автоматически.  
**Гарантия:** всегда должен оставаться **минимум один** пользователь с `full_access`.

| Метод | Путь | Роль | Описание |
|-------|------|------|----------|
| GET | `/api/users` | `full_access` | Список всех пользователей |
| POST | `/api/users` | `full_access` | Создать пользователя (уникальный логин, роль по умолчанию `read_only`) |
| PATCH | `/api/users/{id}/role` | `full_access` | Изменить роль пользователя |
| DELETE | `/api/users/{id}` | `full_access` | Удалить пользователя (не себя, не последнего full_access) |

**Пример создания пользователя:**
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"login":"papa","password":"secret","role":"read_only"}'
```

**Пример смены роли:**
```bash
curl -X PATCH http://localhost:8080/api/users/3/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"full_access"}'
```

**В интерфейсе:**
- Кнопка **«Пользователи»** (видна только для `full_access`)
- Модалка управления пользователями: создание, смена роли, удаление
- Бейдж роли в хедере (🔑 Полный доступ / 👁️ Только чтение)
- Для `read_only`: скрыты кнопки «+ Добавить», редактирования/удаления новостей

Каждая новость в ответе API содержит поле `author` (строка с логином автора на момент создания новости):

```json
{
  "id": 42,
  "description": "...",
  "color": "amber",
  "author": "admin",
  "created_at": "2026-03-21T12:30:00+00:00",
  "updated_at": "2026-03-21T12:30:00+00:00",
  "photos": []
}
```

---

## Управление

```bash
make up              # запустить
make down            # остановить
make logs            # смотреть логи
make build           # пересобрать образы
make test-frontend   # тесты фронтенда (node)
make test            # все тесты
```

---

## Тесты

### Frontend (24 теста, без зависимостей)
```bash
node frontend/tests/test_frontend.js
```
Тестируют: state management, пагинацию, экранирование HTML, цветовые утилиты, хранение токена.

### Backend (13 тестов)
```bash
# Внутри Docker:
docker compose run --rm backend pytest -v

# Локально (нужны зависимости):
cd backend && pip install -r requirements.txt && pytest -v
```
Тестируют: хеширование паролей, JWT, файловые утилиты, форматирование новостей, конфигурацию.

---

## Данные

- **Фотографии** хранятся в Docker volume `photos_data` → `/app/photos/`
- **Thumbnails** (300×300 JPEG) → `/app/photos/thumbnails/`
- **PostgreSQL** данные → volume `postgres_data`
- Для существующих новостей при обновлении схемы поле автора заполняется значением `admin`

При удалении новости — удаляются все её фото и thumbnails с диска.  
При удалении фото в редакторе — файл тоже удаляется с диска.

---

## Безопасность

- Все маршруты защищены JWT (кроме `/login`)
- Пароли хранятся как bcrypt хеши
- Доступа по умолчанию нет — только пользователи из `.env`
- Токен действует 24 часа
- **Управление доступом**: `full_access` контролирует CRUD новостей и пользователей, `read_only` — только чтение
- **Роли в JWT**: включены в токен и переподтверждаются на сервере при каждом запросе

---

## Добавление пользователей

Пользователи создаются **при первом запуске** из `.env` с ролью `full_access`.

**Через интерфейс** (для `full_access`):
1. Нажмите кнопку «Пользователи» в хедере
2. Заполните логин, пароль, выберите роль
3. Нажмите «Добавить пользователя»

**Через API** (curl, используя токен `full_access`):
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer <ваш_токен>" \
  -H "Content-Type: application/json" \
  -d '{"login":"новый","password":"pass123","role":"read_only"}'
```

**Напрямую в БД** (если нужна срочная правка):

```bash
docker compose exec postgres psql -U newsfeed -d newsfeed
```
```sql
INSERT INTO users (login, password_hash, role)
VALUES ('новый_логин', '<bcrypt_hash>', 'full_access');
```

Сгенерировать bcrypt hash:
```bash
docker compose run --rm backend python -c "
from app.services.auth import hash_password
print(hash_password('ваш_пароль'))
"
```
