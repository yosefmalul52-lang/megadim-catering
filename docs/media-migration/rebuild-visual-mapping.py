#!/usr/bin/env python3
"""Rebuild mapping-file.json from visual analyses. Does not touch source images or MongoDB."""
import json
from pathlib import Path
from datetime import datetime

OUT = Path('/Users/yosefmalul/Desktop/Megadim-P/docs/media-migration')
ents = json.loads((OUT / 'entities-export.json').read_text(encoding='utf-8'))
inv = json.loads((OUT / 'source-inventory.json').read_text(encoding='utf-8'))
state_path = OUT / 'mapping-state.json'
state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'decisions': {}}
approved = {k: v for k, v in state.get('decisions', {}).items() if v.get('approvalStatus') == 'אושרה'}
by_name = {m['entityName']: m for m in ents['menuItems']}

analyses = {}

def A(rel, desc, matches, conf, unc='', needs=False, none=False, lead=None):
    analyses[rel] = {
        'relativePath': rel,
        'visualDescription': desc,
        'topMatchNames': matches[:3],
        'leadMatch': lead if lead is not None else (matches[0] if matches and not needs and not none else None),
        'confidence': conf,
        'uncertainty': unc,
        'needsReview': needs,
        'noMatch': none,
    }

# --- דגים ---
A('דגים/1.png', 'פילה דג לבן על תבשיל ירקות צהוב עם חומוס ועגבנייה צלויה',
  ['מושט מרוקאי'], 0.72, 'רוטב צהוב ולא חריימה אדומה קלאסית', True, lead=None)
A('דגים/2.png', 'פרוסות סלמון כבוש עם שמיר',
  ['גרבלקס שמיר ביתי', 'סלונה', 'גרבלקס סלק ביתי'], 0.7, 'אין סלק; דומה ל־3.png', True, lead=None)
A('דגים/3.png', 'פרוסות סלמון כבוש עם שמן עשבים, קפרים ולחם',
  ['גרבלקס שמיר ביתי', 'סלונה', 'גרבלקס סלק ביתי'], 0.68, 'דומה מאוד ל־2.png', True, lead=None)
A('דגים/4.png', 'דג לבן ברוטב עגבניות אדום עם שום וצ׳ילי (תג׳ין)',
  ['מושט מרוקאי'], 0.9)
A('דגים/5.png', 'סלמון עם ציפוי עשבי תיבול ירוק ולימון',
  ['סלמון בעשבי תיבול'], 0.93)
A('דגים/6.png', 'סלמון ברוטב טריאקי עם שומשום ובצל ירוק',
  ['סלמון ברוטב טריאקי'], 0.95)
A('דגים/7.png', 'סלמון ברוטב חרדל גרגירים עם שמיר',
  ['סלמון ברוטב חרדל ודבש'], 0.94)

# --- ממולאים ---
A('ממולאים/1.png', 'פלפלים אדומים ממולאים בשר ברוטב עגבניות',
  ['פלפל ממולא בשר ואורז', 'פלפל ממולא אורז'], 0.75, 'לא ברור אם יש אורז', True, lead=None)
A('ממולאים/2.png', 'בצלים ממולאים מקרמלים ברוטב עגבניות',
  ['בצל ממולא בשר ואורז', 'בצל ממולא אורז'], 0.7, 'לא ניתן לקבוע בשר מול אורז', True, lead=None)
A('ממולאים/3.png', 'תחתיות ארטישוק ממולאות בשר עם אפונה',
  ['תחתיות ארטישוק במילוי בשר'], 0.95)
A('ממולאים/4.png', 'גלילות חציל ברוטב עגבניות',
  ['מוסקה - גלילות חצילים'], 0.94)
A('ממולאים/5.png', 'פלפלים אדום/ירוק ממולאים אורז ובשר',
  ['פלפל ממולא בשר ואורז', 'פלפל ממולא אורז'], 0.88)
A('ממולאים/6.png', 'פרגיות ברוטב כהה — לא נראה ממולא',
  ['פרגית ברוטב טריאקי', 'פרגית פיקנטית', 'כרעיים עוף בסילאן'], 0.45,
  'נמצא בתיקיית ממולאים אך נראה מנה עיקרית', True, lead=None)

# --- קינוחים ---
A('קינוחים/1.png', 'קרמבל פירות יער עם פירורים',
  ['קרמבל קוקיז'], 0.78, 'אין מוצר קרמבל פירות יער ברשימה', True)
