"""在现有 API 容器内导出 D1 数据和权威乐谱，不重新生成音频。"""
import json
import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import MetaData, select
from app.db.session import engine
from app.modules.practice.constants import PRACTICE_EXERCISES_BY_KEY, master_accompaniment_filename, PHRASE_LEAD_IN_SECONDS, PIANO_CUE_DURATION_BEATS, CUE_REST_BEATS
from app.modules.practice.score import build_practice_master_score
from dataclasses import asdict


def scalar(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def literal(value):
    value = scalar(value)
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


metadata = MetaData()
metadata.reflect(engine)
sql = ["PRAGMA defer_foreign_keys = ON;"]
counts = {}
with engine.connect() as connection:
    connection.exec_driver_sql("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
    for table in metadata.sorted_tables:
        definitions = []
        for column in table.columns:
            kind = str(column.type).upper()
            storage = "INTEGER" if "INT" in kind or "BOOL" in kind else "REAL" if "FLOAT" in kind or "DOUBLE" in kind else "TEXT"
            definitions.append(f'"{column.name}" {storage}' + (" NOT NULL" if not column.nullable else ""))
        keys = ",".join(f'"{column.name}"' for column in table.primary_key)
        if keys:
            definitions.append(f"PRIMARY KEY ({keys})")
        for constraint in table.constraints:
            if constraint.__class__.__name__ == "UniqueConstraint":
                definitions.append('UNIQUE (' + ','.join(f'"{c.name}"' for c in constraint.columns) + ')')
        for fk in table.foreign_key_constraints:
            local = ','.join(f'"{e.parent.name}"' for e in fk.elements)
            remote = ','.join(f'"{e.column.name}"' for e in fk.elements)
            definitions.append(f'FOREIGN KEY ({local}) REFERENCES "{fk.referred_table.name}" ({remote})' + (f" ON DELETE {fk.ondelete}" if fk.ondelete else ""))
        sql.append(f'CREATE TABLE "{table.name}" (' + ','.join(definitions) + ');')
        rows = connection.execute(select(table)).mappings().all()
        counts[table.name] = len(rows)
        for row in rows:
            sql.append(f'INSERT INTO "{table.name}" VALUES (' + ','.join(literal(row[c.name]) for c in table.columns) + ');')
        for index in table.indexes:
            cols = ','.join(f'"{c.name}"' for c in index.columns)
            sql.append(f'CREATE {"UNIQUE " if index.unique else ""}INDEX "{index.name}" ON "{table.name}" ({cols});')
generated = {}
generated['_timing'] = {'lead': PHRASE_LEAD_IN_SECONDS, 'cue': PIANO_CUE_DURATION_BEATS, 'rest': CUE_REST_BEATS}
from app.core.release import get_server_version
generated['_version'] = get_server_version()
for key, definition in PRACTICE_EXERCISES_BY_KEY.items():
    generated[key] = {"score": asdict(build_practice_master_score(key)), "definition": asdict(definition), "filename": master_accompaniment_filename(key)}
output = Path(os.environ.get('MIGRATION_OUTPUT', '/tmp'))
(output / 'migration.sql').write_text('\n'.join(sql), encoding='utf-8')
(output / 'generated.json').write_text(json.dumps(generated, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps(counts))
