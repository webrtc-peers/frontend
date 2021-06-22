<template>
	<ul class="content" ref="chat">
		<i-viewer :images="images" class="images">
			<li :class="{ 'is-self': val.isSelf }" v-for="(val, index) in chats" :key="index">
				<div class="user">{{ val.isSelf ? '我' : val.user }}</div>
				<div class="msg-content">
					<span class="text" v-html="val.msg" v-if="val.type === 'text'"></span>

					<video
						v-else-if="val.type === 'video'"
						class="chat-video"
						:hash="val.hash"
						:src="val.file"
						controls
					></video>
					<img v-else-if="val.type === 'img'" class="img" :src="val.file" />
					<div v-else class="chat-file">
						<div class="file-info">
							<v-icon class="file-icon" :name="getIcon(val.fileName)"></v-icon>
							<!-- <i class="icon-file iconfont file-icon" ></i> -->
							<span class="file-name">{{ val.fileName }}</span>
						</div>
						<v-progress
							v-if="val.percent !== 1"
							:percentage="+(val.percent * 100).toFixed(2)"
							color="#8e71c7"
						></v-progress>
						<v-progress v-else :percentage="100" color="#8e71c7" status="success"></v-progress>
					</div>
				</div>
			</li>
		</i-viewer>
	</ul>
</template>

<script>
import IViewer from 'v-viewer/src/component'
import 'viewerjs/dist/viewer.css'
export default {
	components: { IViewer },
	props: { chats: Array, isMobile: Boolean },
	computed: {
		images() {
			let arr = []
			for (let i = 0; i < this.chats.length; i++) {
				if (this.chats[i].type === 'img') {
					arr.push(this.chats[i].file)
				}
			}
			return arr
		},
	},
	methods:{
		getIcon(filename) {
			const arr = filename.split('.')
			const ext = arr[arr.length-1]
			if(ext.includes('ppt')) return '#icon-ppt'
			if(ext.includes('xl')) return '#icon-excel'
			if(ext.includes('doc')) return '#icon-docx'
			return '#icon-zip'
		}
	},
	watch: {
		async 'chats.length'() {
			const div = this.$refs.chat
			if(div.scrollHeight - div.scrollTop - div.clientHeight > 10) return
			await this.$nextTick()
			this.$refs.chat.scrollTop = this.$refs.chat.scrollHeight
		},
	},
	mounted() {
		this.$refs.chat.scrollTop = this.$refs.chat.scrollHeight
	}
}
</script>

<style lang="scss">
.file-info {
	display: flex;
	width: 100%;
	align-items: flex-end;
	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>
