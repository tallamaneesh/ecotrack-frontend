const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
let auth = sessionStorage.getItem('auth')
export const setAuth = (email, pw) => { auth = email ? 'Basic ' + btoa(email + ':' + pw) : null; auth ? sessionStorage.setItem('auth', auth) : sessionStorage.removeItem('auth') }
export const hasAuth = () => !!auth
export async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: body ? JSON.stringify(body) : undefined })
  if (res.status === 401) throw new Error('Wrong email or password')
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Something went wrong') }
  const t = await res.text(); return t ? JSON.parse(t) : null
}
