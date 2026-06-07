<script setup lang="ts">
import type { MeetingRoom } from '../types/room';
import { useSelector } from '@tanstack/vue-store';
import { CalendarClock, Clock, DoorOpen, MapPin, Plus, Trash2, Users } from 'lucide-vue-next';
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  roomStore,
  selectBookings,
  selectRooms,
  addBooking as storeAddBooking,
  addRoom as storeAddRoom,
  removeBooking as storeRemoveBooking,
  removeRoom as storeRemoveRoom,
} from '../stores/roomStore';
import { todayKey } from '../types/room';

const { t } = useI18n();

const rooms = useSelector(roomStore, selectRooms);
const bookings = useSelector(roomStore, selectBookings);

// ── 当前会议室 + 日期 ──
const activeRoomId = shallowRef<string | null>(null);
const activeRoom = computed<MeetingRoom | null>(() => {
  const list = rooms.value;
  if (list.length === 0) return null;
  return list.find((room) => room.id === activeRoomId.value) ?? list[0];
});

const selectedDate = shallowRef(todayKey(Date.now()));

const dayBookings = computed(() => {
  const room = activeRoom.value;
  if (!room) return [];
  return bookings.value
    .filter((booking) => booking.roomId === room.id && booking.date === selectedDate.value)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
});

// ── 新建会议室 ──
const roomComposerOpen = shallowRef(false);
const draftRoomName = shallowRef('');
const draftRoomLocation = shallowRef('');
const draftRoomCapacity = ref(8);
const draftRoomEquipment = shallowRef('');

function openRoomComposer(): void {
  draftRoomName.value = '';
  draftRoomLocation.value = '';
  draftRoomCapacity.value = 8;
  draftRoomEquipment.value = '';
  roomComposerOpen.value = true;
}

function submitRoom(): void {
  const name = draftRoomName.value.trim();
  if (!name) {
    toast.error(t('rooms.name_required'));
    return;
  }
  const room = storeAddRoom({
    name,
    location: draftRoomLocation.value,
    capacity: Number(draftRoomCapacity.value),
    equipment: draftRoomEquipment.value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean),
  });
  activeRoomId.value = room.id;
  roomComposerOpen.value = false;
  toast.success(t('rooms.room_created'));
}

function deleteRoom(room: MeetingRoom): void {
  storeRemoveRoom(room.id);
  if (activeRoomId.value === room.id) activeRoomId.value = null;
  toast.success(t('rooms.room_deleted', { name: room.name }));
}

// ── 预定 ──
const bookingTitle = shallowRef('');
const bookingStart = shallowRef('09:00');
const bookingEnd = shallowRef('10:00');
const bookingOrganizer = shallowRef('我');

function submitBooking(): void {
  const room = activeRoom.value;
  if (!room) return;
  const title = bookingTitle.value.trim();
  if (!title) {
    toast.error(t('rooms.title_required'));
    return;
  }
  try {
    storeAddBooking({
      roomId: room.id,
      title,
      date: selectedDate.value,
      start: bookingStart.value,
      end: bookingEnd.value,
      organizer: bookingOrganizer.value,
    });
    bookingTitle.value = '';
    toast.success(t('rooms.booked'));
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    toast.error(message === 'Booking conflict' ? t('rooms.conflict') : t('rooms.invalid_slot'));
  }
}
</script>

