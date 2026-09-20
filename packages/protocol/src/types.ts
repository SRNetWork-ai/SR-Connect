export type PresenceStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice" | "stage";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  /** آواتار آپلودشده؛ خالی یعنی حرف اول روی رنگ ثابت نمایش داده شود. */
  avatarUrl?: string | null;
  bio?: string | null;
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

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  mime: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

/** ری‌اکشن‌ها جمع‌شده می‌آیند: یک ردیف به ازای هر ایموجی. */
export interface Reaction {
  emoji: string;
  count: number;
  /** آیا کاربر فعلی هم این ری‌اکشن را زده است. */
  me: boolean;
}

export interface ReplyPreview {
  id: string;
  authorName: string;
  authorColor: string;
  excerpt: string;
  deleted: boolean;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  author: Pick<PublicUser, "id" | "username" | "displayName" | "avatarColor" | "avatarUrl">;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyTo: string | null;
  replyPreview?: ReplyPreview | null;
  system: boolean;
  attachments?: Attachment[];
  reactions?: Reaction[];
  /** فقط برای پیام خوش‌بینانه‌ی در حال ارسال. */
  pending?: boolean;
  failed?: boolean;
}

export interface ReadState {
  channelId: string;
  lastReadAt: string | null;
  unread: number;
  mentions: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
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
