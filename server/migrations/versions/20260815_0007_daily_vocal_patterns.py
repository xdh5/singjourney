"""Replace the practice catalog with thirty accurately grouped daily vocal patterns."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0007"
down_revision = "20260815_0006"
branch_labels = None
depends_on = None


EXERCISES = [
    ("natural-lip-trill-five", "natural", "五音阶唇颤音", "Five-note Lip Trill", "保持嘴唇放松，用均匀气流完成五音上下行，不要用力顶高音。", "Keep the lips loose and use even airflow through the five-note pattern without pushing the top.", "1–2–3–4–5–4–3–2–1", "Brrr", 72, 4, "light", False),
    ("natural-tongue-trill-five", "natural", "五音阶舌颤音", "Five-note Tongue Trill", "用连续舌颤音完成五音上下行，保持下巴和舌根放松。", "Use a continuous tongue trill through the five-note pattern while keeping the jaw and tongue root easy.", "1–2–3–4–5–4–3–2–1", "Rrrr", 72, 4, "light", False),
    ("natural-hum-five", "natural", "五音阶哼鸣", "Five-note Hum", "以自然说话音量轻声哼鸣，感受唇前振动，不要挤压喉咙。", "Hum at an easy speaking volume, noticing vibration near the lips without squeezing the throat.", "1–2–3–4–5–4–3–2–1", "Mmm", 68, 4, "light", False),
    ("natural-ng-octave-glide", "natural", "NG八度滑音", "NG Octave Glide", "用NG从低音平滑滑向八度再返回，声音轻巧连贯。", "Glide on NG to the octave and back with a light, continuous sound.", "1–8–1", "Ng", 66, 4, "light", False),
    ("natural-v-five", "natural", "V音五音阶", "V Five-note Scale", "让上齿轻触下唇，以连续V音建立稳定气流和轻松发声。", "Let the upper teeth touch the lower lip lightly and sustain V through the scale for steady airflow.", "1–2–3–4–5–4–3–2–1", "Vvv", 70, 4, "light", False),
    ("natural-vowel-five", "natural", "五元音五音阶", "Five-vowel Scale", "保持同一轻松音色依次练习五个元音，避免换元音时抬下巴。", "Keep one easy tone through the vowel sequence and avoid lifting the chin as vowels change.", "1–2–3–4–5–4–3–2–1", "Ma·Me·Mi·Mo·Mu", 72, 4, "light", False),

    ("connection-gug-five", "connection", "Gug五音阶闭合", "Gug Five-note Closure", "用清晰但不过重的G起音完成五音阶，保持每个音稳定连接。", "Use a clear but moderate G onset through the five-note scale while keeping each pitch connected.", "1–2–3–4–5–4–3–2–1", "Gug", 76, 5, "medium", False),
    ("mix-gee-staccato-arpeggio", "connection", "Gee断奏琶音", "Gee Staccato Arpeggio", "用轻巧短促的Gee完成琶音，训练清晰起音，不要撞击声带。", "Use light, short Gee syllables on the arpeggio for clean onsets without striking the folds.", "1·3·5·8·5·3·1", "Gee", 84, 4, "focused", False),
    ("closure-buh-repeat", "connection", "Buh重复音闭合", "Buh Repeated-note Closure", "用接近说话的Buh完成重复音，声音集中但不憋气。", "Use a speech-like Buh on repeated notes, keeping the tone focused without holding the breath.", "1·1·1–3·3·3–5·5·5–3–1", "Buh", 72, 4, "medium", False),
    ("closure-vee-fifth", "connection", "Vee五度闭合", "Vee Fifth Closure", "先保持V的连续气流，再自然进入元音，避免突然加压。", "Keep airflow continuous on V before releasing into the vowel without a sudden pressure increase.", "1–5·5·5–1", "Vee", 68, 4, "light", False),
    ("closure-mum-triad-repeat", "connection", "Mum三和弦闭合", "Mum Triad Closure", "用自然说话感唱Mum，在顶音重复时保持轻松和稳定。", "Sing Mum with a natural speech quality and stay easy and stable on the repeated top note.", "1–3–5·5·5–3–1", "Mum", 72, 4, "medium", False),
    ("closure-gug-octave", "connection", "Gug八度闭合", "Gug Octave Closure", "用适中的G起音完成八度琶音，高音保持轻巧，不要增加喉部压力。", "Use a moderate G onset through the octave arpeggio, keeping the top light without added throat pressure.", "1–3–5–8–5–3–1", "Gug", 76, 4, "medium", False),

    ("connection-mum-octave", "passaggio", "Mum八度连接", "Mum Octave Connection", "用接近自然说话的Mum完成八度琶音，在上下声区之间保持连续。", "Use a speech-like Mum over the octave arpeggio while keeping the lower and upper registers connected.", "1–3–5–8·8·8·8–5–3–1", "Mum", 70, 4, "light", True),
    ("passaggio-gee-long-scale", "passaggio", "Gee长音阶连接", "Gee Long-scale Connection", "用轻巧Gee通过长音阶，经过换声区时保持音量均匀。", "Carry a light Gee through the long scale with even volume across the register transition.", "1–2–…–10–…–1", "Gee", 80, 3, "medium", False),
    ("register-woo-octave-glide", "passaggio", "Woo八度滑音", "Woo Octave Glide", "用窄而轻的Woo滑过八度，让声区变化连续而不过度放大音量。", "Glide through the octave on a narrow, light Woo without increasing volume through the transition.", "1–8–1", "Woo", 66, 4, "light", False),
    ("register-ng-ah-octave", "passaggio", "NG转Ah八度", "NG-to-Ah Octave", "先用NG建立轻松连接，再打开到Ah，保持音高和共鸣位置稳定。", "Establish an easy connection on NG, then open to Ah without losing pitch or resonance balance.", "1–3–5–8–5–3–1", "Ng–Ah", 70, 4, "medium", False),
    ("register-mum-fifth-octave", "passaggio", "Mum五度转八度", "Mum Fifth-to-Octave", "从五度到八度逐步连接，不要在八度处突然加重。", "Connect the fifth to the octave gradually without adding sudden weight at the top.", "1–5–8–5–1", "Mum", 72, 4, "medium", False),
    ("register-noo-descending-octave", "passaggio", "Noo八度下行", "Noo Descending Octave", "从较高音区轻声下行，保持Noo集中并避免低音变得过重。", "Descend lightly on a focused Noo and avoid adding excess weight in the lower notes.", "8–7–6–5–4–3–2–1", "Noo", 74, 4, "light", False),

    ("range-lip-trill-twelfth", "range", "十二度唇颤音", "Twelfth Lip Trill", "用唇颤音跨越十二度，在低负担状态下逐步扩展舒适音域。", "Cross a twelfth on a lip trill to expand comfortable range with relatively low load.", "1–3–5–8–10–12–10–8–5–3–1", "Brrr", 72, 3, "medium", False),
    ("range-noo-octave-scale", "range", "Noo八度音阶", "Noo Octave Scale", "用集中的Noo完成完整八度上下行，保持音准和声区连续。", "Use a focused Noo over the full octave scale while maintaining pitch and register continuity.", "1–2–3–4–5–6–7–8–7–6–5–4–3–2–1", "Noo", 78, 4, "medium", False),
    ("range-twelfth-arpeggio", "range", "十二度琶音", "Twelfth Arpeggio", "逐级跨越八度加五度，音域边缘只保持舒适音量，不追求响度。", "Cross an octave plus a fifth gradually, using only a comfortable volume near range limits.", "1–3–5–8–10–12–10–8–5–3–1", "Ya", 76, 3, "medium", False),
    ("range-two-octave-descending", "range", "两八度下行", "Two-octave Descent", "从高处轻声下行两个八度，只在舒适音域内练习，不压低音。", "Descend lightly through two octaves only within a comfortable range and do not press the low notes.", "15–14–13–…–3–2–1", "Oo", 72, 3, "focused", False),
    ("range-thirds-ladder", "range", "三度模进", "Thirds Ladder", "用连续三度模进扩展音程控制，保持每个跳进清晰而轻松。", "Use a connected ladder of thirds to develop interval control with clear, easy leaps.", "1–3–2–4–3–5–4–6–5–7–6–8", "Ah", 76, 3, "medium", False),
    ("range-chromatic-five", "range", "半音阶拓展", "Chromatic Range Builder", "以小范围半音上下行稳定音准，再逐步移调扩展，不要急于升高。", "Stabilize pitch on a small chromatic pattern before transposing gradually without rushing upward.", "1–♯1–2–♯2–3–♯2–2–♯1–1", "Noo", 66, 4, "medium", False),

    ("mix-nay-five", "mix", "Nay五音阶混声", "Nay Five-note Mix", "用明亮但不过度的Nay完成五音阶，平衡说话感与头声参与。", "Use a bright but moderate Nay over the five-note scale to balance speech quality with head participation.", "1–2–3–4–5–4–3–2–1", "Nay", 82, 5, "medium", False),
    ("mix-mum-octave-repeat", "mix", "Mum八度混声", "Mum Octave Mix", "在八度顶音重复Mum，保持自然集中，避免把胸声重量直接推高。", "Repeat Mum at the octave with an easy focus rather than pushing chest weight upward.", "1–3–5–8·8·8–5–3–1", "Mum", 76, 4, "focused", False),
    ("passaggio-nay-octave", "mix", "Nay八度混声", "Nay Octave Mix", "用适度明亮的Nay完成八度琶音，高音保持轻巧和集中。", "Use a moderately bright Nay over the octave arpeggio while keeping the top light and focused.", "1–3–5–8–5–3–1", "Nay", 76, 4, "medium", False),
    ("mix-no-octave", "mix", "No八度混声", "No Octave Mix", "用接近说话的No连接八度，元音保持集中但不要压暗。", "Connect the octave with a speech-like No, keeping the vowel focused without artificially darkening it.", "1–3–5–8–5–3–1", "No", 78, 4, "medium", False),
    ("mix-yeah-five", "mix", "Yeah五音阶混声", "Yeah Five-note Mix", "用自然呼喊感的轻量Yeah完成五音阶，避免大音量和喉部挤压。", "Use a light, speech-like Yeah over the five-note scale without excess volume or throat squeeze.", "1–2–3–4–5–4–3–2–1", "Yeah", 80, 4, "medium", False),
    ("mix-mum-tenth", "mix", "Mum十度混声", "Mum Tenth Mix", "用Mum逐步到达十度，保持上下声区统一，音域边缘不要硬撑。", "Carry Mum gradually to the tenth while keeping registers unified and never forcing the range edge.", "1–3–5–8–10–8–5–3–1", "Mum", 76, 3, "focused", False),
]


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE practice_categories SET name_zh_hans = :name, name_en = :name_en WHERE key = :key"), [
        {"key": "natural", "name": "基础发声", "name_en": "Fundamentals"},
        {"key": "connection", "name": "声带闭合", "name_en": "Vocal Fold Closure"},
        {"key": "passaggio", "name": "声区连接", "name_en": "Register Connection"},
        {"key": "range", "name": "音域拓展", "name_en": "Range Extension"},
        {"key": "mix", "name": "混声强化", "name_en": "Mixed Voice"},
    ])
    rows = [
        {
            "id": row[0], "category_key": row[1], "title_zh_hans": row[2], "title_en": row[3],
            "tip_zh_hans": row[4], "tip_en": row[5], "pattern": row[6],
            "recommended_syllables": row[7], "tempo": row[8], "repetitions": row[9],
            "intensity": row[10], "enabled": True, "sort_order": index * 10,
        }
        for index, row in enumerate(EXERCISES, start=1)
    ]
    update_statement = sa.text("""
        UPDATE practice_exercises
        SET category_key = :category_key,
            title_zh_hans = :title_zh_hans,
            title_en = :title_en,
            tip_zh_hans = :tip_zh_hans,
            tip_en = :tip_en,
            pattern = :pattern,
            recommended_syllables = :recommended_syllables,
            tempo = :tempo,
            repetitions = :repetitions,
            intensity = :intensity,
            enabled = :enabled,
            sort_order = :sort_order
        WHERE id = :id
    """)
    insert_statement = sa.text("""
        INSERT INTO practice_exercises (
            id, category_key, title_zh_hans, title_en, tip_zh_hans, tip_en,
            pattern, recommended_syllables, tempo, repetitions, intensity, enabled, sort_order
        ) VALUES (
            :id, :category_key, :title_zh_hans, :title_en, :tip_zh_hans, :tip_en,
            :pattern, :recommended_syllables, :tempo, :repetitions, :intensity, :enabled, :sort_order
        )
    """)
    for row in rows:
        result = bind.execute(update_statement, row)
        if result.rowcount == 0:
            bind.execute(insert_statement, row)
    bind.execute(sa.text(
        "DELETE FROM practice_exercises WHERE id = 'natural-lip-trill-octave'"
    ))


def downgrade() -> None:
    pass
