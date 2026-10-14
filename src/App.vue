<template>
  <div :class="['web-rtc', { 'in-room': room, 'chat-open': room && isChatOpen }]">
    <aside class="sidebar">
      <header class="brand">
        <div class="brand-logo"><MessagesSquare /></div>
        <div class="brand-text">
          <strong>简单聊</strong>
          <span>即建即毁的安全音视频聊天</span>
        </div>
      </header>
      <Rooms
        ref="roomsRef"
        :current-room-id="room?.roomid"
        @create-room="createRoom"
        @call="call"
      ></Rooms>
      <footer class="sidebar-foot">
        <ShieldCheck />WebRTC 点对点加密传输
      </footer>
    </aside>

    <main class="stage">
      <transition name="room-view">
        <div class="room-view" v-if="room">
          <header class="stage-bar">
            <div class="room-meta">
              <h1 class="room-title">
                <span class="live-dot"></span>
                <span class="room-title-text">{{ roomName }}</span>
              </h1>
              <p class="room-desc" v-if="room.explain.tips">{{ room.explain.tips }}</p>
            </div>
            <span class="pill"><Users />{{ peersLength + 1 }} 人</span>
          </header>

          <Play class="stage-media" :streams="streams">
            <template #empty>
              <div class="stage-empty">
                <div class="stage-empty-orb">
                  <VideoOff v-if="peersLength" />
                  <Users v-else />
                </div>
                <h2>{{ peersLength ? "还没有人开启画面" : "等待其他人加入" }}</h2>
                <p v-if="peersLength">打开摄像头或共享屏幕，开始视频通话</p>
                <p v-else>让好友在房间列表里找到「{{ roomName }}」即可加入</p>
              </div>
            </template>
          </Play>

          <footer class="controls">
            <div class="controls-bar">
              <button
                type="button"
                class="ctrl"
                :class="{ on: slefVideoBtnStatus.audio }"
                :disabled="pendingMedia === 'audio'"
                :aria-pressed="slefVideoBtnStatus.audio"
                :data-tip="slefVideoBtnStatus.audio ? '关闭麦克风' : '开启麦克风'"
                :aria-label="slefVideoBtnStatus.audio ? '关闭麦克风' : '开启麦克风'"
                @click="selfMediaStatusChange('audio')"
              >
                <Mic v-if="slefVideoBtnStatus.audio" />
                <MicOff v-else />
              </button>
              <button
                type="button"
                class="ctrl"
                :class="{ on: slefVideoBtnStatus.video }"
                :disabled="pendingMedia === 'video'"
                :aria-pressed="slefVideoBtnStatus.video"
                :data-tip="slefVideoBtnStatus.video ? '关闭摄像头' : '开启摄像头'"
                :aria-label="slefVideoBtnStatus.video ? '关闭摄像头' : '开启摄像头'"
                @click="selfMediaStatusChange('video')"
              >
                <VideoIcon v-if="slefVideoBtnStatus.video" />
                <VideoOff v-else />
              </button>
              <button
                v-if="canShareScreen"
                type="button"
                class="ctrl"
                :class="{ on: slefVideoBtnStatus.desktopShare }"
                :disabled="pendingMedia === 'desktopShare'"
                :aria-pressed="slefVideoBtnStatus.desktopShare"
                :data-tip="slefVideoBtnStatus.desktopShare ? '停止共享' : '共享屏幕'"
                :aria-label="slefVideoBtnStatus.desktopShare ? '停止共享' : '共享屏幕'"
                @click="selfMediaStatusChange('desktopShare')"
              >
                <MonitorUp />
              </button>
              <button
                v-if="isMobileView"
                type="button"
                class="ctrl"
                :class="{ on: slefVideoBtnStatus.cameraSwitch }"
                :aria-pressed="slefVideoBtnStatus.cameraSwitch"
                aria-label="切换摄像头"
                @click="selfMediaStatusChange('cameraSwitch')"
              >
                <SwitchCamera />
              </button>
              <span class="ctrl-divider"></span>
              <button
                type="button"
                class="ctrl"
                :class="{ on: isChatOpen }"
                :aria-pressed="isChatOpen"
                :data-tip="isChatOpen ? '收起聊天' : '打开聊天'"
                :aria-label="isChatOpen ? '收起聊天' : '打开聊天'"
                @click="isChatOpen = !isChatOpen"
              >
                <MessageSquareText />
                <span class="ctrl-badge" v-if="notReadMessage">
                  {{ notReadMessage > 99 ? "99+" : notReadMessage }}
                </span>
              </button>
              <button
                type="button"
                class="ctrl ctrl-leave"
                data-tip="离开房间"
                aria-label="离开房间"
                @click="leaveRoom"
              >
                <PhoneOff />
              </button>
            </div>
          </footer>
        </div>

        <section class="welcome" v-else>
          <div class="welcome-hero">
            <div class="welcome-orb"><VideoIcon /></div>
            <h1>简单聊，让聊天更简单</h1>
            <p>
              无需注册，新建一个房间就能和好友视频通话、共享屏幕、互传文件。
            </p>
            <button type="button" class="btn btn-primary btn-lg" @click="roomsRef?.openCreate()">
              <Plus />新建房间
            </button>
          </div>
          <ul class="welcome-features">
            <li>
              <ShieldCheck />
              <div>
                <strong>加密直连</strong>
                <span>音视频与文件点对点传输</span>
              </div>
            </li>
            <li>
              <Zap />
              <div>
                <strong>即建即毁</strong>
                <span>成员全部离开后房间自动销毁</span>
              </div>
            </li>
            <li>
              <MonitorUp />
              <div>
                <strong>屏幕共享</strong>
                <span>一键共享桌面或窗口</span>
              </div>
            </li>
          </ul>
        </section>
      </transition>
    </main>

    <div class="chat-dock" :class="{ open: isChatOpen }" :inert="!isChatOpen" v-if="room">
      <div class="chat-backdrop" @click="isChatOpen = false"></div>
      <Chat
        class="chat-panel"
        :chats="chats"
        :isMobile="isMobileView"
        :disabled="!peersLength"
        @send="send"
        @close="isChatOpen = false"
      ></Chat>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import {
  MessageSquareText,
  MessagesSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Plus,
  ShieldCheck,
  SwitchCamera,
  Users,
  Video as VideoIcon,
  VideoOff,
  Zap,
} from "@lucide/vue";
import Rooms from "@/views/rooms.vue";
import RTCManager from "@/views/rtc-manager";
import Chat from "@/views/chat/index.vue";
import { isMobile } from "@/tools";
import { toast } from "@/tools/utils";
import Play from "@/views/play.vue";
import socket from "@/socket";

