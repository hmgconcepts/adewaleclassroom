# Insights & methodologies (no AI)

## Formulas

```
value_added      = current_avg - baseline
attendance_pct   = (present + late) / all_marks * 100
homework_pct     = (submitted + marked) / all_homework * 100
prediction       = last_score + slope * fortnights_to_exam
slope            = OLS on last N (score ~ index)
```

## At-risk rules

| Code | Condition | Default methodology |
|---|---|---|
| attendance | < 80% | Re-contract the slot; 24h WhatsApp reminder |
| idle | ≥ 14 days since last session | Parent conference this week |
| hours | bank < 2 | Send renewal invoice now |
| homework | < 60% | Switch to 5-card daily retrieval |
| slope | last 3 scores declining | Stop new topics; worked → faded → independent |
| mastery | > 40% of topics < 50% | Rebuild curriculum around red cells |

## Seeded methodologies

1. Worked example → faded example → independent
2. Spaced retrieval (SM-2)
3. Exam-technique drills
4. CRA (Concrete–Representational–Abstract)

Add your own on the Methodologies page and attach one to each engagement.