A('קינוחים/1.jpg', 'קרמבל פירות יער (גרסה נוספת/כפולה ל־1.png)',
  ['קרמבל קוקיז'], 0.72, 'כפילות אפשרית עם 1.png', True)
A('קינוחים/2.png', 'מוס שוקולד בכוסית עם פירות יער',
  ['מוס שוקולד', 'קינוחי כוסות'], 0.9)
A('קינוחים/3.png', 'קרם ברולה בצורת לב',
  ['קרם ברולה'], 0.96)
A('קינוחים/4.png', 'עוגת תבנית זהובה שלמה',
  ['עוגת גזר'], 0.8, 'ייתכן עוגה אחרת אך עוגת גזר היחידה מהסוג')
A('קינוחים/5.jpg', 'קינוחי כוסות שכבתיים עם קרם ופירות יער',
  ['קינוחי כוסות', 'מוס שוקולד'], 0.92)
A('קינוחים/6.jpg', 'פרוסות קראנץ שמרים שוקולד',
  ["קראנץ' שמרים שוקולד", "קראנץ' שמרים קינמון"], 0.88)
A('קינוחים/7.jpg', 'קראנץ שמרים קלוע בטבעת',
  ["קראנץ' שמרים קינמון", "קראנץ' שמרים שוקולד"], 0.55, 'קשה להבחין מילוי', True, lead=None)

# --- מנות עיקריות ---
A('מנות עיקריות/1.png', 'קוביות בקר מזוגגות ברוטב כהה',
  ['אסאדו', 'צלי בקר'], 0.86)
A('מנות עיקריות/2.png', 'פרוסות בקר ברוטב עם גזר ובצל',
  ['צלי בקר', 'אסאדו'], 0.9)
A('מנות עיקריות/3.png', 'רצועות שניצל עם שומשום',
  ['שניצלונים', 'שניצל'], 0.88)
A('מנות עיקריות/4.png', 'ערימת שניצלים שטוחים',
  ['שניצל', 'שניצלונים'], 0.93)
A('מנות עיקריות/5.png', 'פרגיות ברוטב כהה עם תיבול',
  ['פרגית ברוטב טריאקי', 'פרגית פיקנטית', 'פרגית בעשבי תיבול'], 0.48,
  'קשה להבחין טריאקי/פיקנטי', True, lead=None)
A('מנות עיקריות/6.png', 'פילה דג — לא ברשימת עיקריות',
  ['מושט מרוקאי'], 0.35, 'מנת דג בתיקיית עיקריות', True, True, lead=None)
A('מנות עיקריות/7.png', 'פרגיות ברוטב עם שומשום ובצל ירוק',
  ['פרגית ברוטב טריאקי', 'פרגית פיקנטית'], 0.84)
A('מנות עיקריות/8.png', 'שווארמה פרוסה עם בצל',
  ['שווארמה הודו'], 0.95)
A('מנות עיקריות/9.png', 'חתיכות עוף עם עשבי תיבול',
  ['פרגית בעשבי תיבול', 'כרעיים עוף בעשבי תיבול', 'פרגית פיקנטית'], 0.55,
  'לא ברור פרגית מול כרעיים', True, lead=None)
A('מנות עיקריות/10.png', 'כרעיים עוף מזוגגות עם פלפל',
  ['כרעיים עוף פיקנטי', 'כרעיים עוף בסילאן', 'כרעיים עוף בעשבי תיבול'], 0.5,
  'סילאן מול פיקנטי לא חד', True, lead=None)
A('מנות עיקריות/11.png', 'כרעיים עוף עם עשבי תיבול',
  ['כרעיים עוף בעשבי תיבול', 'כרעיים עוף בסילאן', 'כרעיים עוף פיקנטי'], 0.65,
  'סוג הרוטב פחות חד', True)

# --- תוספות ---
A('תוספות/1.png', 'משולשי בצק מטוגנים',
  ['פסטלים', 'סיגר בשר'], 0.9)
A('תוספות/2.png', 'אורז לבן',
  ['אורז לבן'], 0.98)
A('תוספות/3.png', 'סירות תפו״א ובטטה',
  ['סירות תפו"א ובטטה', 'תפו"א פריזיאן'], 0.95)
A('תוספות/4.png', 'שניצל חציל',
  ['שניצל חציל'], 0.96)
A('תוספות/5.png', 'שעועית ירוקה מוקפצת',
  ['שעועית ירוקה מוקפצת', 'ירקות מוקפצים'], 0.95)
A('תוספות/6.png', 'אורז קארי עם גזר',
  ['אורז בקארי וירקות', 'אורז לבן'], 0.92)
