const API_URL = typeof window !== 'undefined'
    ? '/api'
    : (process.env.BACKEND_URL || 'http://127.0.0.1:3001') + '/api';

async function request(endpoint: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    let url = `${API_URL}${endpoint}`;
    console.log(`[API] Fetching: ${url}`);

    let res;
    try {
        res = await fetch(url, { ...options, headers });
    } catch (netErr) {
        console.warn(`[API] Network error on ${url}, trying direct backend...`);
        url = `${backendUrl}/api${endpoint}`;
        res = await fetch(url, { ...options, headers });
    }

    console.log(`[API] Response: ${res.status} ${res.statusText}`);

    // If we get HTML instead of JSON for an API call, it means the proxy hit a 404/500 page
    if (res.headers.get('content-type')?.includes('text/html')) {
        console.error('[API] Received HTML instead of JSON. Proxy might be misconfigured.');
        if (typeof window === 'undefined') {
            // On server, we can try direct backend injection
            url = `${backendUrl}/api${endpoint}`;
            res = await fetch(url, { ...options, headers });
        }
    }

    if (res.status === 401) {
        const data = await res.json();
        if (data.code === 'TOKEN_EXPIRED') {
            const refreshed = await refreshToken();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
                const retryRes = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
                if (!retryRes.ok) {
                    const errData = await retryRes.json();
                    throw new Error(errData.error || 'Erro na requisição');
                }
                return retryRes.json();
            } else {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                throw new Error('Sessão expirada');
            }
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Não autorizado');
    }

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro na requisição');
    }

    return res.json();
}

async function refreshToken(): Promise<boolean> {
    try {
        const refreshTokenValue = localStorage.getItem('refreshToken');
        if (!refreshTokenValue) return false;

        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refreshTokenValue }),
        });

        if (!res.ok) return false;

        const data = await res.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

export const api = {
    get: (endpoint: string) => request(endpoint),
    post: (endpoint: string, data: unknown) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint: string, data: unknown) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    patch: (endpoint: string, data: unknown) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
};

export async function login(email: string, senha: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao fazer login');
    }

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
}

export async function register(nome: string, email: string, senha: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao registrar');
    }

    return res.json();
}

export function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

export function getUser() {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('accessToken');
}
