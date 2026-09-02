export type AssignScope = "self" | "partner" | "both";
export type TaskType = "daily" | "extra_normal" | "extra_quota";

export type TaskDraftItemDTO = {
  tempId: string;
  type: TaskType;
  assignScope: AssignScope;
  title: string;
  description?: string;
  points?: number;
  requiresProof: boolean;
  quotaTotal?: number;
  stampIconAssetId?: number;
  triggerProbability?: number;
  triggerTargetType?: "specific_task" | "random_from_existing";
  triggerTargetTempId?: string;
};

export type DraftContentDTO = {
  roomName: string;
  initialMoneyPool: number;
  settlementDate: string;
  settlementTimezone: string;
  dailyTasks: TaskDraftItemDTO[];
  extraTasks: TaskDraftItemDTO[];
};

export type ItemCommentDTO = { targetKey: string; comment: string };

export type RoomCreationDraftDTO = {
  id: number;
  version: number;
  proposedById: number;
  proposedByNickname: string;
  content: DraftContentDTO;
  itemComments: ItemCommentDTO[] | null;
  status: "pending_review" | "approved" | "revision_requested";
  createdAt: string;
};

export type MemberDTO = {
  id: number;
  displayNickname: string;
  avatarUrl?: string | null;
  color: string;
  role: "creator" | "member";
};

export type RoomDTO = {
  id: number;
  roomName: string;
  status: "draft" | "active" | "archived";
  inviteCode?: string;
  settlementDate: string | null;
  settlementTimezone: string;
  initialMoneyPool: number;
  currentMoneyPool: number;
};

export type TopUpDTO = {
  id: number;
  amount: number;
  addedById: number;
  addedByNickname: string;
  createdAt: string;
};

export type ScoreMemberDTO = {
  id: number;
  displayNickname: string;
  color: string;
  avatarUrl?: string | null;
  score: number;
  ratio: number;
  projectedPayout: number;
};

export type ScoresDTO = {
  currentMoneyPool: number;
  totalScore: number;
  members: ScoreMemberDTO[];
  isTie: boolean;
};

export type TaskTemplateDTO = {
  id: number;
  type: TaskType;
  assignScope: AssignScope;
  title: string;
  description?: string | null;
  createdById: number | null;
  assignedToId: number | null;
  points: number | null;
  requiresProof: boolean;
  status: string;
  quotaTotal: number | null;
  quotaUsed: number;
  triggerProbability: number | null;
  triggerTargetType: string | null;
  triggerTargetTaskId: number | null;
  isSystemGenerated: boolean;
  stampIcon: { id: number; name: string; frames: string[] } | null;
  completedToday?: boolean;
  boundRewards: { id: number; title: string }[];
  createdAt: string;
};

export type ApprovalRequestDTO = {
  id: number;
  requestType: "create_task" | "edit_task" | "delete_task" | "change_quota_reward" | "room_settings_change";
  requestedById: number;
  requestedByNickname: string;
  taskTemplateId: number | null;
  taskTitle: string | null;
  payload: Record<string, unknown>;
  status: string;
  responseDeadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type IconAssetDTO = { id: number; name: string; frames: string[] };

export type CalendarDayDTO = {
  date: string;
  stamps: { taskTemplateId: number; title: string; icon: string[] | null; points: number; isSystemGenerated: boolean }[];
  producedStamp: {
    rewardId: number;
    title: string;
    unlocked: boolean;
    contentText: string | null;
    contentImageUrls: string[] | null;
    hasUnlockCondition?: boolean;
  } | null;
};

export type CalendarDTO = { memberId: number; isOwner: boolean; days: CalendarDayDTO[] };

export type RewardDTO = {
  id: number;
  type: "produced_content" | "fixed_item" | "rescue_voucher" | "other";
  title: string;
  contentText: string | null;
  contentImageUrls: string[] | null;
  stockTotal: number | null;
  stockRemaining: number | null;
  createdById: number;
  createdByNickname: string;
  unlocked: boolean;
  redemptionRequestedAt: string | null;
  redeemedAt: string | null;
  pendingRedemptionFrom: { roomMemberId: number; nickname: string } | null;
  archived: boolean;
  createdAt: string;
};

export type RewardCommentDTO = {
  id: number;
  text: string;
  roomMemberId: number;
  nickname: string;
  createdAt: string;
};

export type NotificationDTO = {
  id: number;
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
};

export type WeeklyCompletionDTO = {
  roomMemberId: number;
  displayNickname: string;
  color: string;
  completedCount: number;
  dueCount: number;
  rate: number;
};

export type StatsDTO = {
  windowDays: number;
  days: string[];
  weeklyCompletion: WeeklyCompletionDTO[];
};

export type SettlementRecordDTO = {
  id: number;
  periodStart: string;
  periodEnd: string;
  memberScores: Record<string, number>;
  finalMoneyPool: number;
  moneyDistribution: Record<string, number>;
  createdAt: string;
};
