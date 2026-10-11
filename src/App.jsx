import { useEffect, useState } from 'react'
import { api, setAuth, hasAuth } from './api'

const STEPS = ['SUBMITTED', 'ASSIGNED', 'COLLECTED', 'COMPLETED']
const label = s => s[0] + s.slice(1).toLowerCase()

export default function App() {
  const [user, setUser] = useState(null)
  useEffect(() => { if (hasAuth()) api('/auth/me').then(setUser).catch(() => setAuth(null)) }, [])
  const out = () => { setAuth(null); setUser(null) }
  if (!user) return <Login onLogin={setUser} />
  return (
    <>
      <header className="bar">
        <h1>EcoTrack</h1>
        <span>{user.name} · {label(user.role)}</span>
        <button className="ghost" onClick={out}>Log out</button>
      </header>
      <main>
        {user.role === 'RESIDENT' && <NewRequest />}
        {user.role === 'ADMIN' && <Admin />}
        <Requests user={user} />
      </main>
    </>
  )
}

function Login({ onLogin }) {
  const [reg, setReg] = useState(false)
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'RESIDENT' })
  const [err, setErr] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function go(e) {
    e.preventDefault(); setErr('')
    try {
      if (reg) await api('/auth/register', 'POST', f)
      setAuth(f.email, f.password); onLogin(await api('/auth/me'))
    } catch (x) { setAuth(null); setErr(x.message) }
  }
  return (
    <div className="login">
      <div className="pitch">
        <h1>EcoTrack</h1>
        <p>Report waste, follow its pickup, and see it recycled.</p>
        <ol className="trail"><li>Submitted</li><li>Assigned</li><li>Collected</li><li>Completed</li></ol>
      </div>
      <form onSubmit={go}>
        <h2>{reg ? 'Create account' : 'Log in'}</h2>
        {reg && <input placeholder="Full name" value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input type="password" placeholder="Password" value={f.password} onChange={set('password')} required />
        {reg && <select value={f.role} onChange={set('role')}><option value="RESIDENT">I am a resident</option><option value="RECYCLER">I represent a recycling organization</option></select>}
        {err && <p className="err">{err}</p>}
        <button>{reg ? 'Register' : 'Log in'}</button>
        <a href="#" onClick={e => { e.preventDefault(); setReg(!reg); setErr('') }}>{reg ? 'I already have an account' : 'New here? Create an account'}</a>
      </form>
    </div>
  )
}

function NewRequest() {
  const [cats, setCats] = useState([])
  const [f, setF] = useState({ description: '', address: '', cat: '' })
  const [msg, setMsg] = useState('')
  useEffect(() => { api('/categories').then(setCats) }, [])
  async function submit(e) {
    e.preventDefault(); setMsg('')
    try {
      await api('/requests', 'POST', { description: f.description, address: f.address, category: { id: Number(f.cat) } })
      setF({ description: '', address: '', cat: '' }); setMsg('Request submitted'); window.dispatchEvent(new Event('reload'))
    } catch (x) { setMsg(x.message) }
  }
  return (
    <section className="panel">
      <h2>Request a collection</h2>
      <form className="row" onSubmit={submit}>
        <select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} required>
          <option value="">Waste category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="What needs collecting?" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} required />
        <input placeholder="Pickup address" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} required />
        <button>Submit request</button>
      </form>
      {msg && <p className="note">{msg}</p>}
    </section>
  )
}

