import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1
    },
    mutations: {
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Something went wrong";
        toast.error(message);
      }
    }
  }
});
