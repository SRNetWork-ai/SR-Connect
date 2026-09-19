# میانبرهای روزمره. روی سرور: make -C /opt/sr-connect <هدف>
SHELL := /bin/bash
COMPOSE := docker compose -f deploy/docker-compose.yml --env-file deploy/.env

.PHONY: help install dev build up down restart logs ps migrate seed keygen health backup update fmt typecheck

help: ## این راهنما
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'

install: ## نصب کامل روی سرور (نیاز به sudo)
	sudo bash deploy/scripts/install.sh

dev: ## اجرای توسعه: وب + گیت‌وی
	npm run dev & npm run dev:gateway

build: ## بیلد همه‌ی ورک‌اسپیس‌ها
	npm run build

typecheck: ## بررسی تایپ‌ها
	npm run typecheck

fmt: ## قالب‌بندی کد
	npm run format

up: ## بالا آوردن پشته
	$(COMPOSE) up -d --remove-orphans

down: ## خواباندن پشته
	$(COMPOSE) down

restart: ## راه‌اندازی مجدد وب و گیت‌وی
	$(COMPOSE) restart web gateway

ps: ## وضعیت کانتینرها
	$(COMPOSE) ps

logs: ## لاگ زنده
	$(COMPOSE) logs -f --tail=100 web gateway caddy

migrate: ## اجرای مهاجرت دیتابیس
	$(COMPOSE) exec -T web node apps/web/scripts/migrate.mjs

seed: ## داده‌ی اولیه
	$(COMPOSE) exec -T web node apps/web/scripts/seed.mjs

keygen: ## ساخت جفت‌کلید Ed25519 برای امضای آپدیت
	node apps/web/scripts/keygen.mjs ./dev-keys

health: ## بررسی سلامت
	sudo bash deploy/scripts/health.sh

backup: ## بکاپ کامل
	sudo bash deploy/scripts/backup.sh

update: ## به‌روزرسانی سرور از گیت
	sudo bash deploy/scripts/update.sh