<template>
  <WorkspacePageFrame :title="t('rooms.title')" :subtitle="t('rooms.subtitle')" :icon="DoorOpen">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="rooms-new-room"
        @click="openRoomComposer"
      >
        <Plus :size="16" />
        {{ t('rooms.new_room') }}
      </button>
    </template>

    <!-- 新建会议室面板 -->
    <div v-if="roomComposerOpen" class="grid gap-3 rounded-xl border border-border bg-sidebar p-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('rooms.name') }}</span>
        <input
          v-model="draftRoomName"
          type="text"
          :placeholder="t('rooms.name_placeholder')"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          data-testid="rooms-draft-name"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('rooms.location') }}</span>
        <input
          v-model="draftRoomLocation"
          type="text"
          :placeholder="t('rooms.location_placeholder')"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('rooms.capacity') }}</span>
        <input
          v-model.number="draftRoomCapacity"
          type="number"
          min="0"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('rooms.equipment_label') }}</span>
        <input
          v-model="draftRoomEquipment"
          type="text"
          :placeholder="t('rooms.equipment_placeholder')"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <div class="flex items-center justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
          @click="roomComposerOpen = false"
        >
          {{ t('rooms.cancel') }}
        </button>
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="rooms-submit-room"
          @click="submitRoom"
        >
          {{ t('rooms.create') }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!activeRoom"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="rooms-empty"
    >
      <DoorOpen :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('rooms.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('rooms.empty_hint') }}</p>
    </div>

    <template v-else>
      <!-- 会议室切换 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="room in rooms"
          :key="room.id"
          type="button"
          class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
          :class="
            room.id === activeRoom.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent/40'
          "
          :data-testid="`rooms-tab-${room.id}`"
          @click="activeRoomId = room.id"
        >
          {{ room.name }}
        </button>
      </div>

      <!-- 会议室详情 -->
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <span class="text-[15px] font-semibold text-foreground">{{ activeRoom.name }}</span>
          <span class="inline-flex items-center gap-1"><MapPin :size="13" />{{ activeRoom.location }}</span>
          <span class="inline-flex items-center gap-1"
            ><Users :size="13" />{{ t('rooms.capacity_unit', { count: activeRoom.capacity }) }}</span
          >
          <span v-for="tag in activeRoom.equipment" :key="tag" class="rounded bg-muted px-1.5 py-0.5 text-[11px]">
            {{ tag }}
          </span>
        </div>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          :aria-label="t('rooms.delete_room')"
          @click="deleteRoom(activeRoom)"
        >
          <Trash2 :size="15" />
        </button>
      </div>

      <!-- 预定 composer -->
      <div class="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-sidebar p-3">
        <label class="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('rooms.booking_title') }}
          <input
            v-model="bookingTitle"
            type="text"
            :placeholder="t('rooms.booking_title_placeholder')"
            class="h-9 min-w-[160px] rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            data-testid="rooms-booking-title"
            @keyup.enter="submitBooking"
          />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('rooms.date') }}
          <input
            v-model="selectedDate"
            type="date"
            class="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('rooms.start') }}
          <input
            v-model="bookingStart"
            type="time"
            class="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('rooms.end') }}
          <input
            v-model="bookingEnd"
            type="time"
            class="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('rooms.organizer') }}
          <input
            v-model="bookingOrganizer"
            type="text"
            class="h-9 w-24 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="rooms-submit-booking"
          @click="submitBooking"
        >
          <Plus :size="15" />{{ t('rooms.book') }}
        </button>
      </div>

      <!-- 当日排期 -->
      <div class="flex items-center gap-2 text-[13px] text-muted-foreground">
        <CalendarClock :size="14" />
        <span>{{ t('rooms.schedule_label', { date: selectedDate, count: dayBookings.length }) }}</span>
      </div>
      <ul v-if="dayBookings.length" class="flex flex-col gap-1.5">
        <li
          v-for="booking in dayBookings"
          :key="booking.id"
          class="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          data-testid="rooms-booking"
        >
          <span class="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-foreground">
            <Clock :size="13" class="text-muted-foreground" />{{ booking.start }}–{{ booking.end }}
          </span>
          <span class="min-w-0 flex-1 truncate text-[13px] text-foreground">{{ booking.title }}</span>
          <span class="shrink-0 text-[12px] text-muted-foreground">{{ booking.organizer }}</span>
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('rooms.cancel_booking')"
            @click="storeRemoveBooking(booking.id)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
      <p
        v-else
        class="rounded-xl border border-dashed border-border py-8 text-center text-[13px] text-muted-foreground"
      >
        {{ t('rooms.no_bookings') }}
      </p>
    </template>
  </WorkspacePageFrame>
</template>
