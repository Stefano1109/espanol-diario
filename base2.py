"""Bilingual (Chinese + English) helpers for writing course days.

Every helper takes positional arguments in the order shown. Write the CORRECT
option first in every option list; the app shuffles options at runtime.
"""


def W(w, pos, posEn, zh, en, ex, exZh, exEn, note, noteEn):
    """A vocabulary card.
    w      Spanish headword (nouns WITH article: "la ciudad", "el agua")
    pos    part of speech in Chinese, parts joined by "·": "名词·阴", "动词·反身·e→ie", "形容词", "副词", "短语"
    posEn  the same in English: "noun·f.", "verb·reflexive·e→ie", "adj.", "adv.", "phrase"
    zh/en  meaning (1–2 senses)
    ex     Spanish example sentence using the word; exZh / exEn its translations
    note   ONE short grammar/usage tip in Chinese; noteEn the same tip in English
    """
    return dict(w=w, pos=pos, posEn=posEn, zh=zh, en=en, ex=ex, exZh=exZh, exEn=exEn, note=note, noteEn=noteEn)


def P(a, az, azEn, b, bz, bzEn):
    """A sound pair the learner must tell apart by ear: Spanish a / b with Chinese and English glosses."""
    return dict(a=a, az=az, azEn=azEn, b=b, bz=bz, bzEn=bzEn)


def S(es, optsZh, optsEn):
    """Listening sentence: Spanish sentence + 3 meanings in Chinese and 3 in English (correct one FIRST, same order in both)."""
    return dict(es=es, opts=list(optsZh), optsEn=list(optsEn))


def Q(qZh, qEn, optsZh, optsEn):
    """Dialogue comprehension question with 3 options (correct FIRST), Chinese + English."""
    return dict(q=qZh, qEn=qEn, opts=list(optsZh), optsEn=list(optsEn))


def L(s, es, zh, en):
    """One dialogue line. s = "A" or "B"."""
    return dict(s=s, es=es, zh=zh, en=en)


def listen(day, theme, themeEn, themeEs, grammar, grammarEn, words, pairs, sentences,
           title, titleEn, A, B, lines, qs):
    """Listening day.
    A, B = (name, nameEn, voice) where voice is "f" (female) or "m" (male); one speaker of each voice.
    """
    return {"day": day, "type": "listen", "theme": theme, "themeEn": themeEn, "themeEs": themeEs,
            "grammar": grammar, "grammarEn": grammarEn, "words": words, "pairs": pairs, "sentences": sentences,
            "dialogue": {"title": title, "titleEn": titleEn,
                         "A": {"name": A[0], "nameEn": A[1], "voice": A[2]},
                         "B": {"name": B[0], "nameEn": B[1], "voice": B[2]},
                         "lines": lines, "qs": qs}}


def speak(day, theme, themeEn, themeEs, grammar, grammarEn, words, warmup, shadow, role, subs, questions, free):
    """Speaking day (same theme as the listening day before it).
    warmup    4 x (spanish word or short phrase, tip in Chinese, tip in English) — pronunciation focus
    shadow    5 x (spanish sentence, Chinese, English) — read-aloud, scored
    role      "A" or "B": which speaker of YESTERDAY's dialogue the learner plays
    subs      2 x (pattern with ___, [(cue Chinese, cue English, full spanish sentence), ...]) — 4–6 items in total
    questions 4 x (spanish question, Chinese, English, spanish sample answer)
    free      (prompt Chinese, prompt English, spanish frame with "…", [3 checklist items Chinese], [3 checklist items English])
    """
    return {"day": day, "type": "speak", "theme": theme, "themeEn": themeEn, "themeEs": themeEs,
            "grammar": grammar, "grammarEn": grammarEn, "words": words,
            "warmup": [{"es": e, "tip": t, "tipEn": te} for e, t, te in warmup],
            "shadow": [{"es": e, "zh": z, "en": en} for e, z, en in shadow],
            "roleplay": {"fromDay": day - 1, "role": role},
            "subs": [{"pattern": p, "items": [{"cue": c, "cueEn": ce, "es": e} for c, ce, e in items]} for p, items in subs],
            "questions": [{"es": q, "zh": z, "en": en, "sample": s} for q, z, en, s in questions],
            "free": {"prompt": free[0], "promptEn": free[1], "frame": free[2], "checklist": list(free[3]), "checklistEn": list(free[4])}}