interface StreamWithType extends MediaStream {
  isSelf?: boolean;
}

interface ChatMessage {
  hash?: string;
  msg?: string;
  user?: string;
  type?: "text" | "file" | "video" | "img";
  file?: string | Blob | File;
  fileName?: string;
  isSelf?: boolean;
  percent?: number;
  total?: number;
  sendSize?: number;
  pendingSize?: number;
  size?: number;
}

interface RoomExplain {
  name: string;
  tips: string;
  secret?: string;
  locked?: boolean;
}

interface RoomPayload {
  explain: RoomExplain;
  roomid: string;
  socketIds?: Array<{ id: string }>;
}

interface SendFilePayload {
  type: "file" | "video" | "img";
  file: File | Blob;
  fileName?: string;
  hash: string;
  [key: string]: unknown;
}

interface SendPayload {
  texts: string[];
  files: SendFilePayload[];
}

interface FileProgressEvent {
  desc: ChatMessage;
  percent: number;
}

interface RTCManagerLike {
  on: (event: string, handler: (...args: never[]) => void) => RTCManagerLike;
  off: (
    event: string,
    handler?: (...args: never[]) => void,
  ) => RTCManagerLike | false;
  clear: () => void;
  createRoom: (data: RoomPayload) => void;
  call: (data: { roomid: string; explain: RoomExplain; secret?: string }) => void;
  leave: () => void;
  setSelfMediaStatus: (config: Record<string, boolean>) => Promise<unknown>;
  dcData: {
    on: (
      event: string,
      handler: (...args: never[]) => void,
    ) => RTCManagerLike["dcData"];
    off: (
      event: string,
      handler?: (...args: never[]) => void,
    ) => RTCManagerLike["dcData"] | false;
    emit: (
      event: string,
      data: unknown,
      desc?: Record<string, unknown>,
    ) => void;
  };
  dcFile: {
    on: (
      event: string,
      handler: (...args: never[]) => void,
    ) => RTCManagerLike["dcFile"];
    off: (
      event: string,
      handler?: (...args: never[]) => void,
    ) => RTCManagerLike["dcFile"] | false;
    emit: (
      event: string,
      data: File | Blob,
      desc?: Record<string, unknown>,
    ) => (
      progress: (event: {
        total: number;
        sendSize: number;
        percent: number;
      }) => void,
    ) => void;
  };
}

