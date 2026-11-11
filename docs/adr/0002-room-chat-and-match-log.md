# ADR 0002: Room chat and match log (with spymaster targets)

- Status: Accepted
- Date: 2026-11-11
- Deciders: project maintainers
- Relates to: [ADR 0001](0001-baseline-architecture.md)

## Context

Нужен текстовый канал в партии и фиксация выбранных карточек, без смешивания свободного чата с подсказкой шпиона (правила Codenames). Выбрано: чат всей комнаты (1A) + лог событий и отметки целевых карт шпионом (2B).

## Decision

1. **Чат комнаты** — отдельный WS-канал `chat` / `chat_history`. Видят все в комнате. Не заменяет `start_round`.
2. **Журнал партии (`eventLog`)** — подсказки (с `targetWords`), угадывания, skip, истечение хода, конец игры. Идёт в `game_update`.
3. **Mark targets** — в фазе `spymaster-ready` шпион текущего хода через `mark_targets` отмечает закрытые слова на доске; `start_round` требует ≥1 target. После отправки подсказки targets копируются в событие `clue` и сбрасываются из live-state.
4. **`clueHistory`** сохраняется (совместимость) и дублирует краткие подсказки; полный разбор — в `eventLog`.

## Consequences

### Positive

- Подсказка остаётся структурированной; чат не ломает правила.
- Разбор партии и «что имел в виду шпион» доступны в журнале.
- Чат прост (один канал на комнату).

### Negative

- Клиенты должны уметь mark → clue (два шага).
- `clueTargets` нужно редactить в `game_update` для чужих игроков.
- Рост payload `game_update` из-за `eventLog` (ring buffer).
