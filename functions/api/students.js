export async function onRequest({ request, env }) {
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  }
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers })
  const db = env.DB
  if (!db) return new Response(JSON.stringify({ error: 'missing D1 binding DB' }), { status: 500, headers })
  try {
    const url = new URL(request.url)
    const idParam = url.searchParams.get('id')
    const q = url.searchParams.get('q') || ''
    if (request.method === 'GET') {
      if (idParam) {
        const r = await db.prepare('SELECT rowid AS id, name, age FROM students WHERE rowid = ?').bind(Number(idParam)).first()
        if (!r) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers })
        return new Response(JSON.stringify(r), { status: 200, headers })
      } else {
        const stmt = q
          ? db.prepare('SELECT rowid AS id, name, age FROM students WHERE name LIKE ? ORDER BY rowid').bind(`%${q}%`)
          : db.prepare('SELECT rowid AS id, name, age FROM students ORDER BY rowid')
        const res = await stmt.all()
        return new Response(JSON.stringify(res), { status: 200, headers })
      }
    }
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      let { name, age } = body
      if (typeof name !== 'string' || !name.trim()) return new Response(JSON.stringify({ error: 'missing name' }), { status: 400, headers })
      if (age === undefined || age === null || Number.isNaN(Number(age))) return new Response(JSON.stringify({ error: 'missing age' }), { status: 400, headers })
      age = Number(age)
      const res = await db.prepare('INSERT INTO students (name, age) VALUES (?, ?)').bind(name.trim(), age).run()
      const insertedId = res?.meta?.last_row_id || res?.lastInsertRowId || null
      if (insertedId) {
        const r = await db.prepare('SELECT rowid AS id, name, age FROM students WHERE rowid = ?').bind(insertedId).first()
        return new Response(JSON.stringify(r), { status: 201, headers })
      }
      return new Response(JSON.stringify(res), { status: 201, headers })
    }
    if (request.method === 'PUT' || request.method === 'PATCH') {
      if (!idParam) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers })
      const id = Number(idParam)
      const body = await request.json().catch(() => ({}))
      const { name, age } = body
      const sets = []
      const values = []
      if (name !== undefined) { sets.push('name = ?'); values.push(String(name)) }
      if (age !== undefined) { const a = Number(age); if (!Number.isNaN(a)) { sets.push('age = ?'); values.push(a) } }
      if (sets.length === 0) return new Response(JSON.stringify({ error: 'no_fields' }), { status: 400, headers })
      values.push(id)
      await db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE rowid = ?`).bind(...values).run()
      const r = await db.prepare('SELECT rowid AS id, name, age FROM students WHERE rowid = ?').bind(id).first()
      return new Response(JSON.stringify(r || {}), { status: 200, headers })
    }
    if (request.method === 'DELETE') {
      if (!idParam) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers })
      const id = Number(idParam)
      const res = await db.prepare('DELETE FROM students WHERE rowid = ?').bind(id).run()
      return new Response(JSON.stringify(res), { status: 200, headers })
    }
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers })
  }
}
