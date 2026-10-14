<template>
	<nav class="rtc-room">
		<button type="button" class="btn btn-primary btn-lg btn-block" @click="openCreate">
			<Plus />新建房间
		</button>

		<div class="section-title">
			<span>全部房间</span>
			<span class="count">{{ roomList.length }}</span>
		</div>

		<ul v-if="roomList.length" class="rooms">
			<li v-for="item in roomList" :key="item.id">
				<button
					type="button"
					class="room-card"
					:class="{ active: currentRoomId === item.id }"
					@click="jion(item.id)"
				>
					<span class="room-avatar">
						{{ roomName(item.info).slice(0, 1) }}
					</span>
					<span class="info">
						<span class="name">
							<span class="name-text">{{ roomName(item.info) }}</span>
							<Lock v-if="item.info.explain.locked" class="lock" />
						</span>
						<span class="tips">{{ item.info.explain.tips || '暂无描述' }}</span>
					</span>
					<span v-if="currentRoomId === item.id" class="badge live">通话中</span>
					<span v-else class="badge">
						<Users />{{ item.info.socketIds?.length ?? 0 }}
					</span>
				</button>
			</li>
		</ul>
		<div v-else class="rooms-empty">
			<div class="rooms-empty-icon"><DoorOpen /></div>
			<p class="rooms-empty-title">还没有房间</p>
			<p class="rooms-empty-desc">新建一个房间，邀请好友加入</p>
		</div>

		<VDialog v-model:open="dialogVisible">
			<template #title>新建房间</template>
			<template #desc>所有成员离开后，房间会自动销毁</template>
			<template #body>
				<form id="create-room-form" class="room-form" @submit.prevent="createRoom">
					<label class="field">
						<span class="field-label">房间名称</span>
						<VInput v-model="name" placeholder="例如：周五产品会" maxlength="30" autofocus />
					</label>
					<label class="field">
						<span class="field-label">房间描述<em>可选</em></span>
						<VInput v-model="tips" placeholder="一句话介绍这个房间" maxlength="60" />
					</label>
					<label class="field">
						<span class="field-label">访问密码<em>可选</em></span>
						<VInput v-model="secret" placeholder="留空则任何人都可加入" autocomplete="off" />
					</label>
				</form>
			</template>
			<template #footer>
				<button type="button" class="btn btn-ghost" @click="dialogVisible = false">取消</button>
				<button type="submit" form="create-room-form" class="btn btn-primary">创建并进入</button>
			</template>
		</VDialog>

		<VDialog v-model:open="secretDialog">
			<template #title>请输入密码</template>
			<template #desc>「{{ pickedRoomName }}」需要密码才能加入</template>
			<template #body>
				<form id="room-secret-form" @submit.prevent="confSecret">
					<VInput
						v-model="fillSecret"
						v-model:error="secretError"
						type="password"
						placeholder="房间密码"
						autocomplete="off"
						autofocus
					/>
				</form>
			</template>
			<template #footer>
				<button type="button" class="btn btn-ghost" @click="secretDialog = false">取消</button>
				<button type="submit" form="room-secret-form" class="btn btn-primary">加入房间</button>
			</template>
		</VDialog>
	</nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { DoorOpen, Lock, Plus, Users } from '@lucide/vue'
import socket from '@/socket'
import { v4 as uuidv4 } from 'uuid'
import { toast } from '@/tools/utils'
import VDialog from '@/components/v-dialog.vue'
import VInput from '@/components/v-input.vue'

// 建房时带 secret；服务端广播的房间列表里只有 locked，密码不出服务端
interface RoomExplain {
	name: string
	tips: string
	secret?: string
	locked?: boolean
}

interface RoomInfo {
	explain: RoomExplain
	roomid?: string
	socketIds?: Array<{ id: string }>
}

type RoomsMap = Record<string, RoomInfo>

const props = defineProps<{
	currentRoomId?: string
}>()

const emit = defineEmits<{
	(e: 'create-room', payload: { explain: RoomExplain; roomid: string }): void
	(e: 'call', payload: { roomid: string; roomInfo: RoomInfo & { roomid: string }; secret: string }): void
}>()

const rooms = ref<RoomsMap | null>(null)
const dialogVisible = ref(false)
const name = ref('')
const tips = ref('')
const picked = ref('')
const secret = ref('')
const fillSecret = ref('')
const secretDialog = ref(false)
const secretError = ref('')

const roomList = computed(() => Object.entries(rooms.value ?? {}).map(([id, info]) => ({ id, info })))
const pickedRoomName = computed(() => {
	const info = rooms.value?.[picked.value]
	return info ? roomName(info) : ''
})

