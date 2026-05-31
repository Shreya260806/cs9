import { useEffect } from "react"
import { RouterProvider, createBrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ToastContainer, Slide } from "react-toastify"
import { X } from "lucide-react"
import { axisPrivate } from "./api/axios"
import { queryClient } from "./lib/queryClient"
import { routes } from "./routes"
import useAuthStore from "./store/useAuthStore"
import "react-toastify/dist/ReactToastify.css"

const router = createBrowserRouter(routes)

// White ✕ — readable on the black toast background in every theme/type.
function ToastCloseButton({ closeToast }) {
	return (
		<button
			type="button"
			onClick={closeToast}
			aria-label="Dismiss notification"
			className="ml-auto self-center p-0.5 text-white/80 transition hover:text-white"
		>
			<X className="h-4 w-4" strokeWidth={3} />
		</button>
	)
}

function App() {
	const setUser = useAuthStore((state) => state.setUser)
	const clearUser = useAuthStore((state) => state.clearUser)
	const setAuthChecked = useAuthStore((state) => state.setAuthChecked)

	useEffect(() => {
		let isActive = true

		async function bootstrapAuth() {
			try {
				const { data } = await axisPrivate().get('/api/auth/me')
				if (isActive) setUser(data.user)
			} catch {
				if (isActive) clearUser()
			} finally {
				if (isActive) setAuthChecked(true)
			}
		}

		bootstrapAuth()

		return () => {
			isActive = false
		}
	}, [clearUser, setAuthChecked, setUser])

	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<ToastContainer
				position="top-right"
				transition={Slide}
				newestOnTop
				closeButton={ToastCloseButton}
			/>
		</QueryClientProvider>
	)
}

export default App