declare global {
  interface Window {
    rtcManager: RTCManagerLike;
  }
}

type MediaKey = "audio" | "video" | "desktopShare" | "cameraSwitch";

const rtcManager = new RTCManager() as unknown as RTCManagerLike;

window.rtcManager = rtcManager;

const streams = ref<StreamWithType[]>([]);
const chats = ref<ChatMessage[]>([]);
const peersLength = ref(0);
const slefVideoBtnStatus = reactive<Record<MediaKey, boolean>>({
  audio: false,
  desktopShare: false,
  video: false,
  cameraSwitch: false,
});
const room = ref<RoomPayload | null>(null);
const roomsRef = ref<InstanceType<typeof Rooms> | null>(null);
const isChatOpen = ref(false);
const notReadMessage = ref(0);
const pendingMedia = ref<MediaKey | null>(null);
const isMobileView = computed(() => isMobile);
const isWide = useMediaQuery("(min-width: 1200px)");
const roomName = computed(() => room.value?.explain.name || "未命名房间");
// 手机浏览器基本不支持 getDisplayMedia，直接隐藏入口
const canShareScreen = Boolean(navigator.mediaDevices?.getDisplayMedia);

function useMediaQuery(query: string) {
  const mql = window.matchMedia(query);
  const matches = ref(mql.matches);
  const update = (event: MediaQueryListEvent) => {
    matches.value = event.matches;
  };
  mql.addEventListener("change", update);
  onBeforeUnmount(() => mql.removeEventListener("change", update));
  return matches;
}

watch(isChatOpen, (open) => {
  if (open) notReadMessage.value = 0;
});

function addChatMessage(msg: ChatMessage) {
  chats.value.push(msg);
  if (!isChatOpen.value && !msg.isSelf) notReadMessage.value += 1;
}

async function selfMediaStatusChange(type: MediaKey) {
  if (pendingMedia.value) return;
  pendingMedia.value = type;
  try {
    await rtcManager.setSelfMediaStatus({
      ...slefVideoBtnStatus,
      [type]: !slefVideoBtnStatus[type],
    });
    slefVideoBtnStatus[type] = !slefVideoBtnStatus[type];
  } finally {
    pendingMedia.value = null;
  }
}

// 断开所有连接并关闭本地音视频，按钮状态一并复位
function resetConnection() {
  rtcManager.clear();
  void rtcManager.setSelfMediaStatus({
    audio: false,
    video: false,
    desktopShare: false,
  });
  Object.assign(slefVideoBtnStatus, {
    audio: false,
    video: false,
    desktopShare: false,
    cameraSwitch: false,
  });
}

function enterRoom(data: RoomPayload) {
  chats.value = [];
  notReadMessage.value = 0;
  isChatOpen.value = isWide.value;
  room.value = data;
}

function createRoom(data: RoomPayload) {
  resetConnection();
  rtcManager.createRoom(data);
  enterRoom(data);
}

function call({ roomid, roomInfo, secret }: { roomid: string; roomInfo: RoomPayload; secret: string }) {
  resetConnection();
  rtcManager.call({ roomid, explain: roomInfo.explain, secret });
  enterRoom(roomInfo);
}

function leaveRoom() {
  if (!room.value) return;
  rtcManager.leave();
  resetConnection();
  room.value = null;
  chats.value = [];
  isChatOpen.value = false;
  notReadMessage.value = 0;
}

