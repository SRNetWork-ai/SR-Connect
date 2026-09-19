export type PresenceStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice" | "stage";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  status: PresenceStatus;
  isAdmin: boolean;
  roles: { id: string; name: string; color: string }[];
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  position: number;
  isPrivate: boolean;
  userLimit: number;
  bitrate: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  author: Pick<PublicUser, "id" | "username" | "displayName" | "avatarColor">;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyTo: string | null;
  system: boolean;
}

export interface VoiceParticipant {
  userId: string;
  displayName: string;
  avatarColor: string;
  muted: boolean;
  deafened: boolean;
  streaming: boolean;
  joinedAt: string;
}

export interface ServerStats {
  members: number;
  online: number;
  voiceUsers: number;
  voiceCapacity: number;
  uptimeSeconds: number;
}