A('תוספות/7.png', 'תפו״א פריזיאן',
  ['תפו"א פריזיאן', 'סירות תפו"א ובטטה'], 0.96)
A('תוספות/8.png', 'אורז עם שקדים וצימוקים',
  ['אורז פיצוחים', 'אורז לבן'], 0.95)
A('תוספות/9.png', 'סיגרים מטוגנים',
  ['סיגר בשר', 'פסטלים'], 0.93)
A('תוספות/10.png', 'צ׳ולנט עם תפו״א ושעועית',
  ["צ'ולנט בשרי", "צ'ולנט פרווה"], 0.55, 'לא ניתן לקבוע בשרי/פרווה', True, lead=None)
A('תוספות/11.png', 'אנטיפסטי ירקות צלויים',
  ['אנטיפסטי', 'ירקות מוקפצים'], 0.94)
A('תוספות/12.png', 'ירקות מוקפצים מעורבים',
  ['ירקות מוקפצים', 'שעועית ירוקה מוקפצת'], 0.9)
A('תוספות/13.png', 'קוגל אטריות',
  ['קוגל אטריות', 'קוגל תפו"א', "יאפצ'ק"], 0.94)

# --- סלטים ---
salads = json.loads((OUT / 'visual-salads-temp.json').read_text(encoding='utf-8'))
for s in salads:
    needs = bool(s.get('needsReview'))
    none = bool(s.get('noMatch'))
    lead = None if needs or none else s.get('leadMatch')
    A(s['relativePath'], s['visualDescription'], s['topMatches'], s['confidence'],
      s.get('uncertainty') or '', needs, none, lead=lead)

missing = []
for img in inv['images']:
    if img['relativePath'] not in analyses:
        missing.append(img['relativePath'])
print('missing analyses', missing)
print('total analyses', len(analyses))

# Build mappings
img_by_rel = {i['relativePath']: i for i in inv['images']}
mappings = []
for rel, a in sorted(analyses.items()):
    img = img_by_rel[rel]
    # Preserve approved
    if rel in approved:
        prev = approved[rel]
        mappings.append({
            **{k: img.get(k) for k in ('sourceFile','sourceFolder','relativePath','bytes','width','height','detectedMime','sha256')},
            'visualDescription': a['visualDescription'],
            'entityType': prev.get('entityType') or 'menuItem',
            'entityId': prev.get('entityId'),
            'entityName': prev.get('entityName'),
            'categoryId': prev.get('categoryId') or prev.get('categoryName'),
            'categoryName': prev.get('categoryName'),
            'currentImageUrl': prev.get('currentImageUrl') or '',
            'suggestedMatch': prev.get('suggestedMatch'),
            'candidateMatches': prev.get('candidateMatches') or [],
            'confidence': prev.get('confidence', 1),
            'approvalStatus': 'אושרה',
            'approvedAt': prev.get('approvedAt'),
            'notes': prev.get('notes') or '',
            'uncertainty': prev.get('uncertainty') or '',
            'allowSharedImage': prev.get('allowSharedImage', False),
            'lockedManualApproval': True,
        })
        continue

    candidates = []
    for name in a['topMatchNames']:
        ent = by_name.get(name)
        if not ent:
            continue
        candidates.append({
            'entityType': 'menuItem',
            'entityId': ent['entityId'],
            'entityName': ent['entityName'],
            'categoryName': ent['categoryName'],
            'currentImageUrl': ent.get('currentImageUrl') or '',
        })

    lead_name = a.get('leadMatch')
    lead = by_name.get(lead_name) if lead_name else None
    if not lead and candidates and not a['noMatch']:
        # Prefer first candidate as "leading suggestion" even when needs review
        lead = by_name.get(candidates[0]['entityName'])

    conf = a['confidence']
    if a['noMatch']:
        status = 'ללא התאמה'
        lead = None
    elif a['needsReview'] or conf < 0.6:
        status = 'דורשת בדיקה'
    elif conf >= 0.6:
        status = 'התאמה מוצעת'
    else:
        status = 'דורשת בדיקה'

    # confidence band note
    if conf >= 0.8:
        band = 'גבוה'
    elif conf >= 0.6:
        band = 'בינוני'
    else:
        band = 'נמוך'

    notes = [f'ניתוח חזותי · ביטחון {band}']
    if a['uncertainty']:
        notes.append(a['uncertainty'])
    notes.append('לא לפי סדר קובץ')

    mappings.append({
        'sourceFile': img['sourceFile'],
        'sourceFolder': img['sourceFolder'],
        'relativePath': rel,
        'bytes': img['bytes'],
        'width': img['width'],
        'height': img['height'],
        'detectedMime': img.get('detectedMime'),
        'sha256': img['sha256'],
        'visualDescription': a['visualDescription'],
        'entityType': 'menuItem' if lead else None,
        'entityId': lead['entityId'] if lead else None,
        'entityName': lead['entityName'] if lead else None,
        'categoryId': (lead or candidates[0] if candidates else {}).get('categoryName') if (lead or candidates) else img['sourceFolder'],
        'categoryName': (lead['categoryName'] if lead else (candidates[0]['categoryName'] if candidates else img['sourceFolder'])),
        'currentImageUrl': (lead.get('currentImageUrl') if lead else ''),
        'suggestedMatch': ({
            'entityType': 'menuItem',
            'entityId': lead['entityId'],
            'entityName': lead['entityName'],
            'method': 'visual-analysis'
        } if lead else None),
        'candidateMatches': candidates,
        'confidence': conf,
        'confidenceBand': band,
        'approvalStatus': status,
        'approvedAt': None,
        'notes': '; '.join(notes),
        'uncertainty': a['uncertainty'],
        'allowSharedImage': False,
        'lockedManualApproval': False,
    })

