# ADR 0003: Per-player auth and card color visibility

- Status: Accepted
- Date: 2026-11-12
- Deciders: project maintainers

## Context

После чата/журнала (ADR 0002) оставались дыры: shared room token, цвета карт в API для guesser’ов, публичный snapshot комнаты. Нужна явная модель «кто что видит» и как авторизуется действие.

## Decision

1. **Per-player token** — при create/join выдаётся секрет игрока (`playerTokens[playerId]`). WS и privileged REST (`claim-seat`, `start`, `delete`) требуют пару `playerId` + token.
2. **Membership check** — WS закрывается с 4002, если `playerId` нет в комнате; 4003 при неверном токене.
3. **`gameStateForViewer`** — нераскрытые `card.color` = `null` для guesser/anonymous; spymaster/spectator/`finished` видят расклад. Pending `clueTargets` — только marking spymaster.
4. **Public `GET /rooms/:id`** — без auth отдаёт sanitized snapshot (без цветов). С auth — personalized view.
5. **`GET /api/rooms` list** — выключен по умолчанию (`ALLOW_ROOM_LIST=true` для tooling).

## Consequences

### Positive

- DevTools не раскрывает расклад guesser’у.
- Нельзя выдать чужой ход, подставив чужой `playerId` с чужим токеном.

### Negative / risks

- Старые клиенты с shared room token ломаются (нужен redeploy фронта).
- Impersonation внутри одного аккаунта/устройства всё ещё возможна, если угнать session из localStorage — приемлемо для casual web game.

## References

- [`backend/src/utils/gameStateView.ts`](../../backend/src/utils/gameStateView.ts)
- [`backend/src/utils/roomManager.ts`](../../backend/src/utils/roomManager.ts) — `authenticate`, `playerTokens`
- ADR 0001 §6 (superseded in part by this ADR)
