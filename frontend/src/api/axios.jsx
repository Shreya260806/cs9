import axios from 'axios'
import useAuthStore from '../store/useAuthStore'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const publicClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
	},
})

const privateClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true,
})

function shouldClearSession(error) {
	const status = error.response?.status
	const message = error.response?.data?.message

	return status === 401 || (status === 403 && message === 'Account disabled')
}

privateClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (shouldClearSession(error)) {
			useAuthStore.getState().clearUser()
			useAuthStore.getState().setAuthChecked(true)

			const requestUrl = error.config?.url || ''
			const isAuthProbe = requestUrl.includes('/api/auth/me') || requestUrl.includes('/api/auth/login')
			if (!isAuthProbe && window.location.pathname !== '/') {
				window.location.assign('/')
			}
		}

		return Promise.reject(error)
	},
)

export function axiosPublic() {
	return publicClient
}

export function axisPrivate() {
	return privateClient
}
