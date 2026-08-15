"""Store the bilingual daily-practice messages."""

import sqlalchemy as sa
from alembic import op

from app.modules.practice.models import DailyPracticeMessage


revision = "20260815_0005"
down_revision = "20260720_0001"
branch_labels = None
depends_on = None


MESSAGES = [
    ("每一次开口，都在靠近更好的自己", "Every time you use your voice, you move closer to a better you."),
    ("今天多练一点，明天就会更稳一点", "Practice a little more today, and you will feel steadier tomorrow."),
    ("声音不会骗人，坚持一定留下痕迹", "Your voice tells the truth—consistent practice always leaves a mark."),
    ("别怕唱不好，开口本身就是进步", "Do not fear singing imperfectly; using your voice is progress itself."),
    ("好声音不是天生，是一遍遍练出来", "A great voice is not simply born; it is built one repetition at a time."),
    ("每天进步一点，声音也会慢慢发光", "Improve a little each day, and your voice will gradually shine."),
    ("练声没有白费，每一遍都算成长", "No vocal practice is wasted; every repetition helps you grow."),
    ("先别追求完美，稳定就是一种进步", "Do not chase perfection yet; consistency is progress."),
    ("你今天的坚持，会变成明天的底气", "Today's persistence becomes tomorrow's confidence."),
    ("声音需要时间，也值得你的耐心", "Your voice needs time, and it deserves your patience."),
    ("不用急着惊艳，先让自己越来越稳", "Do not rush to impress; first become steadier every day."),
    ("每一次练习，都在重塑你的声音", "Every practice session is reshaping your voice."),
    ("唱得更好之前，先勇敢地唱出来", "Before you sing better, be brave enough to sing out."),
    ("别小看十分钟，它会悄悄改变声音", "Never underestimate ten minutes; it can quietly transform your voice."),
    ("练声不是重复，是一次次重新突破", "Vocal practice is not mere repetition; it is a new breakthrough each time."),
    ("今天觉得困难，说明你正在向上走", "If it feels difficult today, you are moving upward."),
    ("声音会记住，你认真练过的每一天", "Your voice remembers every day you practiced with care."),
    ("稳稳练下去，你会听见自己的变化", "Keep practicing steadily, and you will hear yourself change."),
    ("不和别人比较，只比昨天多进步一点", "Do not compare with others; just improve a little beyond yesterday."),
    ("慢一点没关系，只要一直没有停下", "It is fine to move slowly, as long as you keep moving."),
    ("每天认真开口，就是送给自己的礼物", "Using your voice with intention each day is a gift to yourself."),
    ("你的声音有潜力，只差一点耐心打磨", "Your voice has potential; it only needs patient refinement."),
    ("所有好听的声音，都经历过笨拙阶段", "Every beautiful voice has passed through an awkward stage."),
    ("不必一次唱好，只要一次比一次更好", "You do not need to nail it at once; just make each attempt better."),
    ("今天练下的功夫，迟早会藏进声音里", "The work you put in today will eventually live in your voice."),
    ("声音的成长很慢，但每一步都算数", "A voice grows slowly, but every step counts."),
    ("别让一次失误，否定你所有的进步", "Do not let one mistake erase all the progress you have made."),
    ("越是稳定练习，越能遇见新的自己", "The more consistently you practice, the more of your new self you discover."),
    ("认真对待声音，它会给你新的惊喜", "Treat your voice with care, and it will surprise you."),
    ("坚持练下去，好声音正在路上等你", "Keep practicing; a better voice is waiting down the road."),
]


def upgrade() -> None:
    op.bulk_insert(DailyPracticeMessage.__table__, [
        {"id": index, "content_zh_hans": zh, "content_en": en, "active": True}
        for index, (zh, en) in enumerate(MESSAGES, start=1)
    ])


def downgrade() -> None:
    op.get_bind().execute(sa.text("DELETE FROM daily_practice_messages"))
