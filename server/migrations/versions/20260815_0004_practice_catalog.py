"""Store the guided-practice catalog in the database."""

import sqlalchemy as sa
from alembic import op


revision = "20260815_0004"
down_revision = "20260722_0003"
branch_labels = None
depends_on = None


CATEGORIES = [
    {"key": "natural", "name_zh_hans": "基础发声", "name_en": "Fundamentals", "sort_order": 10, "active": True},
    {"key": "connection", "name_zh_hans": "声带闭合", "name_en": "Vocal Fold Closure", "sort_order": 20, "active": True},
    {"key": "passaggio", "name_zh_hans": "声区连接", "name_en": "Register Connection", "sort_order": 30, "active": True},
    {"key": "range", "name_zh_hans": "音域拓展", "name_en": "Range Extension", "sort_order": 40, "active": True},
    {"key": "mix", "name_zh_hans": "混声强化", "name_en": "Mixed Voice", "sort_order": 50, "active": True},
]

EXERCISES = [
    ("natural-lip-trill-octave", "natural", "八度唇颤音", "Octave Lip Trill", "用轻松的唇颤音完成八度琶音，建立稳定气流和自然发声状态。", "Use an easy lip trill over an octave arpeggio to organize airflow and find a natural vocal setup.", "1–3–5–8–5–3–1", "Brrr", 68, 4, "light", False),
    ("natural-tongue-trill-five", "natural", "舌颤音五音阶", "Tongue-trill Five-note Scale", "用连续舌颤音完成五音上下行，在不挤压喉咙的前提下保持声音连贯。", "Use a continuous tongue trill over a five-note scale while keeping the throat free and pitch changes connected.", "1–2–3–4–5–4–3–2–1", "Rrr", 72, 4, "light", False),
    ("connection-mum-octave", "connection", "Mum 八度连接", "Mum Octave Connection", "用接近自然说话的 Mum 完成八度琶音，在上下声区之间保持连续。", "Use a speech-like Mum over an octave arpeggio while keeping the lower and upper registers connected.", "1–3–5–8–8–8–8–5–3–1", "Mum", 70, 13, "light", True),
    ("connection-gug-five", "connection", "Gug 五音连接", "Gug Five-note Connection", "利用清楚的 G 起音完成五音上下行，训练每个音都保持稳定连接。", "Use a clear G onset on a five-note scale to keep each pitch steadily connected.", "1–2–3–4–5–4–3–2–1", "Gug", 76, 5, "medium", False),
    ("passaggio-gee-long-scale", "passaggio", "Gee 长音阶过渡", "Gee Long-scale Transition", "用 Gee 跨越较长音阶，让声音经过换声区时仍保持轻巧、连续。", "Carry Gee through a long scale while staying light and connected across the passaggio.", "1–2–3–4–5–6–7–8–9–10–11–12–13–12…–1", "Gee", 80, 3, "medium", False),
    ("passaggio-nay-octave", "passaggio", "Nay 八度过渡", "Nay Octave Transition", "用略带明亮说话感的 Nay 完成八度琶音，寻找换声区两侧的连续感。", "Use a moderately bright, speech-like Nay over an octave arpeggio to connect both sides of the passaggio.", "1–3–5–8–8–8–8–5–3–1", "Nay", 76, 4, "medium", False),
    ("range-lip-trill-twelfth", "range", "十二度唇颤音", "Twelfth Lip Trill", "在唇颤音中跨越一个八度加五度，以较低负担逐步扩大舒适音域。", "Cross an octave plus a fifth on a lip trill to expand comfortable range with relatively low load.", "1–3–5–8–10–12–10–8–5–3–1", "Brrr", 72, 3, "medium", False),
    ("range-noo-octave-scale", "range", "Noo 八度音阶", "Noo Octave Scale", "用较窄的 Noo 完成完整八度上下行，保持长音型中的音高和声区连续。", "Use a narrow Noo over a full octave scale to keep pitch and register continuity through a longer pattern.", "1–2–3–4–5–6–7–8–7–6–5–4–3–2–1", "Noo", 78, 4, "medium", False),
    ("mix-nay-five", "mix", "Nay 五音混声", "Nay Five-note Mix", "用明亮但不过度的 Nay 完成五音上下行，稳定说话感与头声参与的平衡。", "Use a bright but moderate Nay over a five-note scale to balance speech-like clarity with head participation.", "1–2–3–4–5–4–3–2–1", "Nay", 82, 5, "medium", False),
    ("mix-mum-octave-repeat", "mix", "Mum 八度强化", "Mum Octave Builder", "在八度顶音重复 Mum，训练升高后仍能维持自然、连贯的发声状态。", "Repeat Mum at the octave to keep a natural, connected setup after ascending.", "1–3–5–8–8–8–8–5–3–1", "Mum", 76, 4, "focused", False),
    ("mix-gee-staccato-arpeggio", "mix", "Gee 断奏琶音", "Gee Staccato Arpeggio", "用轻巧的 Gee 完成八度断奏琶音，强化混声区的快速起音与音程定位。", "Use light Gee syllables on a staccato octave arpeggio to build quick onsets and interval accuracy in mix range.", "1·3·5·8·5·3·1", "Gee", 84, 4, "focused", False),
]


def upgrade() -> None:
    categories = op.create_table(
        "practice_categories",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("name_zh_hans", sa.String(40), nullable=False),
        sa.Column("name_en", sa.String(80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_practice_categories_sort_order", "practice_categories", ["sort_order"])
    op.create_index("ix_practice_categories_active", "practice_categories", ["active"])
    exercises = op.create_table(
        "practice_exercises",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("category_key", sa.String(40), sa.ForeignKey("practice_categories.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("title_zh_hans", sa.String(120), nullable=False),
        sa.Column("title_en", sa.String(160), nullable=False),
        sa.Column("tip_zh_hans", sa.Text(), nullable=False),
        sa.Column("tip_en", sa.Text(), nullable=False),
        sa.Column("pattern", sa.String(120), nullable=False),
        sa.Column("recommended_syllables", sa.String(80), nullable=False),
        sa.Column("tempo", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("intensity", sa.String(24), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
    )
    op.create_index("ix_practice_exercises_category_key", "practice_exercises", ["category_key"])
    op.create_index("ix_practice_exercises_enabled", "practice_exercises", ["enabled"])
    op.create_index("ix_practice_exercises_sort_order", "practice_exercises", ["sort_order"])
    op.create_index("ix_practice_exercises_category_order", "practice_exercises", ["category_key", "sort_order"])
    op.bulk_insert(categories, CATEGORIES)
    op.bulk_insert(exercises, [
        {"id": row[0], "category_key": row[1], "title_zh_hans": row[2], "title_en": row[3], "tip_zh_hans": row[4], "tip_en": row[5], "pattern": row[6], "recommended_syllables": row[7], "tempo": row[8], "repetitions": row[9], "intensity": row[10], "enabled": row[11], "sort_order": index * 10}
        for index, row in enumerate(EXERCISES, start=1)
    ])


def downgrade() -> None:
    op.drop_table("practice_exercises")
    op.drop_table("practice_categories")
