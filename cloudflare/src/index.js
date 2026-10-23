import scores from './generated.json';

const userFields = ['id', 'display_name', 'avatar_data_url', 'locale', 'preferred_voice_preset', 'preferred_range_min_midi', 'preferred_range_max_midi'];
const json = (value, status = 200) => Response.json(value, { status });
const fail = (status, detail) => { throw Object.assign(new Error('请求失败'), { status, detail }); };
const round = (value, digits = 3) => Number(value.toFixed(digits));
const publicUser = user => Object.fromEntries(userFields.map(key => [key, user[key] ?? null]));
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results;
const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();
const day = value => new Date(value).toISOString().slice(0, 10);

async function bodyJson(request) {
  const reader = request.body?.getReader();
  if (!reader) fail(422, 'Request body required');
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1000000) { await reader.cancel(); fail(413, 'Request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(422, 'Invalid request body');
  return body;
}

async function authenticated(request, env) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') || '');
  if (!match) fail(401, 'Bearer token required');
  const row = await first(env, `SELECT u.*, s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND julianday(s.expires_at)>julianday(?) AND u.status='active'`, await hash(match[1]), new Date().toISOString());
  if (!row) fail(401, 'Session is invalid or expired');
  return row;
}

function optionalText(body, key, maximum, minimum = 0) {
  const value = body[key];
  if (value != null && (typeof value !== 'string' || value.length < minimum || value.length > maximum)) fail(422, `Invalid ${key}`);
}

function validateProfile(body) {
  optionalText(body, 'display_name', 80, 1);
  optionalText(body, 'avatar_data_url', 750000);
  if (body.preferred_voice_preset != null && !['male', 'female'].includes(body.preferred_voice_preset)) fail(422, 'Invalid voice preset');
  const a = body.preferred_range_min_midi, b = body.preferred_range_max_midi;
  if ((a != null) !== (b != null) || (a != null && (!Number.isInteger(a) || !Number.isInteger(b) || a < 48 || b > 77 || a >= b))) fail(422, 'Invalid preferred range');
}