# Prefer higher-confidence image when the same product is suggested twice
mappings.sort(key=lambda m: (-(m.get('confidence') or 0), m['relativePath']))
seen_ids = {}
for m in mappings:
    if m.get('lockedManualApproval'):
        eid = m.get('entityId')
        if eid:
            seen_ids[eid] = m['relativePath']
        continue
    eid = m.get('entityId')
    if not eid or m['approvalStatus'] == 'ללא התאמה':
        continue
    if eid in seen_ids:
        m['approvalStatus'] = 'כפולה'
        m['notes'] = (m['notes'] + '; ' if m['notes'] else '') + f"אזהרה: אותו מוצר כבר הוצע ל־{seen_ids[eid]}"
        m['confidence'] = min(m['confidence'], 0.55)
        m['confidenceBand'] = 'נמוך'
    else:
        seen_ids[eid] = m['relativePath']

# restore stable display order later; stats use bands after duplicate demotion
mappings.sort(key=lambda m: m['relativePath'])

assigned = {m['entityId'] for m in mappings if m.get('entityId') and m['approvalStatus'] not in ('ללא התאמה', 'כפולה')}
unmatched = [m for m in ents['menuItems'] if m['categoryName'] != 'archived_holiday' and m['entityId'] not in assigned]

stats = {
    'totalImages': len(mappings),
    'highConfidence': sum(1 for m in mappings if m.get('confidenceBand') == 'גבוה'),
    'mediumConfidence': sum(1 for m in mappings if m.get('confidenceBand') == 'בינוני'),
    'lowConfidence': sum(1 for m in mappings if m.get('confidenceBand') == 'נמוך'),
    'proposed': sum(1 for m in mappings if m['approvalStatus'] == 'התאמה מוצעת'),
    'needsReview': sum(1 for m in mappings if m['approvalStatus'] == 'דורשת בדיקה'),
    'unmatchedImages': sum(1 for m in mappings if m['approvalStatus'] == 'ללא התאמה'),
    'duplicates': sum(1 for m in mappings if m['approvalStatus'] == 'כפולה'),
    'approved': sum(1 for m in mappings if m['approvalStatus'] == 'אושרה'),
    'unmatchedProducts': len(unmatched),
}

payload = {
    'createdAt': datetime.now().isoformat(timespec='seconds'),
    'analysisMethod': 'visual-content-local',
    'sourceRoot': inv['sourceRoot'],
    'qualityPolicy': {
        'uploadMode': 'original-byte-for-byte',
        'noResizeOnOriginal': True,
        'noReencodeOnOriginal': True,
        'primaryDbUrl': 'original-full-resolution',
    },
    'r2PlanDraft': json.loads((OUT / 'mapping-file.json').read_text(encoding='utf-8')).get('r2PlanDraft') if (OUT / 'mapping-file.json').exists() else {},
    'images': inv['images'],
    'mappings': mappings,
    'unmatchedProducts': unmatched,
    'extraEntities': json.loads((OUT / 'mapping-file.json').read_text(encoding='utf-8')).get('extraEntities', {}) if (OUT / 'mapping-file.json').exists() else {},
    'stats': stats,
    'visualAnalyses': analyses,
}

(OUT / 'mapping-file.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / 'visual-analysis.json').write_text(json.dumps(analyses, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(stats, ensure_ascii=False, indent=2))
