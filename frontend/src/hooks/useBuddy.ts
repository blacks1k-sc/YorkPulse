"use client";

/**
 * Legacy hooks for backwards compatibility.
 * New code should use useQuests.ts instead.
 */

export {
  useQuests as useBuddyRequests,
  useQuest as useBuddyRequest,
  useMyQuests as useMyBuddyRequests,
  useCreateQuest as useCreateBuddyRequest,
  useUpdateQuest as useUpdateBuddyRequest,
  useDeleteQuest as useDeleteBuddyRequest,
  useJoinQuest as useJoinBuddyRequest,
  useLeaveQuest as useLeaveBuddyRequest,
  useQuestParticipants as useBuddyParticipants,
  useApproveParticipant as useUpdateParticipant,
} from "./useQuests";

export { useMyQuests as useMyParticipation } from "./useQuests";
