# Proposal: Tests & Deployment

## Problem

Текущий код полностью рабочий и собран, но не имеет:
- **Автоматических тестов** — нет уверенности при рефакторинге
- **CI/CD** — нет автоматической сборки и проверки при коммитах
- **Production-деплоя** — нет инструкций и конфигураций для продакшена

## Solution

Добавить полный набор тестов и production-инфраструктуру:

1. **Backend tests**: Unit-тесты для game logic, интеграционные тесты для API
2. **Frontend tests**: Unit-тесты для компонентов
3. **CI/CD pipeline**: GitHub Actions для сборки и тестирования
4. **Docker**: Контейнеризация для деплоя
5. **Deploy guide**: Инструкции по развёртыванию

## Goals

| Goal | Metric |
|------|--------|
| Backend test coverage | ≥ 80% game logic |
| Frontend component tests | Все UI-компоненты покрыты |
| CI passes in < 5 min | От сборки до вывода |
| Docker one-command deploy | `docker-compose up` |
| Deploy docs | Пошаговый guide |

## Scope

| In scope | Out of scope |
|----------|-------------|
| Backend unit tests (gameLogic, wordDatabase) | E2E тесты (Playwright) — future |
| Backend integration tests (API endpoints) | Kubernetes — future |
| Frontend component tests (GameBoard, Scoreboard, ClueDisplay) | Monitoring (Grafana/Prometheus) — future |
| Jest config | Auth/OAuth — future |
| GitHub Actions workflow | Staging environment — future |
| Docker + docker-compose | SSL/HTTPS setup — future |
| .env templates | CDN setup — future |

## Users

| User | Value |
|------|-------|
| **Developer** | Уверенность при рефакторинге, CI ловит ошибки |
| **Reviewer** | Тесты как доказательство корректности |
| **Operator** | Один `docker-compose up` для запуска |

## Success Criteria

1. `npm test` проходит — backend + frontend тесты green
2. `npm run build` проходит — обе сборки green
3. `docker-compose up` запускает полную игру
4. GitHub Actions проверяет PR (lint + test + build)
5. Deploy guide покрывает VPS и Docker

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Тесты замедляют разработку | Негативный | Fast unit tests < 2s total |
| Docker сложность для новичков | Негативный | docker-compose abстрагирует сложность |
| CI стоит денег | Средний | GitHub Actions free tier для OSS |

## Timeline

| Phase | Duration |
|-------|----------|
| Backend tests (Jest) | 1 day |
| Frontend tests (Vitest) | 1 day |
| Docker + docker-compose | 0.5 day |
| GitHub Actions | 0.5 day |
| Deploy guide | 0.5 day |
| **Total** | **~3.5 days** |

## Current Status

**Planning only.** После артефактов нужно запустить `/opsx-apply`.
