# webrtc-peers
基于 webrtc的网页多人视频

地址：https://webrtc.web-play.cn

## 本地开发

1. 启动信令服务：`cd server && npm install && node index.mjs`
2. 启动前端：`cd frontend && npm install && npm run dev`

前端在 dev 环境下会默认连接到当前页面主机的 `9000` 端口。

可选环境变量：

- `VITE_SIGNALING_PORT`：覆盖 dev 默认端口，默认 `9000`
- `VITE_SIGNALING_URL`：显式指定完整信令地址，例如 `http://127.0.0.1:9000`
