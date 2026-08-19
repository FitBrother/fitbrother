import { useMutation } from "@tanstack/react-query";
import { deleteAccount } from "@/lib/api/account";

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
