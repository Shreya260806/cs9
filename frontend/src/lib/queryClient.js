import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000,        // 5 seconds cache
      gcTime: 30 * 60 * 1000,    // keep unused cache for 30 min
      retry: 1,
      refetchOnWindowFocus: true, // landing page FAQs rarely need this
    },
  },
})
