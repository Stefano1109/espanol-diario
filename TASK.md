# Spanish course — block-writing task (for Codex)

You are writing course content for a self-built iPhone Spanish study app (1000 days). Days 1–330 are finished.
Your job: write the remaining blocks **h23–h67** as Python files in `blocks/`, one file per block, each passing `validate.py`.

## Learner
Native Chinese speaker who learns Spanish **through English**. Every explanation exists in Simplified Chinese AND English.
Spanish is Latin American (Mexico): carro, celular, computadora, departamento, ustedes (no vosotros except where the grammar focus is regional variation).
Audio is synthesized with one Mexican female voice ("f") and one Mexican male voice ("m").

## Files in this folder
- `base2.py` — helper functions `W, P, S, Q, L, listen, speak`; read the docstrings, they explain every argument (positional, correct option FIRST).
- `example.py` — a complete listen+speak pair in the exact style to copy (level A1; scale difficulty up to each block's level).
- `syllabus.json` — every block: `h`, `level`, `grammar` (Chinese), `domains` (Chinese), `days`, `lines` (dialogue length range).
- `used_words.txt` — 1039 headwords already taught (days 1–330). Never reuse them.
- `validate.py` — `python validate.py blocks/hNN.py` prints OK (and writes `blocks/hNN.done`) or lists problems. It also rejects words used by other finished blocks.
- `blocks/` — output. h23, h24, h26, h28, h31 are **partial drafts** from an earlier writer: keep their good days, replace any word the validator rejects, and add the missing days.

## Block file format
```python
import sys; import os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base2 import W, P, S, Q, L, listen, speak
DAYS = [ listen(FIRST_DAY, ...), speak(FIRST_DAY+1, ...), ... ]   # exactly the block's days, in order
```
Each block has 14 days = 7 listen/speak pairs (h67 has 8 days = 4 pairs, days 991–998). Choose 7 DIFFERENT specific themes inside the block's domains (one per pair); spread the grammar focus across the pairs and recycle earlier grammar. Use UTF-8 and double-quoted strings (escape inner double quotes). Write long files in several chunks.

## CONTENT RULES
1. Each pair = a listening day and the speaking day right after it, SAME theme (identical theme/themeEn/themeEs strings). The speaking day role-plays the previous day's dialogue: role "A" or "B" must have at least 3 lines there.
2. Every day teaches exactly 5 NEW words (10 per pair), useful for the theme and right for the block's level: frequent, practical vocabulary (nouns with el/la, verbs, adjectives, adverbs, set phrases). Never reuse a word that appears in used_words.txt and never repeat a word inside your block. At B1 and above prefer words a learner at that level does not know yet.
3. Word cards: pos/posEn like the example ("名词·阴"/"noun·f.", "动词·e→ie"/"verb·e→ie", "动词·反身"/"verb·reflexive"); one natural example sentence (≤18 words) with Chinese and English translation; ONE short tip (Chinese + English) on the word's trickiest point (gender, irregular forms, preposition, false friend, usage).
4. Listening day: 3 sound pairs, 6 listening sentences (≤20 words), one dialogue, 5 comprehension questions.
   - Sound pairs must sound DIFFERENT in Latin American Spanish (never b/v, s/z/c, ll/y, silent h). A levels: r/rr, stress (papa/papá), vowels, d/t, l/r. B1 and up: grammar forms easy to confuse by ear (hablo/habló, compre/compré, cantara/cantará, había/habría).
   - Sentence options and question options: 3 options, CORRECT FIRST, same order in Chinese and English; wrong options plausible (change one key detail: time, person, negation, place, tense).
   - Dialogue: two named people (one voice "f", one "m"; Spanish first names that fit the voice) or a role like 服务员/Waiter; natural, uses the new words and the grammar focus; questions answerable only by listening to it.
5. Speaking day: 4 warm-ups (word or short phrase + pronunciation tip in Chinese and English), 5 read-aloud sentences (≤16 words, use the grammar focus), 2 substitution patterns with ___ (4–6 items total; cue in Chinese + English, full Spanish answer), 4 personal questions with a sample answer, 1 free-talk prompt with a Spanish frame using "…" and 3 checklist items (Chinese + English).
6. Difficulty must feel like the block's level: longer, richer sentences and more natural speech at higher levels, but keep within the word limits above.
7. Correct Spanish spelling, accents and ¿ ¡ punctuation. Natural, idiomatic Chinese and English translations (not word-for-word).
8. No real public figures, brands as plot points, song lyrics or quotes from books; keep politics and religion neutral; nothing sexual, violent or upsetting.

## Workflow per block
1. Write `blocks/hNN.py`.
2. Run `python validate.py blocks/hNN.py`; fix every problem and rerun until it prints OK.
3. Move to the next block. Do not edit base2.py, validate.py, syllabus.json, used_words.txt or other jobs' blocks.

## Blocks
| block | days | level | dialogue lines | grammar focus | theme domains |
|---|---|---|---|---|---|
| h23 | 331–344 | B1 | 8–10 | 虚拟式：怀疑与否定（no creo que、dudo que） | 表达观点、传闻、轻松辩论 |
| h24 | 346–359 | B1 | 8–10 | 无人称表达 + 虚拟式（es importante que…） | 健康习惯、看医生、药店 |
| h25 | 361–374 | B1 | 8–10 | 过去完成时（había hecho） | 丢东西、误会、警察局报失（轻松话题） |
| h26 | 376–389 | B1 | 8–10 | se 表示意外（se me olvidó、se me cayó） | 日常小麻烦、电子设备故障、修理 |
| h27 | 391–404 | B1 | 8–10 | 命令式 + 代词（dímelo、no lo hagas） | 技术支持、健身教练、高级做饭 |
| h28 | 406–419 | B1 | 8–10 | 将来时与条件式表推测（serán las ocho） | 猜测与推理、悬疑小事、找东西 |
| h29 | 421–434 | B1+ | 8–11 | 形容词从句中的虚拟式（busco un piso que tenga…） | 找房子、找室友、招聘广告 |
| h30 | 436–449 | B1+ | 8–11 | 状语从句中的虚拟式（cuando、antes de que、para que） | 工作流程、项目计划、搬家 |
| h31 | 451–464 | B1+ | 8–11 | 虚拟式过去时（入门：quería que fueras） | 过去的建议与期待、遗憾 |
| h32 | 466–479 | B2 | 9–12 | si 条件句（第二类：si tuviera…） | 梦想、中彩票、假如生活 |
| h33 | 481–494 | B2 | 9–12 | 间接引语（dijo que…、me preguntó si…） | 转述消息、职场沟通、八卦 |
| h34 | 496–509 | B2 | 9–12 | 被动语态（ser + 过去分词、被动 se） | 历史与发明、生产过程、城市历史 |
| h35 | 511–524 | B2 | 9–12 | 虚拟式现在完成时（me alegra que hayas…） | 考试与教育、成就、毕业 |
| h36 | 526–539 | B2 | 9–12 | 连接词（sin embargo、aunque、por lo tanto、además） | 环境与气候、回收、节能 |
| h37 | 541–554 | B2 | 9–12 | 将来完成时与条件完成时 | 职业发展、错过的机会、计划回顾 |
| h38 | 556–569 | B2 | 9–12 | si 条件句（第三类：si hubiera…） | 后悔、人生选择、另一种可能 |
| h39 | 571–584 | B2 | 9–12 | 变化动词（ponerse、volverse、hacerse、quedarse） | 情绪、性格、人生变化 |
| h40 | 586–599 | B2 | 9–12 | ser/estar + 形容词意义变化（ser listo / estar listo） | 艺术、音乐、文化活动 |
| h41 | 601–614 | B2 | 9–12 | 身体部位相关习语（tomar el pelo、costar un ojo de la cara） | 朋友间口语、日常俚语 |
| h42 | 616–629 | B2 | 9–12 | 动词短语（acabar de、volver a、llevar + 副动词、dejar de） | 习惯与改变、运动与比赛 |
| h43 | 631–644 | B2 | 9–12 | 带介词的动词（pensar en、soñar con、depender de） | 爱情与友情、人际关系 |
| h44 | 646–659 | B2 | 9–12 | como si + 虚拟式过去时 | 电影与电视剧、讲故事 |
| h45 | 661–674 | B2 | 9–12 | 正式书信与邮件语域 | 工作邮件、求职申请、面试 |
| h46 | 676–689 | B2 | 9–12 | 数字、统计与百分比的表达 | 经济与物价、个人理财、通货膨胀 |
| h47 | 691–704 | B2 | 9–12 | 指小词/指大词与地区差异（vos、vosotros） | 拉美与西班牙的差异、在墨西哥/阿根廷旅行 |
| h48 | 706–719 | B2 | 9–12 | 口语话语标记（o sea、bueno、pues、es que、vamos） | 闲聊、电话礼仪、打断与回应 |
| h49 | 721–734 | B2+ | 9–12 | 让步从句（aunque + 虚拟式/陈述式） | 社会议题、志愿服务、社区活动 |
| h50 | 736–749 | B2+ | 9–12 | 名词化与 lo + 形容词（lo bueno es que…） | 科技与人工智能、数字生活 |
| h51 | 751–764 | B2+ | 9–12 | 无人称 se 与 uno | 各国习俗与礼仪、文化冲击 |
| h52 | 766–779 | C1 | 10–12 | 介词 + 关系词（el cual、lo que、cuyo） | 科学研究、大学生活、实验室 |
| h53 | 781–794 | C1 | 10–12 | 混合条件句与 de + 原形表假设 | 城市公共事务、社区治理（保持中立） |
| h54 | 796–809 | C1 | 10–12 | 委婉语与缓和语气 | 医疗体系、保险、办手续 |
| h55 | 811–824 | C1 | 10–12 | 常用搭配（tomar una decisión、llevar a cabo） | 新闻与媒体、看懂新闻标题 |
| h56 | 826–839 | C1 | 10–12 | 习语与谚语（refranes） | 饮食文化、地方美食、餐桌礼仪 |
| h57 | 841–854 | C1 | 10–12 | 论证结构（en primer lugar、cabe destacar、en definitiva） | 远程办公、工作与生活平衡 |
| h58 | 856–869 | C1 | 10–12 | 正式与口语语域转换 | 谈判、客户服务、投诉处理 |
| h59 | 871–884 | C1 | 10–12 | 英语母语者易混的假朋友词（embarazada、éxito、realizar） | 商务会议、跨国团队 |
| h60 | 886–899 | C1 | 10–12 | 正式书面中的被动与无人称结构 | 租房合同、消费者权益、基础法律 |
| h61 | 901–914 | C1 | 10–12 | 长篇叙事中的时态综合运用 | 神话与传说、旅行回忆录 |
| h62 | 916–929 | C1 | 10–12 | 幽默、反讽与语气 | 社交聚会、误会与笑话 |
| h63 | 931–944 | C1 | 10–12 | 高级虚拟式（por más que、a no ser que、siempre que） | 城市规划、交通、住房市场 |
| h64 | 946–959 | C1 | 10–12 | 构词法（前缀与后缀） | 创新、创业、产品发布 |
| h65 | 961–974 | C1 | 10–12 | 学术报告与公开演讲用语 | 科技与工程报告、能源与储能、学术会议 |
| h66 | 976–989 | C1 | 10–12 | 综合复习：所有时态与语气 | 人生目标、长途旅行规划、自我反思 |
| h67 | 991–998 | C1 | 10–12 | 毕业综合：叙事、论证与正式表达 | 讲述你的人生故事、完整的求职面试、辩论、告别与未来 |
