import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccidentRecord, EmergencyContact, UserProfile } from "../backend";
import { useActor } from "./useActor";

export function useUserProfile() {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useEmergencyContacts() {
  const { actor, isFetching } = useActor();
  return useQuery<EmergencyContact[]>({
    queryKey: ["emergencyContacts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyEmerContacts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUserAccidents() {
  const { actor, isFetching } = useActor();
  return useQuery<AccidentRecord[]>({
    queryKey: ["userAccidents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getUserAccidents();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllAccidents() {
  const { actor, isFetching } = useActor();
  return useQuery<Array<[unknown, AccidentRecord[]]>>({
    queryKey: ["allAccidents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAccidents() as Promise<
        Array<[unknown, AccidentRecord[]]>
      >;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddEmergencyContact() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: EmergencyContact) => {
      if (!actor) throw new Error("Not connected");
      return actor.addEmergencyContact(contact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergencyContacts"] });
    },
  });
}

export function useRemoveEmergencyContact() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phone: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.removeEmergencyContact(phone);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergencyContacts"] });
    },
  });
}

export function useSaveProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Not connected");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });
}

export function useReportAccident() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: AccidentRecord) => {
      if (!actor) throw new Error("Not connected");
      return actor.reportAccident(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userAccidents"] });
    },
  });
}

export function useSendSms() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      phone,
      message,
    }: { phone: string; message: string }) => {
      if (!actor) throw new Error("Not connected");
      return actor.sendSms(phone, message);
    },
  });
}