function Requests({ user }) {
  const [list, setList] = useState([])
  const [staff, setStaff] = useState([])
  const [q, setQ] = useState(''); const [st, setSt] = useState('')
  const load = () => api(`/requests?q=${encodeURIComponent(q)}&status=${st}`).then(setList)
  useEffect(() => { load() }, [q, st])
  useEffect(() => { window.addEventListener('reload', load); return () => window.removeEventListener('reload', load) })
  useEffect(() => { if (user.role === 'ADMIN') api('/users?role=STAFF').then(setStaff) }, [])
  const act = fn => async () => { try { await fn(); load() } catch (x) { alert(x.message) } }
  const next = r => STEPS[STEPS.indexOf(r.status) + 1]
  return (
    <section className="panel">
      <h2>{user.role === 'RESIDENT' ? 'My requests' : user.role === 'RECYCLER' ? 'Collected materials' : user.role === 'STAFF' ? 'Assigned to me' : 'All requests'}</h2>
      <div className="row">
        <input placeholder="Search description, address or category" value={q} onChange={e => setQ(e.target.value)} />
        <select value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{STEPS.map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      </div>
      {list.length === 0 && <p className="note">No requests yet.</p>}
      {list.map(r => (
        <article key={r.id} className="req">
          <div>
            <strong>{r.category.name}</strong> — {r.description}
            <div className="meta">{r.address} · by {r.resident.name}{r.staff ? ` · staff ${r.staff.name}` : ''}{r.materialsReceived ? ` · received: ${r.materialsReceived}` : ''}</div>
            <ol className="trail small">{STEPS.map(s => <li key={s} className={STEPS.indexOf(s) <= STEPS.indexOf(r.status) ? 'on' : ''}>{label(s)}</li>)}</ol>
          </div>
          <div className="acts">
            {user.role === 'ADMIN' && r.status === 'SUBMITTED' && (
              <select defaultValue="" onChange={e => e.target.value && act(() => api(`/requests/${r.id}/assign/${e.target.value}`, 'PUT'))()}>
                <option value="">Assign to…</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>)}
            {['STAFF', 'ADMIN'].includes(user.role) && r.status === 'ASSIGNED' && <button onClick={act(() => api(`/requests/${r.id}/status`, 'PUT', { status: 'COLLECTED' }))}>Mark collected</button>}
            {['RECYCLER', 'ADMIN'].includes(user.role) && r.status === 'COLLECTED' && <button onClick={act(() => { const m = prompt('Materials received (e.g. 4 kg plastic)'); if (!m) throw new Error('Enter the materials received'); return api(`/requests/${r.id}/status`, 'PUT', { status: 'COMPLETED', materialsReceived: m }) })}>Record & complete</button>}
            {(user.role === 'ADMIN' || (user.role === 'RESIDENT' && r.status === 'SUBMITTED')) && <button className="ghost" onClick={act(() => api(`/requests/${r.id}`, 'DELETE'))}>{user.role === 'ADMIN' ? 'Delete' : 'Cancel'}</button>}
          </div>
        </article>))}
    </section>
  )
}

function Admin() {
  const [cats, setCats] = useState([]); const [users, setUsers] = useState([]); const [name, setName] = useState('')
  const load = () => { api('/categories').then(setCats); api('/users').then(setUsers) }
  useEffect(load, [])
  const run = fn => async () => { try { await fn(); load() } catch (x) { alert(x.message) } }
  return (
    <section className="panel">
      <h2>Administration</h2>
      <div className="cols">
        <div>
          <h3>Waste categories</h3>
          {cats.map(c => <div key={c.id} className="line">{c.name}
            <span><button className="ghost" onClick={run(() => { const n = prompt('Rename category', c.name); return n ? api(`/categories/${c.id}`, 'PUT', { name: n }) : null })}>Edit</button>
            <button className="ghost" onClick={run(() => api(`/categories/${c.id}`, 'DELETE'))}>Delete</button></span></div>)}
          <div className="row"><input placeholder="New category" value={name} onChange={e => setName(e.target.value)} />
            <button onClick={run(async () => { await api('/categories', 'POST', { name }); setName('') })}>Add</button></div>
        </div>
        <div>
          <h3>Users</h3>
          {users.map(u => <div key={u.id} className="line">{u.name} <em>{label(u.role)}</em>
            {u.role !== 'ADMIN' && <button className="ghost" onClick={run(() => api(`/users/${u.id}`, 'DELETE'))}>Remove</button>}</div>)}
        </div>
      </div>
    </section>
  )
}
