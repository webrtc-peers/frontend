import { createRouter, createWebHistory } from 'vue-router'

// 页面只有一套布局，路由只用来在地址上记录当前房间，不渲染组件
const Empty = { render: () => null }

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Empty },
    { path: '/room/:roomid([\\w-]{1,64})', name: 'room', component: Empty },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
