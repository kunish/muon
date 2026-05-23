<script setup lang="ts">
import type { Component } from 'vue';
import type { Contact, GroupInfo } from '@/features/contacts/stores/contactStore';
import { getClient } from '@matrix/client';
import { Avatar } from '@muon/ui/avatar';
import { useContactList } from '@shared/composables/useContactList';
import {
  Building2,
  GitBranch,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';

type OrganizationSection = 'overview' | 'members' | 'groups';

type OrganizationSource = 'account' | 'matrix' | 'local';
type OrganizationAccountStatus = '正常' | '已停用';
type OrganizationPermissionRole = '普通成员' | '协作管理员' | '超级管理员';

interface OrganizationMember extends Contact {
  accountStatus: OrganizationAccountStatus;
  department: string;
  permissionRole: OrganizationPermissionRole;
  role: string;
  source: OrganizationSource;
}

interface OrganizationGroup extends GroupInfo {
  description: string;
  source: Exclude<OrganizationSource, 'account'>;
}

interface PersistedOrganizationDirectory {
  deletedGroupIds: string[];
  deletedMemberIds: string[];
  groups: OrganizationGroup[];
  members: OrganizationMember[];
}

const ORGANIZATION_WIDTH_STORAGE_KEY = 'muon_organization_sidebar_width';
const ORGANIZATION_DIRECTORY_STORAGE_KEY = 'muon_organization_directory_v1';
const DEFAULT_ORGANIZATION_WIDTH = 248;
const MIN_ORGANIZATION_WIDTH = 220;
const MAX_ORGANIZATION_WIDTH = 360;

const contactList = useContactList();
const activeSection = ref<OrganizationSection>('overview');
const searchQuery = ref('');
const actionMessage = ref('组织入口已就绪');
const currentUserId = ref('@muon:localhost');
const currentDisplayName = ref('我');
const currentAvatarUrl = ref<string | undefined>();
const savedMembers = ref<OrganizationMember[]>([]);
const deletedMemberIds = ref<string[]>([]);
const savedGroups = ref<OrganizationGroup[]>([]);
const deletedGroupIds = ref<string[]>([]);
const memberEditorOpen = ref(false);
const memberInviteOpen = ref(false);
const editingMemberId = ref<string | null>(null);
const invitedMemberIds = ref<string[]>([]);
const selectedGovernanceMemberId = ref<string | null>(null);
const memberDraft = ref({
  displayName: '',
  role: '成员',
  userId: '',
});
const groupEditorOpen = ref(false);
const editingGroupId = ref<string | null>(null);
const groupDraft = ref({
  description: '',
  name: '',
});

const sections: Array<{
  id: OrganizationSection;
  icon: Component;
  label: string;
}> = [
  { id: 'overview', label: '组织概览', icon: Building2 },
  { id: 'members', label: '成员目录', icon: UsersRound },
  { id: 'groups', label: '团队群组', icon: GitBranch },
];

function normalizeAccountStatus(value: unknown): OrganizationAccountStatus {
  return value === '已停用' ? '已停用' : '正常';
}

function normalizePermissionRole(value: unknown): OrganizationPermissionRole {
  if (value === '协作管理员' || value === '超级管理员') return value;
  return '普通成员';
}

function normalizeMember(
  member: Partial<OrganizationMember> & Contact,
  source: OrganizationSource,
): OrganizationMember {
  return {
    ...member,
    accountStatus: normalizeAccountStatus(member.accountStatus),
    department: member.department || (source === 'account' ? '组织管理部' : '默认部门'),
    permissionRole: normalizePermissionRole(member.permissionRole),
    role: member.role || (source === 'account' ? '当前账号' : '成员'),
    source,
  };
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function testIdFor(value: string): string {
  return value.replace(/[^\w-]/g, '-');
}

function readPersistedDirectory(): void {
  try {
    const raw = localStorage.getItem(ORGANIZATION_DIRECTORY_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<PersistedOrganizationDirectory>;
    savedMembers.value = Array.isArray(parsed.members)
      ? parsed.members.map((member) => normalizeMember(member, 'local'))
      : [];
    deletedMemberIds.value = Array.isArray(parsed.deletedMemberIds) ? parsed.deletedMemberIds : [];
    savedGroups.value = Array.isArray(parsed.groups) ? parsed.groups : [];
    deletedGroupIds.value = Array.isArray(parsed.deletedGroupIds) ? parsed.deletedGroupIds : [];
  } catch {
    savedMembers.value = [];
    deletedMemberIds.value = [];
    savedGroups.value = [];
    deletedGroupIds.value = [];
  }
}

function persistDirectory(): void {
  const payload: PersistedOrganizationDirectory = {
    members: savedMembers.value,
    deletedMemberIds: deletedMemberIds.value,
    groups: savedGroups.value,
    deletedGroupIds: deletedGroupIds.value,
  };
  localStorage.setItem(ORGANIZATION_DIRECTORY_STORAGE_KEY, JSON.stringify(payload));
}

function readCurrentUser(): void {
  try {
    const client = getClient();
    const userId = client.getUserId() || '@muon:localhost';
    const user = client.getUser(userId);
    currentUserId.value = userId;
    currentDisplayName.value = user?.displayName || userId;
    currentAvatarUrl.value = user?.avatarUrl || undefined;
  } catch {
    currentUserId.value = '@muon:localhost';
    currentDisplayName.value = '我';
    currentAvatarUrl.value = undefined;
  }
}

const organizationProfile = computed(() => {
  const [localpart = 'muon', domain = 'localhost'] = currentUserId.value.replace(/^@/, '').split(':');
  const organizationSlug = localpart.includes('.') ? localpart.split('.')[0] : 'muon';
  return {
    domain,
    name: organizationSlug === 'muon' ? 'Muon Workspace' : `${titleCase(organizationSlug)} Workspace`,
    slug: organizationSlug,
  };
});

const organizationMembers = computed<OrganizationMember[]>(() => {
  const currentMember: OrganizationMember = {
    ...normalizeMember(
      {
        userId: currentUserId.value,
        displayName: currentDisplayName.value,
        avatarUrl: currentAvatarUrl.value,
        presence: 'online',
        role: '当前账号',
        department: '组织管理部',
        permissionRole: '超级管理员',
        accountStatus: '正常',
      },
      'account',
    ),
  };
  const memberMap = new Map<string, OrganizationMember>();
  const deleted = new Set(deletedMemberIds.value);
  const members = [
    currentMember,
    ...contactList.contacts.map((contact) =>
      normalizeMember(
        {
          ...contact,
          role: '成员',
        },
        'matrix',
      ),
    ),
  ];

  for (const member of members) {
    if (!deleted.has(member.userId)) memberMap.set(member.userId, member);
  }

  for (const member of savedMembers.value) {
    if (!deleted.has(member.userId)) memberMap.set(member.userId, normalizeMember(member, 'local'));
  }

  return Array.from(memberMap.values());
});

const selectedGovernanceMember = computed(
  () =>
    organizationMembers.value.find((member) => member.userId === selectedGovernanceMemberId.value) ??
    organizationMembers.value[0],
);

const organizationGroups = computed<OrganizationGroup[]>(() => {
  const groupMap = new Map<string, OrganizationGroup>();
  const deleted = new Set(deletedGroupIds.value);

  for (const group of contactList.groups) {
    if (deleted.has(group.roomId)) continue;
    groupMap.set(group.roomId, {
      ...group,
      description: '来自已加入的 Matrix 团队群',
      source: 'matrix',
    });
  }

  for (const group of savedGroups.value) {
    if (!deleted.has(group.roomId)) groupMap.set(group.roomId, { ...group, source: 'local' });
  }

  return Array.from(groupMap.values());
});

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

const filteredMembers = computed(() => {
  const query = normalizedSearchQuery.value;
  if (!query) return organizationMembers.value;

  return organizationMembers.value.filter((member) =>
    [
      member.displayName,
      member.userId,
      member.role,
      member.department,
      member.permissionRole,
      member.accountStatus,
    ].some((value) => value.toLowerCase().includes(query)),
  );
});

const filteredGroups = computed(() => {
  const query = normalizedSearchQuery.value;
  if (!query) return organizationGroups.value;

  return organizationGroups.value.filter((group) =>
    [group.name, group.roomId, group.description].some((value) => value.toLowerCase().includes(query)),
  );
});

const activeSectionLabel = computed(
  () => sections.find((section) => section.id === activeSection.value)?.label ?? '组织概览',
);
const resizeLabel = computed(() => '调整组织侧边栏宽度');
const organizationMemberIds = computed(() => organizationMembers.value.map((member) => member.userId));

const overviewHighlights = computed(() => [
  { label: '组织成员', value: organizationMembers.value.length, hint: '含当前账号与联系人目录' },
  { label: '协作群组', value: organizationGroups.value.length, hint: '来自已加入团队群' },
  { label: '组织域', value: organizationProfile.value.domain, hint: `企业标识 ${organizationProfile.value.slug}` },
]);

function selectSection(section: OrganizationSection): void {
  activeSection.value = section;
  if (section !== 'members') searchQuery.value = '';
}

function showMembers(): void {
  selectSection('members');
  actionMessage.value = '已打开成员目录';
}

function showGroups(): void {
  selectSection('groups');
  actionMessage.value = '已打开团队群组';
}

function showSecurityGovernance(): void {
  activeSection.value = 'members';
  searchQuery.value = '';
  memberEditorOpen.value = false;
  selectedGovernanceMemberId.value = selectedGovernanceMember.value?.userId ?? null;
  actionMessage.value = '已打开成员治理';
}

function inviteMember(): void {
  actionMessage.value = '选择要邀请的新成员';
  activeSection.value = 'members';
  memberInviteOpen.value = true;
  memberEditorOpen.value = false;
  editingMemberId.value = null;
  invitedMemberIds.value = [];
}

function startNewMember(): void {
  actionMessage.value = '正在新增成员';
  activeSection.value = 'members';
  memberInviteOpen.value = false;
  memberEditorOpen.value = true;
  editingMemberId.value = null;
  memberDraft.value = {
    displayName: '',
    role: '成员',
    userId: '',
  };
}

function normalizeUserId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return `@member-${Date.now()}:${organizationProfile.value.domain}`;
  if (trimmed.startsWith('@')) return trimmed;
  if (trimmed.includes(':')) return `@${trimmed}`;
  return `@${trimmed}:${organizationProfile.value.domain}`;
}

function fallbackNameFromUserId(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function closeMemberInvite(): void {
  invitedMemberIds.value = [];
  memberInviteOpen.value = false;
}

function saveInvitedMembers(): void {
  const targetIds = [...invitedMemberIds.value];
  if (targetIds.length === 0) return;

  const nextMembers = targetIds.map((userId) => {
    const contact = contactList.contacts.find((item) => item.userId === userId);
    return normalizeMember(
      {
        userId,
        displayName: contact?.displayName ?? fallbackNameFromUserId(userId),
        avatarUrl: contact?.avatarUrl,
        presence: contact?.presence ?? 'offline',
        role: '成员',
      },
      'local',
    );
  });
  const targetIdSet = new Set(targetIds);

  savedMembers.value = savedMembers.value.filter((member) => !targetIdSet.has(member.userId)).concat(nextMembers);
  deletedMemberIds.value = deletedMemberIds.value.filter((id) => !targetIdSet.has(id));
  selectedGovernanceMemberId.value = targetIds[0] ?? null;
  actionMessage.value =
    targetIds.length === 1 ? `已邀请：${nextMembers[0]?.displayName}` : `已邀请 ${targetIds.length} 位成员`;
  closeMemberInvite();
  searchQuery.value = '';
  persistDirectory();
}

function editMember(member: OrganizationMember): void {
  activeSection.value = 'members';
  memberInviteOpen.value = false;
  memberEditorOpen.value = true;
  editingMemberId.value = member.userId;
  memberDraft.value = {
    displayName: member.displayName,
    role: member.role,
    userId: member.userId,
  };
  actionMessage.value = `正在编辑 ${member.displayName}`;
}

function saveMember(): void {
  const displayName = memberDraft.value.displayName.trim();
  if (!displayName) return;

  const previousUserId = editingMemberId.value;
  const userId = normalizeUserId(memberDraft.value.userId);
  const existing = organizationMembers.value.find(
    (member) => member.userId === previousUserId || member.userId === userId,
  );
  const nextMember: OrganizationMember = {
    userId,
    displayName,
    accountStatus: existing?.accountStatus ?? '正常',
    avatarUrl: existing?.avatarUrl,
    department: existing?.department ?? '默认部门',
    permissionRole: existing?.permissionRole ?? '普通成员',
    presence: existing?.presence ?? 'offline',
    role: memberDraft.value.role.trim() || '成员',
    source: 'local',
  };

  savedMembers.value = savedMembers.value
    .filter((member) => member.userId !== userId && member.userId !== previousUserId)
    .concat(nextMember);
  deletedMemberIds.value = deletedMemberIds.value.filter((id) => id !== userId && id !== previousUserId);
  memberEditorOpen.value = false;
  editingMemberId.value = null;
  searchQuery.value = '';
  actionMessage.value = `已保存成员 ${nextMember.displayName}`;
  selectedGovernanceMemberId.value = nextMember.userId;
  persistDirectory();
}

function deleteMember(member: OrganizationMember): void {
  if (member.source === 'account') return;

  savedMembers.value = savedMembers.value.filter((item) => item.userId !== member.userId);
  if (!deletedMemberIds.value.includes(member.userId))
    deletedMemberIds.value = [...deletedMemberIds.value, member.userId];
  if (selectedGovernanceMemberId.value === member.userId) selectedGovernanceMemberId.value = null;
  actionMessage.value = '成员已删除';
  persistDirectory();
}

function selectGovernanceMember(member: OrganizationMember): void {
  selectedGovernanceMemberId.value = member.userId;
  actionMessage.value = `已选择 ${member.displayName}`;
}

function updateSelectedGovernance(
  updates: Partial<Pick<OrganizationMember, 'accountStatus' | 'department' | 'permissionRole'>>,
  message: string,
): void {
  const member = selectedGovernanceMember.value;
  if (!member) return;

  const nextMember = normalizeMember(
    {
      ...member,
      ...updates,
    },
    'local',
  );

  savedMembers.value = savedMembers.value.filter((item) => item.userId !== member.userId).concat(nextMember);
  deletedMemberIds.value = deletedMemberIds.value.filter((id) => id !== member.userId);
  selectedGovernanceMemberId.value = member.userId;
  actionMessage.value = message;
  persistDirectory();
}

function transferSelectedMember(): void {
  const member = selectedGovernanceMember.value;
  if (!member) return;
  updateSelectedGovernance({ department: '产品研发部' }, `已调动：${member.displayName}`);
}

function promoteSelectedMember(): void {
  const member = selectedGovernanceMember.value;
  if (!member) return;
  updateSelectedGovernance({ permissionRole: '协作管理员' }, `已授权：${member.displayName}`);
}

function disableSelectedMember(): void {
  const member = selectedGovernanceMember.value;
  if (!member) return;
  updateSelectedGovernance({ accountStatus: '已停用' }, `已停用：${member.displayName}`);
}

function startNewGroup(): void {
  activeSection.value = 'groups';
  groupEditorOpen.value = true;
  editingGroupId.value = null;
  groupDraft.value = {
    name: '',
    description: '',
  };
  actionMessage.value = '正在新建团队群组';
}

function editGroup(group: OrganizationGroup): void {
  activeSection.value = 'groups';
  groupEditorOpen.value = true;
  editingGroupId.value = group.roomId;
  groupDraft.value = {
    name: group.name,
    description: group.description,
  };
  actionMessage.value = `正在编辑 ${group.name}`;
}

function saveGroup(): void {
  const name = groupDraft.value.name.trim();
  if (!name) return;

  const roomId = editingGroupId.value ?? `local-team-${Date.now()}`;
  const existing = organizationGroups.value.find((group) => group.roomId === roomId);
  const nextGroup: OrganizationGroup = {
    roomId,
    name,
    description: groupDraft.value.description.trim() || '组织内自定义协作团队',
    memberCount: existing?.memberCount ?? 1,
    avatarUrl: existing?.avatarUrl,
    source: 'local',
  };

  savedGroups.value = savedGroups.value.filter((group) => group.roomId !== roomId).concat(nextGroup);
  deletedGroupIds.value = deletedGroupIds.value.filter((id) => id !== roomId);
  groupEditorOpen.value = false;
  editingGroupId.value = null;
  searchQuery.value = '';
  actionMessage.value = `已保存团队 ${nextGroup.name}`;
  persistDirectory();
}

function deleteGroup(group: OrganizationGroup): void {
  savedGroups.value = savedGroups.value.filter((item) => item.roomId !== group.roomId);
  if (!deletedGroupIds.value.includes(group.roomId)) deletedGroupIds.value = [...deletedGroupIds.value, group.roomId];
  actionMessage.value = '团队已删除';
  persistDirectory();
}

function openGroup(group: OrganizationGroup): void {
  actionMessage.value = `已选择 ${group.name}`;
}

function openActivity(message: string): void {
  actionMessage.value = message;
}

watch(searchQuery, (value) => {
  if (value.trim()) activeSection.value = 'members';
});

onMounted(async () => {
  readPersistedDirectory();
  readCurrentUser();
  await Promise.all([contactList.loadContacts(), contactList.loadGroups()]);
});
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="organization-sidebar"
      content-test-id="organization-sidebar-content"
      handle-test-id="organization-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6"
      :width-storage-key="ORGANIZATION_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_ORGANIZATION_WIDTH"
      :min-width="MIN_ORGANIZATION_WIDTH"
      :max-width="MAX_ORGANIZATION_WIDTH"
      :resize-label="resizeLabel"
    >
      <div class="mb-5 px-3">
        <div class="flex items-center gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary"
          >
            <Building2 :size="20" />
          </span>
          <span class="min-w-0">
            <h1 class="truncate text-[18px] font-semibold leading-6">组织</h1>
            <p class="truncate text-[13px] leading-[18px] text-muted-foreground">
              {{ organizationProfile.name }}
            </p>
          </span>
        </div>
      </div>

      <label
        class="mx-2 mb-4 flex h-8 items-center gap-2 rounded-md border border-transparent bg-input px-3 text-muted-foreground focus-within:border-primary"
      >
        <Search :size="16" class="shrink-0" />
        <input
          v-model="searchQuery"
          data-testid="organization-search-input"
          type="text"
          placeholder="搜索成员、群组或组织"
          class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          @focus="activeSection = 'members'"
        />
      </label>

      <div class="flex flex-col gap-1">
        <button
          v-for="section in sections"
          :key="section.id"
          :data-testid="`organization-section-${section.id}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeSection === section.id ? 'workspace-row-active' : ''"
          @click="selectSection(section.id)"
        >
          <component :is="section.icon" :size="18" />
          <span class="min-w-0 flex-1 truncate text-[13px] font-semibold">{{ section.label }}</span>
        </button>
      </div>

      <div class="mt-auto px-2 pb-1">
        <button
          data-testid="organization-invite-member"
          class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          @click="inviteMember"
        >
          <UserPlus :size="16" />
          <span>邀请成员</span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <div class="flex min-w-0 items-center gap-3">
          <span class="text-[13px] font-semibold text-foreground">{{ organizationProfile.name }}</span>
          <span class="text-muted-foreground">/</span>
          <span class="truncate text-[13px] text-muted-foreground">{{ activeSectionLabel }}</span>
        </div>
        <div class="ml-4 flex shrink-0 items-center gap-2">
          <span class="hidden text-[12px] text-muted-foreground sm:inline">{{ actionMessage }}</span>
          <button
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="成员目录"
            @click="showMembers"
          >
            <UsersRound :size="18" />
          </button>
          <button
            data-testid="organization-security-shortcut"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="安全与权限"
            @click="showSecurityGovernance"
          >
            <ShieldCheck :size="18" />
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto grid w-full max-w-[1180px] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section class="flex min-w-0 flex-col gap-5">
            <div class="grid gap-3 md:grid-cols-3">
              <div v-for="item in overviewHighlights" :key="item.label" class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  {{ item.label }}
                </div>
                <div class="mt-3 truncate text-2xl font-semibold leading-8">
                  {{ item.value }}
                </div>
                <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                  {{ item.hint }}
                </p>
              </div>
            </div>

            <section
              v-if="activeSection === 'overview'"
              class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            >
              <div class="workspace-surface rounded-lg">
                <div class="flex h-12 items-center justify-between border-b border-border px-4">
                  <h2 class="text-[15px] font-semibold">组织架构</h2>
                  <span class="text-[12px] text-muted-foreground">{{ organizationMembers.length }} 人</span>
                </div>
                <div class="space-y-3 p-4">
                  <div class="rounded-lg border border-border bg-muted/40 p-3">
                    <div class="flex items-center gap-2 text-[13px] font-semibold">
                      <Building2 :size="16" class="text-primary" />
                      <span>{{ organizationProfile.name }}</span>
                    </div>
                    <div class="mt-3 ml-4 space-y-2 border-l border-border pl-4">
                      <button class="workspace-row gap-2 px-3 py-2 text-left" @click="showMembers">
                        <UsersRound :size="16" class="text-primary" />
                        <span class="text-[13px] font-semibold">成员目录</span>
                      </button>
                      <button class="workspace-row gap-2 px-3 py-2 text-left" @click="showGroups">
                        <GitBranch :size="16" class="text-primary" />
                        <span class="text-[13px] font-semibold">团队群组</span>
                      </button>
                    </div>
                  </div>
                  <p class="text-[13px] leading-5 text-muted-foreground">
                    组织、成员和协作群组集中在一个入口，便于从日常沟通直接进入组织视图。
                  </p>
                  <div>
                    <div class="mb-2 text-[12px] font-semibold text-muted-foreground">成员预览</div>
                    <div class="grid gap-2 sm:grid-cols-2">
                      <button
                        v-for="member in organizationMembers.slice(0, 6)"
                        :key="member.userId"
                        class="workspace-row gap-2 px-3 py-2 text-left"
                        @click="showMembers"
                      >
                        <Avatar :alt="member.displayName" :src="member.avatarUrl" :color-id="member.userId" size="sm" />
                        <span class="min-w-0">
                          <span class="block truncate text-[13px] font-semibold">{{ member.displayName }}</span>
                          <span class="block truncate text-[12px] text-muted-foreground">{{ member.role }}</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="workspace-surface rounded-lg">
                <div class="flex h-12 items-center justify-between border-b border-border px-4">
                  <h2 class="text-[15px] font-semibold">快捷入口</h2>
                </div>
                <div class="grid gap-2 p-4">
                  <button class="workspace-row gap-3 px-3 py-3 text-left" @click="showMembers">
                    <UsersRound :size="18" class="text-primary" />
                    <span>
                      <span class="block text-[13px] font-semibold">成员目录</span>
                      <span class="mt-0.5 block text-[12px] text-muted-foreground">查找组织成员并开始沟通</span>
                    </span>
                  </button>
                  <button class="workspace-row gap-3 px-3 py-3 text-left" @click="showGroups">
                    <MessageSquare :size="18" class="text-primary" />
                    <span>
                      <span class="block text-[13px] font-semibold">团队群组</span>
                      <span class="mt-0.5 block text-[12px] text-muted-foreground">查看已加入的组织协作群</span>
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <section v-else-if="activeSection === 'members'" class="workspace-surface rounded-lg">
              <div class="flex h-12 items-center justify-between border-b border-border px-4">
                <h2 class="text-[15px] font-semibold">成员目录</h2>
                <div class="flex items-center gap-2">
                  <span class="text-[12px] text-muted-foreground">{{ filteredMembers.length }} 人</span>
                  <button
                    data-testid="organization-new-member"
                    class="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                    @click="startNewMember"
                  >
                    <Plus :size="14" />
                    <span>新增成员</span>
                  </button>
                </div>
              </div>
              <div
                v-if="memberInviteOpen"
                class="border-b border-border bg-muted/30 p-4"
                data-testid="organization-member-invite-panel"
              >
                <GroupMemberPicker v-model="invitedMemberIds" :exclude-ids="organizationMemberIds" />
                <div class="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    class="h-9 rounded-md px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    @click="closeMemberInvite"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    data-testid="organization-member-invite-save"
                    class="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="invitedMemberIds.length === 0"
                    @click="saveInvitedMembers"
                  >
                    邀请
                  </button>
                </div>
              </div>
              <form
                v-if="memberEditorOpen"
                class="grid gap-3 border-b border-border bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto]"
                @submit.prevent="saveMember"
              >
                <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                  成员姓名
                  <input
                    v-model="memberDraft.displayName"
                    data-testid="organization-member-name-input"
                    class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                    placeholder="成员姓名"
                  />
                </label>
                <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                  Matrix ID
                  <input
                    v-model="memberDraft.userId"
                    data-testid="organization-member-id-input"
                    class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                    placeholder="@member:localhost"
                  />
                </label>
                <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                  角色
                  <input
                    v-model="memberDraft.role"
                    data-testid="organization-member-role-input"
                    class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                    placeholder="成员"
                  />
                </label>
                <div class="flex items-end gap-2">
                  <button
                    data-testid="organization-member-save"
                    type="button"
                    class="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    @click="saveMember"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="取消"
                    @click="memberEditorOpen = false"
                  >
                    <X :size="16" />
                  </button>
                </div>
              </form>
              <div class="divide-y divide-border">
                <div
                  v-for="member in filteredMembers"
                  :key="member.userId"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <Avatar :alt="member.displayName" :src="member.avatarUrl" :color-id="member.userId" size="sm" />
                  <button
                    :data-testid="`organization-select-member-${testIdFor(member.userId)}`"
                    type="button"
                    class="min-w-0 flex-1 text-left"
                    @click="selectGovernanceMember(member)"
                  >
                    <span class="block truncate text-[13px] font-semibold">{{ member.displayName }}</span>
                    <span class="mt-0.5 block truncate text-[12px] text-muted-foreground">{{ member.userId }}</span>
                    <span class="mt-0.5 block truncate text-[12px] text-muted-foreground"
                      >{{ member.department }} · {{ member.accountStatus }}</span
                    >
                  </button>
                  <span
                    class="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                  >
                    {{ member.role }}
                  </span>
                  <button
                    :data-testid="`organization-edit-member-${testIdFor(member.userId)}`"
                    type="button"
                    class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="编辑成员"
                    @click="editMember(member)"
                  >
                    <Pencil :size="15" />
                  </button>
                  <button
                    v-if="member.source !== 'account'"
                    :data-testid="`organization-delete-member-${testIdFor(member.userId)}`"
                    type="button"
                    class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="删除成员"
                    @click="deleteMember(member)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
                <div v-if="filteredMembers.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
                  未找到匹配成员
                </div>
              </div>
            </section>

            <section v-else class="workspace-surface rounded-lg">
              <div class="flex h-12 items-center justify-between border-b border-border px-4">
                <h2 class="text-[15px] font-semibold">团队群组</h2>
                <div class="flex items-center gap-2">
                  <span class="text-[12px] text-muted-foreground">{{ filteredGroups.length }} 个群组</span>
                  <button
                    data-testid="organization-new-group"
                    class="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                    @click="startNewGroup"
                  >
                    <Plus :size="14" />
                    <span>新增团队</span>
                  </button>
                </div>
              </div>
              <form
                v-if="groupEditorOpen"
                class="grid gap-3 border-b border-border bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                @submit.prevent="saveGroup"
              >
                <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                  团队名称
                  <input
                    v-model="groupDraft.name"
                    data-testid="organization-group-name-input"
                    class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                    placeholder="团队名称"
                  />
                </label>
                <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                  团队说明
                  <input
                    v-model="groupDraft.description"
                    data-testid="organization-group-desc-input"
                    class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                    placeholder="团队职责或说明"
                  />
                </label>
                <div class="flex items-end gap-2">
                  <button
                    data-testid="organization-group-save"
                    type="button"
                    class="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    @click="saveGroup"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="取消"
                    @click="groupEditorOpen = false"
                  >
                    <X :size="16" />
                  </button>
                </div>
              </form>
              <div class="grid gap-3 p-4 md:grid-cols-2">
                <div
                  v-for="group in filteredGroups"
                  :key="group.roomId"
                  class="workspace-surface flex items-start gap-3 rounded-lg p-4 text-left transition-colors hover:bg-accent"
                >
                  <Avatar :alt="group.name" :color-id="group.roomId" size="sm" />
                  <button type="button" class="min-w-0 flex-1 text-left" @click="openGroup(group)">
                    <span class="block truncate text-[14px] font-semibold">{{ group.name }}</span>
                    <span class="mt-1 block text-[12px] text-muted-foreground">{{ group.memberCount }} 位成员</span>
                    <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground">{{
                      group.description
                    }}</span>
                  </button>
                  <button
                    :data-testid="`organization-edit-group-${testIdFor(group.roomId)}`"
                    type="button"
                    class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="编辑团队"
                    @click="editGroup(group)"
                  >
                    <Pencil :size="15" />
                  </button>
                  <button
                    :data-testid="`organization-delete-group-${testIdFor(group.roomId)}`"
                    type="button"
                    class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="删除团队"
                    @click="deleteGroup(group)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
                <div v-if="filteredGroups.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
                  未找到匹配群组
                </div>
              </div>
            </section>
          </section>

          <aside class="workspace-surface h-fit rounded-lg">
            <div class="flex h-12 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">成员治理</h2>
              <span class="text-[12px] text-muted-foreground">权限与状态</span>
            </div>
            <div v-if="selectedGovernanceMember" class="grid gap-3 border-b border-border p-4 text-[13px] leading-5">
              <span class="font-semibold text-foreground">{{ selectedGovernanceMember.displayName }}</span>
              <span class="text-muted-foreground">所属部门：{{ selectedGovernanceMember.department }}</span>
              <span class="text-muted-foreground">组织权限：{{ selectedGovernanceMember.permissionRole }}</span>
              <span class="text-muted-foreground">账号状态：{{ selectedGovernanceMember.accountStatus }}</span>
              <div class="grid gap-2 pt-1">
                <button
                  data-testid="organization-transfer-member"
                  class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  @click="transferSelectedMember"
                >
                  调入产品研发部
                </button>
                <button
                  data-testid="organization-promote-member"
                  class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                  @click="promoteSelectedMember"
                >
                  授权协作管理员
                </button>
                <button
                  data-testid="organization-disable-member"
                  class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  @click="disableSelectedMember"
                >
                  停用账号
                </button>
              </div>
            </div>
            <div class="flex h-12 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">组织动态</h2>
              <span class="text-[12px] text-muted-foreground">今天</span>
            </div>
            <div class="divide-y divide-border">
              <button
                data-testid="organization-activity-directory-sync"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                @click="openActivity('已查看成员目录同步动态')"
              >
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span class="min-w-0">
                  <span class="block truncate text-[13px] font-semibold">成员目录已同步</span>
                  <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground"
                    >联系人与组织视图保持一致</span
                  >
                </span>
              </button>
              <button
                data-testid="organization-activity-groups-entry"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                @click="openActivity('已查看团队群组入口动态')"
              >
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                <span class="min-w-0">
                  <span class="block truncate text-[13px] font-semibold">团队群组可从组织页进入</span>
                  <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground"
                    >减少在消息和通讯录之间切换</span
                  >
                </span>
              </button>
            </div>
          </aside>
        </div>
      </main>
    </section>
  </div>
</template>
