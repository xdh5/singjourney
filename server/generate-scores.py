"""由现有 Python 乐谱实现生成 Workers 清单，不渲染音频。"""
import json
from dataclasses import asdict
from pathlib import Path
from practice.constants import PRACTICE_EXERCISES_BY_KEY, master_accompaniment_filename, PHRASE_LEAD_IN_SECONDS, PIANO_CUE_DURATION_BEATS, CUE_REST_BEATS
from practice.score import build_practice_master_score

generated = {'_timing': {'lead': PHRASE_LEAD_IN_SECONDS, 'cue': PIANO_CUE_DURATION_BEATS, 'rest': CUE_REST_BEATS}, '_version': json.loads(Path(__file__).with_name('package.json').read_text(encoding='utf-8'))['version']}
for key, definition in PRACTICE_EXERCISES_BY_KEY.items():
    generated[key] = {'score': asdict(build_practice_master_score(key)), 'definition': asdict(definition), 'filename': master_accompaniment_filename(key)}
Path('/output/generated.json').write_text(json.dumps(generated, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