async function login(body, env) {
  optionalText(body, 'code', 256, 1);
  optionalText(body, 'locale', 16);
  validateProfile(body);
  if (!body.code) fail(422, 'Login code required');
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) fail(503, 'WeChat login is not configured');
  const query = new URLSearchParams({ appid: env.WECHAT_APP_ID, secret: env.WECHAT_APP_SECRET, js_code: body.code, grant_type: 'authorization_code' });
  let payload;
  try {
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) fail(401, 'WeChat session exchange failed');
    payload = await response.json();
  } catch { fail(401, 'WeChat session exchange failed'); }
  if (!payload.openid) fail(401, 'WeChat rejected the login code');
  const now = new Date().toISOString();
  const candidate = crypto.randomUUID();
  // 用户和微信身份在同一个批次内创建；并发登录由唯一约束和子查询归并。
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (id,status,display_name,avatar_data_url,locale,created_at,updated_at) SELECT ?,'active',?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM auth_identities WHERE provider='wechat' AND provider_subject=?)`).bind(candidate, body.display_name?.trim() ?? null, body.avatar_data_url ?? null, body.locale ?? null, now, now, payload.openid),
    env.DB.prepare(`INSERT INTO auth_identities (id,user_id,provider,provider_subject,verified_at,created_at) SELECT ?,?,'wechat',?,?,? WHERE NOT EXISTS (SELECT 1 FROM auth_identities WHERE provider='wechat' AND provider_subject=?)`).bind(crypto.randomUUID(), candidate, payload.openid, now, now, payload.openid),
  ]);
  let user = await first(env, `SELECT u.* FROM users u JOIN auth_identities i ON i.user_id=u.id WHERE i.provider='wechat' AND i.provider_subject=?`, payload.openid);
  if (user.status !== 'active') fail(401, 'Account is inactive');
  if (body.locale) {
    await run(env, 'UPDATE users SET locale=?,updated_at=? WHERE id=?', body.locale, now, user.id);
    user.locale = body.locale;
  }
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const expires = new Date(Date.now() + Number(env.AUTH_SESSION_DAYS || 30) * 86400000).toISOString();
  await run(env, 'INSERT INTO auth_sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)', crypto.randomUUID(), user.id, await hash(token), expires, now);
  return json({ access_token: token, token_type: 'Bearer', expires_at: expires, user: publicUser(user) });
}

function manifest(key, url) {
  const data = scores[key];
  if (!data) fail(404, 'Exercise has no accompaniment');
  const voice = url.searchParams.get('voice');
  if (voice && !['male', 'female'].includes(voice)) fail(422, 'Invalid voice');
  const a = url.searchParams.get('minimum_midi'), b = url.searchParams.get('maximum_midi');
  const [minimum, maximum] = a === null || b === null ? (voice === 'female' ? [52, 76] : [48, 72]) : [Number(a), Number(b)];
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 48 || maximum > 77 || minimum >= maximum) fail(422, 'Invalid practice range');
  const { score, definition } = data;
  const span = Math.max(...definition.pattern) - Math.min(...definition.pattern);
  if (maximum - minimum < span) fail(422, { code: 'practice_range_too_narrow', minimum_span_midi: span, minimum_midi: minimum, maximum_midi: maximum });
  const phrases = [];
  for (let i = 0; i < score.target_notes.length; i += definition.pattern.length) phrases.push(score.target_notes.slice(i, i + definition.pattern.length));
  const eligible = phrase => phrase.every(note => note.midi >= minimum && note.midi <= maximum);
  let groups;
  if (definition.progression_mode === 'round_trip') {
    const highest = maximum - Math.max(...definition.pattern);
    groups = [phrases.slice(0, 30).filter(eligible), phrases.slice(30).filter(phrase => eligible(phrase) && phrase[0].midi < highest)];
  } else groups = [phrases.filter(eligible)];
  let cursor = 0;
  const segments = [], notes = [];
  for (const group of groups) {
    if (!group.length) continue;
    const start = Math.max(0, group[0][0].start - scores._timing.lead - (scores._timing.cue + scores._timing.rest) * 60 / score.tempo_bpm);
    const end = group.at(-1).at(-1).end;
    const duration = round(end - start, 6);
    segments.push({ source_offset: round(start, 6), duration });
    for (const phrase of group) for (const note of phrase) notes.push({ start: round(cursor + note.start - start, 6), end: round(cursor + note.end - start, 6), midi: note.midi });
    cursor += duration;
  }
  return json({ exercise_key: key, version: score.version, voice: voice || 'custom', tempo_bpm: score.tempo_bpm, range: { minimum_midi: minimum, maximum_midi: maximum }, duration: round(cursor, 6), audio_path: `/practice/assets/${data.filename}`, audio_offset: segments[0].source_offset, audio_segments: segments, target_notes: notes });
}

async function catalog(env, english) {
  const [categories, exercises, links] = await Promise.all([
    all(env, 'SELECT * FROM practice_categories WHERE active=1 ORDER BY sort_order,key'),
    all(env, 'SELECT * FROM practice_exercises ORDER BY sort_order,id'),
    all(env, 'SELECT ec.* FROM practice_exercise_categories ec JOIN practice_categories c ON c.key=ec.category_key WHERE c.active=1 ORDER BY ec.exercise_id,ec.sort_order,c.sort_order'),
  ]);
  const name = row => english ? row.name_en : row.name_zh_hans;
  const result = exercises.map(row => {
    const keys = links.filter(link => link.exercise_id === row.id).map(link => link.category_key);
    return { id: row.id, title: english ? row.title_en : row.title_zh_hans, tip: english ? row.tip_en : row.tip_zh_hans, category_keys: keys, category_names: keys.map(key => name(categories.find(c => c.key === key))), pattern: row.pattern, recommended_syllables: row.recommended_syllables, tempo: row.tempo, repetitions: row.repetitions, intensity: row.intensity, enabled: Boolean(row.enabled) };
  }).filter(row => row.category_keys.length);
  return { categories: categories.map(row => ({ key: row.key, name: name(row) })), exercises: result };
}

async function statistics(env, userId, offset, english) {
  const [rows, info] = await Promise.all([all(env, 'SELECT exercise_key,duration_seconds,started_at FROM practice_sessions WHERE user_id=?', userId), catalog(env, english)]);
  const today = day(Date.now() - offset * 60000);
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekStart = day(monday);
  const localDay = row => day(Date.parse(row.started_at) - offset * 60000);
  const week = rows.filter(row => localDay(row) >= weekStart && localDay(row) <= today);
  const summary = values => ({ sessions: values.length, duration_seconds: round(values.reduce((sum, row) => sum + row.duration_seconds, 0)) });
  const dates = [...new Set(rows.map(localDay))].sort();
  const distribution = values => {
    const groups = new Map();
    for (const row of values) {
      const key = row.exercise_key === 'free-practice' ? 'natural' : info.exercises.find(e => e.id === row.exercise_key)?.category_keys[0];
      if (!key) continue;
      const group = groups.get(key) || { category_key: key, name: info.categories.find(c => c.key === key)?.name || key, sessions: 0, duration_seconds: 0 };
      group.sessions++; group.duration_seconds += row.duration_seconds; groups.set(key, group);
    }
    const total = [...groups.values()].reduce((sum, row) => sum + row.duration_seconds, 0);
    return [...groups.values()].sort((a, b) => b.duration_seconds - a.duration_seconds || a.category_key.localeCompare(b.category_key)).map(row => ({ ...row, duration_seconds: round(row.duration_seconds), percentage: total ? round(row.duration_seconds / total * 100, 1) : 0 }));
  };
  const ranking = values => {
    const groups = new Map();
    for (const row of values) {
      if (!row.exercise_key) continue;
      const key = row.exercise_key;
      const group = groups.get(key) || { exercise_key: key, title: key === 'free-practice' ? (english ? 'Free Practice' : '自由练声') : info.exercises.find(e => e.id === key)?.title || key, sessions: 0, duration_seconds: 0 };
      group.sessions++; group.duration_seconds += row.duration_seconds; groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.sessions - a.sessions || b.duration_seconds - a.duration_seconds || a.exercise_key.localeCompare(b.exercise_key)).slice(0, 5).map(row => ({ ...row, duration_seconds: round(row.duration_seconds) }));
  };
  let longest = 0, streak = 0, previous;
  for (const date of dates) { streak = previous && Date.parse(date) - Date.parse(previous) === 86400000 ? streak + 1 : 1; longest = Math.max(longest, streak); previous = date; }
  const days = new Set(week.map(localDay)).size;
  const weekly = summary(week);
  return { week: { today: summary(week.filter(row => localDay(row) === today)), overview: { ...weekly, practice_days: days, average_daily_seconds: days ? round(weekly.duration_seconds / days) : 0 }, daily_activity: Array.from({ length: 7 }, (_, i) => { const date = day(monday.getTime() + i * 86400000); return { date, ...summary(week.filter(row => localDay(row) === date)) }; }), category_distribution: distribution(week), top_exercises: ranking(week) }, lifetime: { history: { ...summary(rows), started_on: dates[0] || null, practice_days: dates.length, longest_streak_days: longest }, category_distribution: distribution(rows), top_exercises: ranking(rows) } };
}

async function route(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const english = (request.headers.get('Accept-Language') || '').toLowerCase().startsWith('en');
  if (path === '/health/live') return json({ status: 'ok' });
  if (path === '/health/ready') { await first(env, 'SELECT 1'); return json({ status: 'ready' }); }
  if (path === '/version') return json({ serverVersion: scores._version, apiMajor: 1 });
  if (!path.startsWith('/api/v1/')) return env.WEB.fetch(request);
  const endpoint = path.slice('/api/v1'.length);
  if (['GET', 'HEAD'].includes(method) && endpoint.startsWith('/practice/assets/')) {
    const filename = endpoint.slice('/practice/assets/'.length);
    if (!Object.values(scores).some(row => row?.filename === filename)) fail(404, 'Practice asset not found');
    const metadata = await env.AUDIO.head(filename);
    if (!metadata) fail(404, 'Practice asset not found');
    const headers = new Headers();
    metadata.writeHttpMetadata(headers);
    headers.set('Content-Type', 'audio/ogg');
    headers.set('Cache-Control', 'public,max-age=31536000,immutable');
    headers.set('ETag', metadata.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Last-Modified', metadata.uploaded.toUTCString());
    if (request.headers.get('If-None-Match') === metadata.httpEtag) return new Response(null, { status: 304, headers });
    if (method === 'HEAD') { headers.set('Content-Length', String(metadata.size)); return new Response(null, { headers }); }
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
    const ifRange = request.headers.get('If-Range');
    let selected;
    if (range && (!ifRange || ifRange === metadata.httpEtag || ifRange === metadata.uploaded.toUTCString())) {
      const start = range[1] ? Number(range[1]) : Math.max(0, metadata.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(metadata.size - 1, Number(range[2])) : metadata.size - 1;
      if ((!range[1] && !range[2]) || start >= metadata.size || start > end) {
        headers.set('Content-Range', `bytes */${metadata.size}`);
        headers.set('Content-Length', '0');
        return new Response(null, { status: 416, headers });
      }
      selected = { offset: start, length: end - start + 1 };
      headers.set('Content-Range', `bytes ${start}-${end}/${metadata.size}`);
    }
    // R2 直接流式返回指定字节段，避免把母带全部读入 Workers 内存。
    const object = await env.AUDIO.get(filename, selected ? { range: selected } : undefined);
    if (!object) fail(404, 'Practice asset not found');
    headers.set('Content-Length', String(selected?.length ?? object.size));
    return new Response(object.body, { status: selected ? 206 : 200, headers });
  }
  if (method === 'GET' && endpoint === '/practice/catalog') return json(await catalog(env, english));
  const match = /^\/practice\/exercises\/([^/]+)\/manifest$/.exec(endpoint);
  if (method === 'GET' && match) return manifest(match[1], url);
  if (method === 'GET' && endpoint === '/practice/daily-message') {
    const date = day(Date.now()), digest = await hash(date);
    const id = Number(BigInt(`0x${digest.slice(0, 16)}`) % 30n) + 1;
    const row = await first(env, 'SELECT * FROM daily_practice_messages WHERE id=? AND active=1', id);
    if (!row) fail(404, 'Daily message is unavailable');
    return json({ id, date, content: english ? row.content_en : row.content_zh_hans });
  }
  if (method === 'POST' && endpoint === '/auth/wechat/login') return login(await bodyJson(request), env);
  if (method === 'POST' && endpoint === '/telemetry/events') {
    const body = await bodyJson(request);
    if (!Array.isArray(body.events) || !body.events.length || body.events.length > 20) fail(422, 'Invalid events');
    // 只记录允许的埋点字段，避免将任意请求内容写入日志。
    const allowed = new Set(['app_opened', 'feature_opened', 'recording_started', 'recording_paused', 'recording_resumed', 'recording_completed', 'recording_saved', 'recording_save_failed', 'recording_share_clicked', 'recording_share_succeeded', 'recording_share_failed', 'recording_play_failed', 'client_error']);
    for (const event of body.events) {
      if (!event || !allowed.has(event.event_name) || !['web', 'ios', 'android', 'harmony', 'wx', 'development'].includes(event.platform) || !Number.isFinite(Date.parse(event.occurred_at))) fail(422, 'Invalid event');
      for (const key of ['event_id', 'anonymous_id', 'session_id']) if (typeof event[key] !== 'string' || !/^[A-Za-z0-9._-]{8,80}$/.test(event[key])) fail(422, 'Invalid event identifier');
      if (event.duration_seconds != null && (typeof event.duration_seconds !== 'number' || !Number.isFinite(event.duration_seconds) || event.duration_seconds < 0 || event.duration_seconds > 600)) fail(422, 'Invalid duration');
      if (event.feature_key != null && (typeof event.feature_key !== 'string' || !/^[a-z0-9._-]{1,40}$/.test(event.feature_key))) fail(422, 'Invalid feature');
    }
    for (const event of body.events) console.log(JSON.stringify({ event_name: event.event_name, occurred_at: event.occurred_at, platform: event.platform, feature_key: event.feature_key, duration_seconds: event.duration_seconds }));
    return json({ accepted: body.events.length });
  }
  const user = await authenticated(request, env);
  if (method === 'GET' && endpoint === '/auth/session') return json({ expires_at: user.expires_at, user: publicUser(user) });
  if (method === 'PATCH' && endpoint === '/auth/profile') {
    const body = await bodyJson(request); validateProfile(body);
    await run(env, `UPDATE users SET display_name=coalesce(display_name,?),avatar_data_url=coalesce(avatar_data_url,?),preferred_voice_preset=coalesce(?,preferred_voice_preset),preferred_range_min_midi=coalesce(?,preferred_range_min_midi),preferred_range_max_midi=coalesce(?,preferred_range_max_midi),updated_at=? WHERE id=?`, body.display_name?.trim() ?? null, body.avatar_data_url ?? null, body.preferred_voice_preset ?? null, body.preferred_range_min_midi ?? null, body.preferred_range_max_midi ?? null, new Date().toISOString(), user.id);
    return json(publicUser(await first(env, 'SELECT * FROM users WHERE id=?', user.id)));
  }
  if (method === 'GET' && endpoint === '/practice/favorites') return json({ exercise_ids: (await all(env, 'SELECT exercise_id FROM practice_favorites WHERE user_id=? ORDER BY created_at,exercise_id', user.id)).map(row => row.exercise_id) });
  const favorite = /^\/practice\/favorites\/([^/]+)$/.exec(endpoint);
  if (favorite && ['PUT', 'DELETE'].includes(method)) {
    const key = decodeURIComponent(favorite[1]);
    if (method === 'PUT') {
      if (!await first(env, 'SELECT id FROM practice_exercises WHERE id=?', key)) fail(404, 'Exercise not found');
      await run(env, 'INSERT OR IGNORE INTO practice_favorites (user_id,exercise_id,created_at) VALUES (?,?,?)', user.id, key, new Date().toISOString());
    } else await run(env, 'DELETE FROM practice_favorites WHERE user_id=? AND exercise_id=?', user.id, key);
    return new Response(null, { status: 204 });
  }
  if (method === 'POST' && endpoint === '/practice/sessions') {
    const body = await bodyJson(request);
    optionalText(body, 'client_event_id', 80, 8); optionalText(body, 'exercise_key', 80, 1);
    const start = Date.parse(body.started_at), end = Date.parse(body.ended_at), duration = body.duration_seconds;
    const zoned = value => typeof value === 'string' && /(Z|[+-]\d\d:\d\d)$/i.test(value);
    if (!body.client_event_id || !body.exercise_key || !zoned(body.started_at) || !zoned(body.ended_at) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || typeof duration !== 'number' || !Number.isFinite(duration) || duration < 1 || duration > 600 || duration > (end - start) / 1000 + 5) fail(422, 'Invalid practice timeline');
    const id = crypto.randomUUID();
    const result = await run(env, 'INSERT INTO practice_sessions (id,user_id,client_event_id,exercise_key,mode,duration_seconds,started_at,ended_at,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,client_event_id) DO NOTHING', id, user.id, body.client_event_id, body.exercise_key, body.exercise_key === 'free-practice' ? 'free' : 'guided', duration, new Date(start).toISOString(), new Date(end).toISOString(), new Date().toISOString());
    const row = await first(env, 'SELECT id FROM practice_sessions WHERE user_id=? AND client_event_id=?', user.id, body.client_event_id);
    return json({ id: row.id, created: result.meta.changes > 0 }, 201);
  }
  if (method === 'GET' && endpoint === '/practice/statistics') {
    const offset = Number(url.searchParams.get('timezone_offset_minutes') || 0);
    if (!Number.isInteger(offset) || Math.abs(offset) > 840) fail(422, 'Invalid timezone offset');
    return json(await statistics(env, user.id, offset, english));
  }
  fail(404, 'Not found');
}

export default {
  async fetch(request, env) {
    let response;
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 1000000) fail(413, 'Request too large');
      response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await route(request, env);
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 422 : 500);
      if (status === 500) console.error('接口执行失败');
      response = json({ detail: error.detail || (status === 422 ? 'Invalid JSON' : 'Internal server error') }, status);
    }
    const output = new Response(response.body, response);
    const origin = request.headers.get('Origin');
    if (origin && (env.CORS_ORIGINS || '').split(',').includes(origin)) {
      output.headers.set('Access-Control-Allow-Origin', origin);
      output.headers.set('Vary', 'Origin');
      output.headers.set('Access-Control-Allow-Credentials', 'true');
      output.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      output.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    output.headers.set('X-Request-ID', crypto.randomUUID());
    return output;
  },
};
