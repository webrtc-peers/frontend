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
				<img src="~assets/lock.svg" v-if="val.explain.secret" class="lock" />
			</li>
		</ul>
		<transition name="v-dialog">
			<v-dialog v-if="dialogVisible" class="create-room-dialog">
				<template #title>创建房间</template>
				<template #body>
					<v-row class="room-name">
						<span slot="left">房间名:</span>
						<v-input slot="right" v-model="name"></v-input>
					</v-row>
					<v-row class="room-tips">
						<span slot="left">房间描述:</span>
						<v-input slot="right" v-model="tips"></v-input>
					</v-row>
					<v-row class="room-tips">
						<span slot="left">密码:</span>
						<v-input slot="right" v-model="secret"></v-input>
					</v-row>
				</template>
				<template #footer>
					<button @click="dialogVisible = false" class="cancel">取 消</button>
					<button @click="createRoom" class="conf">确 定</button>
				</template>
			</v-dialog>
		</transition>
		<transition name="v-dialog">
			<v-dialog v-if="secretDialog">
				<template #title>
					请输入密码
				</template>
				<template #body>
					<v-input v-model="fillSecret" :error.sync="secretError"></v-input>
				</template>
				<template #footer>
					<button @click="secretDialog = false" class="cancel">取 消</button>
					<button @click="confSecret" class="conf">确 定</button>
				</template>
			</v-dialog>
		</transition>
	</nav>
</template>

<script>
import socket from '@/socket'
import uuid from 'uuid/v4'
import { toast } from '@/tools/utils'
export default {
	computed: {
		user() {
			return this.$store.state.user
		},
	},
	data() {
		return {
			rooms: null,
			dialogVisible: false,
			name: this.user && (this.user.nickName || this.user.account),
			tips: '',
			picked: '',
			secret: '',
			fillSecret: '',
			secretDialog: false,
			secretError: '',
		}
	},
	methods: {
		createRoom() {
			let name = this.name
			if (!name) {
				name = this.user.nickName || this.user.account
			}
			this.picked = uuid()
			this.inRoomid = this.picked
			this.dialogVisible = false
			this.$emit('create-room', {
				explain: { name, tips: this.tips, secret: this.secret },
				roomid: this.picked,
			})
		},

		jion(picked) {
			if (!picked) {
				return toast('请先选择房间')
      }
      this.picked = picked
			const data = this.rooms[picked]
			if (this.inRoomid === picked) {
				return this.$emit('show-video')
			}

			if (this.fillSecret !== data.explain.secret) {
				return (this.secretDialog = true)
			}
			this.secretDialog = false
			this.inRoomid = picked
			this.$emit('call', { roomid: picked, roomInfo: data })
		},

		confSecret() {
			const data = this.rooms[this.picked]
			if (this.fillSecret !== data.explain.secret) {
				return (this.secretError = '密码错误')
			}
			this.jion(this.picked)
		},
	},
	created() {
		this._rooms = rooms => {
			this.rooms = rooms
		}

		socket.on('rooms', this._rooms)
	},
	beforeDestroy() {
		socket.off('rooms', this._rooms)
	},
}
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