function roomName(info: RoomInfo) {
	return info.explain.name || '未命名房间'
}

function openCreate() {
	dialogVisible.value = true
}

function createRoom() {
	picked.value = uuidv4()
	dialogVisible.value = false
	emit('create-room', {
		explain: { name: name.value.trim(), tips: tips.value.trim(), secret: secret.value },
		roomid: picked.value,
	})
	name.value = ''
	tips.value = ''
	secret.value = ''
}

function jion(nextPicked: string) {
	if (!nextPicked) {
		return toast('请先选择房间')
	}
	const data = rooms.value?.[nextPicked]
	if (!data) return
	if (props.currentRoomId === nextPicked) return

	picked.value = nextPicked
	if (data.explain.locked) {
		fillSecret.value = ''
		secretError.value = ''
		secretDialog.value = true
		return
	}
	enter(nextPicked, '')
}

function enter(roomid: string, roomSecret: string) {
	const data = rooms.value?.[roomid]
	if (!data) return
	secretDialog.value = false
	emit('call', { roomid, roomInfo: { ...data, roomid }, secret: roomSecret })
}

// 密码由服务端校验，结果在 check-secret 回包里
function confSecret() {
	if (!rooms.value?.[picked.value]) return
	socket.emit('check-secret', { roomid: picked.value, secret: fillSecret.value })
}

const handleCheckSecret = ({ roomid, ok }: { roomid: string; ok: boolean }) => {
	if (roomid !== picked.value || !secretDialog.value) return
	if (!ok) {
		secretError.value = '密码错误'
		return
	}
	enter(roomid, fillSecret.value)
}

const handleRooms = (nextRooms: RoomsMap) => {
	rooms.value = nextRooms
}

socket.on('rooms', handleRooms)
socket.on('check-secret', handleCheckSecret)

onBeforeUnmount(() => {
	socket.off('rooms', handleRooms)
	socket.off('check-secret', handleCheckSecret)
})

defineExpose({ openCreate })
</script>

<style lang="scss">
.rtc-room {
	display: flex;
	flex-direction: column;
	gap: 16px;
	min-height: 0;
	flex: 1;

	.section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 4px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--text-3);

		.count {
			padding: 0 7px;
			border-radius: 99px;
			font-size: 11px;
			line-height: 18px;
			letter-spacing: 0;
			color: var(--text-2);
			background: var(--surface-hover);
		}
	}

	.rooms {
		display: flex;
		flex-direction: column;
		gap: 4px;

		@media (max-width: 767px) {
			gap: 10px;
		}

		min-height: 0;
		margin: -4px -6px 0;
		padding: 4px 6px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.room-card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px;
		border-radius: var(--radius);
		border: 1px solid transparent;
		text-align: left;
		transition:
			background-color 0.2s,
			border-color 0.2s;

		&:hover {
			background: var(--surface-hover);
		}

		&.active {
			background: var(--accent-soft);
			border-color: rgb(217 164 65 / 0.4);
		}

		@media (max-width: 767px) {
			padding: 12px;
			border-color: var(--border);
			background: var(--surface);
		}
	}

	.room-avatar {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		flex: none;
		border-radius: 12px;
		font-size: 17px;
		font-weight: 650;
		color: var(--text);
		background: var(--surface-active);
	}

	.info {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}

	.name-text,
	.tips {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lock {
		width: 13px;
		height: 13px;
		flex: none;
		color: var(--text-2);
	}

	.tips {
		font-size: 12px;
		color: var(--text-3);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex: none;
		padding: 2px 8px;
		border-radius: 99px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--text-2);
		background: var(--surface);

		svg {
			width: 12px;
			height: 12px;
		}

		&.live {
			color: var(--success);
			background: var(--success-soft);
		}
	}

	.rooms-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px 16px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		text-align: center;
	}

	.rooms-empty-icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-bottom: 12px;
		border-radius: 14px;
		color: var(--text-2);
		background: var(--surface-hover);

		svg {
			width: 22px;
			height: 22px;
		}
	}

	.rooms-empty-title {
		font-weight: 600;
		color: var(--text);
	}

	.rooms-empty-desc {
		margin-top: 2px;
		font-size: 13px;
		color: var(--text-3);
	}
}

.room-form {
	display: flex;
	flex-direction: column;
	gap: 16px;

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-2);

		em {
			margin-left: 6px;
			font-style: normal;
			font-weight: 400;
			color: var(--text-3);
		}
	}
}
</style>