// 点进去时房间已经没人被销毁了（本地列表还没刷新）
function handleRoomMissing() {
  toast("房间已不存在");
  leaveRoom();
}

// 服务端进房时密码校验没过（弹窗校验之后房间被销毁又被别人重建这类极端情况）
function handleRoomDenied() {
  toast("密码错误");
  leaveRoom();
}

function sendTexts(texts: string[]) {
  if (!texts.length) return;
  texts.forEach((text) => {
    const sendData: ChatMessage = {
      msg: text,
      user: socket.id,
      type: "text",
    };
    rtcManager.dcData.emit("chat", sendData);
    getChatText({ ...sendData, isSelf: true });
  });
}

function sendFiles(files: SendFilePayload[]) {
  files.forEach((item) => {
    const { file, ...data } = item;
    // reactive：进度回调直接改这个对象，界面才能跟着刷新
    const chatMsg = reactive<ChatMessage>({
      ...data,
      isSelf: true,
      percent: 0,
      total: 0,
      sendSize: 0,
    });

    if (item.type === "video" || item.type === "img") {
      void getMedia(file, chatMsg);
    } else {
      // File 是对磁盘文件的引用，挂在消息上不占内存，发送端也能点击保存
      chatMsg.file = file;
      addChatMessage(chatMsg);
    }

    const key = {
      video: "chat-video",
      img: "chat-img",
      file: "chat-file",
    }[item.type];

    rtcManager.dcFile.emit(key, file, {
      ...data,
      user: socket.id,
    })((event) => {
      chatMsg.total = event.total;
      chatMsg.sendSize = event.sendSize;
      chatMsg.percent = event.percent;
    });
  });
}

async function getMedia(blob: Blob | File, desc: ChatMessage) {
  const file = URL.createObjectURL(blob);
  desc.file = file;
  addChatMessage(desc);
}

function send(payload: SendPayload) {
  sendFiles(payload.files);
  sendTexts(payload.texts);
}

function getFile(data: Blob, desc: ChatMessage) {
  // 收完的 Blob 留在消息上，由用户点击文件卡片手动保存
  let chat = chats.value.find((item) => item.hash === desc.hash);
  if (!chat) {
    chat = { ...desc, percent: 1 };
    addChatMessage(chat);
  }
  chat.file = data;
}

function getChatText(chat: ChatMessage) {
  addChatMessage(chat);
}

function handleStreamChange(nextStreams: StreamWithType[]) {
  streams.value = nextStreams;
}

function handlePeersChange(peers: unknown[]) {
  peersLength.value = peers.length;
}

function getChatFileProgress(event: FileProgressEvent) {
  let chat = chats.value.find((item) => item.hash === event.desc.hash);
  if (!chat) {
    chat = { ...event.desc, percent: event.percent };
    addChatMessage(chat);
  }
  chat.percent = event.percent;
}

rtcManager
  .on("streams", handleStreamChange)
  .on("peers:change", handlePeersChange)
  .on("room:missing", handleRoomMissing)
  .on("room:denied", handleRoomDenied);
rtcManager.dcData.on("chat", getChatText);
rtcManager.dcFile
  .on("chat-file", getFile)
  .on("chat-file:progress", getChatFileProgress)
  .on("chat-video", getMedia)
  .on("chat-img", getMedia);

onBeforeUnmount(() => {
  rtcManager.off("streams", handleStreamChange);
  rtcManager.off("peers:change", handlePeersChange);
  rtcManager.off("room:missing", handleRoomMissing);
  rtcManager.off("room:denied", handleRoomDenied);
  rtcManager.dcData.off("chat", getChatText);
  rtcManager.dcFile.off("chat-file", getFile);
  rtcManager.dcFile.off("chat-file:progress", getChatFileProgress);
  rtcManager.dcFile.off("chat-video", getMedia);
  rtcManager.dcFile.off("chat-img", getMedia);
});
</script>

<style lang="scss">
/* ---------- App shell ---------- */
.web-rtc {
  --sidebar-w: 300px;
  --chat-w: 360px;
  --gap: 12px;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr) 0px;
  height: 100dvh;
  padding: var(--gap);
  transition: grid-template-columns 0.45s var(--ease);

  &.chat-open {
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr) calc(var(--chat-w) + var(--gap));
  }
}

