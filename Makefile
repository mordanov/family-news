.PHONY: help up down build logs test-backend test-frontend test setup

help:
	@echo ""
	@echo "  Семейная лента — команды"
	@echo "  ─────────────────────────────────────────"
	@echo "  make setup          — скопировать .env.example → .env"
	@echo "  make up             — запустить все сервисы"
	@echo "  make down           — остановить все сервисы"
	@echo "  make build          — пересобрать образы"
	@echo "  make logs           — показать логи"
	@echo "  make test-backend   — запустить backend тесты"
	@echo "  make test-frontend  — запустить frontend тесты"
	@echo "  make test           — запустить все тесты"
	@echo ""

setup:
	@if [ ! -f .env ]; then cp .env.example .env && echo "✓ .env создан — отредактируйте пароли перед запуском!"; else echo "✓ .env уже существует"; fi

up: setup
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

test-backend:
	docker compose run --rm backend pytest -v

test-frontend:
	node frontend/tests/test_frontend.js

test: test-frontend
	docker compose run --rm backend pytest -v
