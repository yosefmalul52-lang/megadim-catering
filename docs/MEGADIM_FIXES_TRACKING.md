# Megadim fixes — characterization + tracking

## Decisions
- **#1 emails:** Already handled earlier. Skipped in this pass.
- **#9 «הקיצר»:** Best match = **הקצאה** (prep-day). Covered under #6.
- **Wave order:** A → B → C → E (skip D). Stage-1 for #10 = unit price edit.

## Wave status
| Wave | Items | Status |
|------|-------|--------|
| **A** | #5 qty print/view, #6 prep qty, #7 inactive products | Events: manager quantity **text** → qty column; numeric qty hidden in edit; blank kitchen notes for handwriting on print |
| **B** | #4 + #10 line unit price (incl. 0₪) via `priceSource: admin` | Done |
| **C** | #8 + #11 coupons phone preview, Hebrew errors, edit + optional expiry | Done |
| **D** | #1 emails | Skipped (done earlier) |
| **E** | #2 + #3 events catalog CMS (`/admin/events-catalog` + public GET) | Done |
| **F** | #9 | Covered via #6 |

## Product rules locked in
- Coupon min / % base = **food + delivery** (checkout cart total).
- Events CMS is a dedicated catalog (not MenuItem); submit path still `POST /catering/events`.
- Captured payment totals remain locked; authorized still recalculates.