.sidebar,
.chat-panel {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg);
}

/* ---------- Sidebar ---------- */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
  padding: 20px 16px 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 13px;
  color: var(--accent);
  background: var(--bg-elevated);
  box-shadow: inset 0 1px 0 var(--border-strong);

  svg {
    width: 22px;
    height: 22px;
  }
}

.brand-text {
  min-width: 0;

  strong {
    display: block;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  span {
    display: block;
    font-size: 12px;
    color: var(--text-3);
  }
}

.sidebar-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-3);

  svg {
    width: 14px;
    height: 14px;
    color: var(--success);
  }
}

/* ---------- Stage ---------- */
.stage {
  container: stage / inline-size;
  position: relative;
  min-width: 0;
  margin-left: var(--gap);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg-stage);
  overflow: hidden;
}

.room-view,
.welcome {
  position: absolute;
  inset: 0;
}

.room-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.room-view-enter-active,
.room-view-leave-active {
  transition:
    opacity 0.35s var(--ease),
    transform 0.35s var(--ease);
}

.room-view-enter-from,
.room-view-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

.stage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  padding: 2px 4px;
}

.room-meta {
  min-width: 0;
}

.room-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 650;
}

.room-title-text,
.room-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-desc {
  margin: 2px 0 0 18px;
  font-size: 12px;
  color: var(--text-3);
}

.live-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--success);
  animation: live-ring 2s infinite;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 5px 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  background: var(--surface);

  svg {
    width: 14px;
    height: 14px;
  }
}

.stage-media {
  flex: 1;
}

.stage-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 360px;
  text-align: center;

  h2 {
    font-size: 18px;
    font-weight: 650;
  }

  p {
    font-size: 13px;
    color: var(--text-2);
  }
}

.stage-empty-orb {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  margin-bottom: 16px;
  border-radius: 50%;
  color: var(--text-2);
  background: var(--bg-elevated);
  box-shadow: inset 0 0 0 1px var(--border);

  svg {
    width: 34px;
    height: 34px;
  }
}

/* ---------- Controls ---------- */
.controls {
  display: flex;
  justify-content: center;
  flex: none;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
}

.ctrl {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 50%;
  color: var(--text);
  background: var(--surface-hover);
  transition:
    background-color 0.2s,
    color 0.2s,
    transform 0.15s var(--ease);

  svg {
    width: 21px;
    height: 21px;
  }

  &:hover:not(:disabled) {
    background: var(--surface-active);
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  &.on {
    color: var(--bg);
    background: var(--text);

    &:hover:not(:disabled) {
      background: #f3f4f0;
    }
  }
}

.ctrl-leave {
  width: 64px;
  border-radius: 99px;
  color: #fff;
  background: var(--danger);

  &:hover:not(:disabled) {
    background: var(--danger-hover);
  }
}

.ctrl-divider {
  width: 1px;
  height: 24px;
  margin: 0 2px;
  background: var(--border-strong);
}

.ctrl-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  line-height: 19px;
  text-align: center;
  color: #fff;
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--bg-stage);
}

@media (hover: hover) {
  .ctrl[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text);
    background: var(--bg-elevated);
    opacity: 0;
    translate: -50% 4px;
    pointer-events: none;
    transition:
      opacity 0.15s,
      translate 0.15s var(--ease);
  }

  .ctrl[data-tip]:hover::after {
    opacity: 1;
    translate: -50% 0;
  }
}

/* ---------- Welcome ---------- */
.welcome {
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 48px;
  padding: 40px 32px;
  overflow-y: auto;
  text-align: center;

  h1 {
    font-size: clamp(26px, 4.2cqi, 40px);
    text-wrap: balance;
    font-weight: 750;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--text);
  }

  p {
    max-width: 440px;
    margin: 14px auto 28px;
    text-wrap: balance;
    font-size: 15px;
    color: var(--text-2);
  }
}

.welcome-hero {
  position: relative;
  isolation: isolate;
}

