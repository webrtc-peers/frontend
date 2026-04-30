<template>
	<nav class="rtc-room">
		<div class="btns">
			<button type="text" @click="dialogVisible = true">创建房间</button>
		</div>
		<ul v-if="rooms" class="rooms">
			<li
				v-for="(val, key) in rooms"
				:key="key"
				@click="jion(key)"
				:class="{ picked: picked === key }"
			>
				<div class="info">
					<div class="name">
						{{ val.explain.name }}
					</div>
					<div class="tips" v-if="val.explain.tips">
						{{ val.explain.tips }}
					</div>
				</div>
				<img src="@/assets/lock.svg" v-if="val.explain.secret" class="lock" />
			</li>
		</ul>
		<transition name="v-dialog">
			<VDialog v-if="dialogVisible" class="create-room-dialog">
				<template #title>创建房间</template>
				<template #body>
					<VRow class="room-name">
						<template #left>
							<span>房间名:</span>
						</template>
						<template #right>
							<VInput v-model="name"></VInput>
						</template>
					</VRow>
					<VRow class="room-tips">
						<template #left>
							<span>房间描述:</span>
						</template>
						<template #right>
							<VInput v-model="tips"></VInput>
						</template>
					</VRow>
					<VRow class="room-tips">
						<template #left>
							<span>密码:</span>
						</template>
						<template #right>
							<VInput v-model="secret"></VInput>
						</template>
					</VRow>
				</template>
				<template #footer>
					<button @click="dialogVisible = false" class="cancel">取 消</button>
					<button @click="createRoom" class="conf">确 定</button>
				</template>
			</VDialog>
		</transition>
		<transition name="v-dialog">
			<VDialog v-if="secretDialog">
				<template #title>
					请输入密码
				</template>
				<template #body>
					<VInput v-model="fillSecret" v-model:error="secretError"></VInput>
				</template>
				<template #footer>
					<button @click="secretDialog = false" class="cancel">取 消</button>
					<button @click="confSecret" class="conf">确 定</button>
				</template>
			</VDialog>
		</transition>
	</nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import socket from '@/socket'
import { v4 as uuidv4 } from 'uuid'
import { toast } from '@/tools/utils'
import VDialog from '@/components/v-dialog.vue'
import VInput from '@/components/v-input.vue'
import VRow from '@/components/v-row.vue'

interface UserInfo {
	nickName?: string
	account?: string
}

interface RoomExplain {
	name: string
	tips: string
	secret: string
}

interface RoomInfo {
	explain: RoomExplain
	socketIds?: Array<{ id: string }>
}

type RoomsMap = Record<string, RoomInfo>

const emit = defineEmits<{
	(e: 'create-room', payload: { explain: RoomExplain; roomid: string }): void
	(e: 'call', payload: { roomid: string; roomInfo: RoomInfo }): void
	(e: 'show-video'): void
}>()

const user = computed<UserInfo | null>(() => null)
const rooms = ref<RoomsMap | null>(null)
const dialogVisible = ref(false)
const name = ref(user.value?.nickName || user.value?.account || '')
const tips = ref('')
const picked = ref('')
const secret = ref('')
const fillSecret = ref('')
const secretDialog = ref(false)
const secretError = ref('')
const inRoomid = ref('')

function createRoom() {
	let roomName = name.value
	if (!roomName && user.value) {
		roomName = user.value.nickName || user.value.account || ''
	}
	picked.value = uuidv4()
	inRoomid.value = picked.value
	dialogVisible.value = false
	emit('create-room', {
		explain: { name: roomName, tips: tips.value, secret: secret.value },
		roomid: picked.value,
	})
}

function jion(nextPicked: string) {
	if (!nextPicked) {
		return toast('请先选择房间')
	}
	picked.value = nextPicked
	const data = rooms.value?.[nextPicked]
	if (!data) return
	if (inRoomid.value === nextPicked) {
		return emit('show-video')
	}

	if (fillSecret.value !== data.explain.secret) {
		secretDialog.value = true
		return
	}
	secretDialog.value = false
	inRoomid.value = nextPicked
	emit('call', { roomid: nextPicked, roomInfo: data })
}

function confSecret() {
	const data = rooms.value?.[picked.value]
	if (!data) return
	if (fillSecret.value !== data.explain.secret) {
		secretError.value = '密码错误'
		return
	}
	jion(picked.value)
}

const handleRooms = (nextRooms: RoomsMap) => {
	rooms.value = nextRooms
}

socket.on('rooms', handleRooms)

onBeforeUnmount(() => {
	socket.off('rooms', handleRooms)
})
</script>
<style lang="scss">
.rtc-room {
	.v-dialog {
		.v-dialog-body {
			max-width: 600px;
			min-width: 360px;
			width: 80%;
			margin: 10vh auto 0;
			background: #fff;

			padding: 20px;

			.v-dialog-title {
				padding-bottom: 20px;
			}

			.v-dialog-footer {
				justify-content: flex-end;
			}
			button:not(:first-child) {
				margin-left: 20px;
			}
		}
	}

	.rooms {
		border: 1px solid #ccc;
		min-height: 300px;
		li {
			padding: 5px 10px;
			cursor: pointer;
			position: relative;
			color: #606266;
			margin-bottom: 5px;
			.lock {
				width: 30px;
				position: absolute;
				right: 5px;
				top: 10px;
			}

			&:hover,
			&.picked {
				background: #e4e7ed;
				color: #409eff;

				.tips {
					color: #909399;
				}
			}
		}
	}

	.name {
		font-size: 16px;
	}
	.tips {
		font-size: 12px;
		color: #999;
	}
	.btns {
		display: flex;
		justify-content: space-around;
		button {
			background: #fff;
			border: none;
			color: #409eff;
			&:hover {
				color: #409eff;
			}
		}
	}
	input {
		height: 30px;
	}

	.v-row {
		grid-template-columns: 70px 1fr;
	}
	.room-tips {
		margin-top: 20px;
	}
}
</style>
