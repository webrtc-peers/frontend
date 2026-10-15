#!/bin/sh
# 在任意目录都能跑：sh frontend/pub.sh 或 ./pub.sh
set -e
cd "$(dirname "$0")"

host=root@web-play.cn
dir=/root/webroot/webrtc-peers/frontend
next=$dir.next

echo '1、打包'
pnpm run build

# 先传到 $next 再整体换上去：打包或上传中途失败都不影响线上；上一版留在 $dir.prev，回滚就换回来
echo '2、上传'
ssh $host "rm -rf $next && mkdir -p $next"
scp -r dist/* $host:$next/

echo '3、切换目录'
ssh $host "rm -rf $dir.prev && mv $dir $dir.prev && mv $next $dir"

echo '前端代码发布完成'