.welcome-orb {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin: 0 auto 28px;
  border-radius: 24px;
  color: var(--text-2);
  background: var(--bg-elevated);
  box-shadow: inset 0 0 0 1px var(--border);
  animation: float 6s ease-in-out infinite;

  svg {
    width: 34px;
    height: 34px;
  }
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: min(760px, 100%);

  li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    text-align: left;
    background: var(--surface);
  }

  svg {
    width: 20px;
    height: 20px;
    flex: none;
    margin-top: 1px;
    color: var(--text-2);
  }

  strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }

  span {
    font-size: 12px;
    color: var(--text-3);
  }

  @container stage (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    width: min(360px, 100%);
  }
}

/* ---------- Chat dock ---------- */
.chat-dock {
  min-width: 0;
  overflow: hidden;
}

.chat-backdrop {
  display: none;
}

.chat-panel {
  width: var(--chat-w);
  height: 100%;
  margin-left: var(--gap);
  overflow: hidden;
}

/* ---------- ≤1199px：聊天改为右侧浮层 ---------- */
@media (max-width: 1199px) {
  .web-rtc {
    --sidebar-w: 268px;

    &,
    &.chat-open {
      grid-template-columns: var(--sidebar-w) minmax(0, 1fr) 0px;
    }
  }

  .chat-dock {
    position: fixed;
    inset: 0;
    z-index: 30;
    overflow: visible;
    pointer-events: none;

    &.open {
      pointer-events: auto;
    }
  }

  .chat-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    opacity: 0;
    transition: opacity 0.35s;

    .open > & {
      opacity: 1;
    }
  }

  .chat-panel {
    position: absolute;
    top: var(--gap);
    right: var(--gap);
    bottom: var(--gap);
    width: min(var(--chat-w), calc(100% - var(--gap) * 2));
    height: auto;
    margin: 0;
    background: var(--bg-elevated);
    box-shadow: var(--shadow);
    transform: translateX(calc(100% + var(--gap) * 2));
    transition: transform 0.45s var(--ease);

    .open > & {
      transform: none;
    }
  }
}

/* ---------- ≤767px：手机 ---------- */
@media (max-width: 767px) {
  .web-rtc {
    display: block;
    padding: 0;
  }

  .sidebar {
    height: 100dvh;
    gap: 22px;
    padding: calc(var(--safe-top) + 24px) calc(var(--safe-right) + 16px)
      calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);
    border: none;
    border-radius: 0;
    background: none;
  }

  .brand-logo {
    width: 46px;
    height: 46px;
  }

  .brand-text strong {
    font-size: 20px;
  }

  .stage {
    position: fixed;
    inset: 0;
    z-index: 10;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    pointer-events: none;
  }

  .welcome {
    display: none;
  }

  .room-view {
    gap: 10px;
    padding: calc(var(--safe-top) + 10px) calc(var(--safe-right) + 10px)
      calc(var(--safe-bottom) + 12px) calc(var(--safe-left) + 10px);
    background: var(--bg-stage);
    pointer-events: auto;
  }

  .room-view-enter-from,
  .room-view-leave-to {
    opacity: 1;
    transform: translateX(100%);
  }

  .stage-bar {
    padding: 4px 6px;
  }

  .controls-bar {
    gap: 6px;
    padding: 6px;
  }

  // 按视口宽度缩放，保证 360px 宽的小屏也能放下一排
  .ctrl {
    width: min(50px, 12.5vw);
    height: min(50px, 12.5vw);
  }

  .ctrl-leave {
    width: min(62px, 15vw);
  }

  .chat-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: min(82dvh, 720px);
    padding-bottom: var(--safe-bottom);
    border-radius: 24px 24px 0 0;
    border-bottom: none;
    transform: translateY(100%);

    // 顶部把手，提示这是一个抽屉
    &::before {
      content: "";
      position: absolute;
      top: 6px;
      left: 50%;
      width: 36px;
      height: 4px;
      border-radius: 4px;
      background: var(--border-strong);
      translate: -50% 0;
    }
  }
}

@keyframes live-ring {
  0% {
    box-shadow: 0 0 0 0 rgb(111 175 126 / 0.6);
  }
  70%,
  100% {
    box-shadow: 0 0 0 7px rgb(111 175 126 / 0);
  }
}

@keyframes float {
  50% {
    transform: translateY(-6px);
  }
}
</style>
