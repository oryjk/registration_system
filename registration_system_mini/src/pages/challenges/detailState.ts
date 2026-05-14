import type { BackendChallengeIndividualParticipant } from "@/types/backend";

export interface IndividualParticipantPreview {
  id: number;
  name: string;
  avatarUrl: string;
  tone: string;
}

export function avatarColor(userId: number) {
  const tones = ["#161714", "#4b5d16", "#325f70", "#7c5840", "#4a5568", "#685044"];
  return tones[Math.abs(userId) % tones.length];
}

export function buildIndividualParticipantPreview(
  participants: BackendChallengeIndividualParticipant[],
): IndividualParticipantPreview[] {
  return participants.slice(0, 8).map((participant) => ({
    id: participant.user_id,
    name: participant.display_name || "球员",
    avatarUrl: participant.avatar_url?.trim() || "",
    tone: avatarColor(participant.user_id),
  }));
}
