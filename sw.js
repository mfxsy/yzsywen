// sw.js - 半缓存版本（离线可用 + 每次自动更新）
const CACHE_NAME = 'chuanxun-cache';

// 安装时预缓存所有核心文件（保证断网也能打开）
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => 
      cache.addAll([
        'index.html',
        'css/styles.css',
        'js/config.js',
        'js/utils.js',
        'js/state.js',
        'js/core.js',
        'js/session-manager.js',
        'js/card-manager.js',
        'js/emoji-manager.js',
        'js/avatar-manager.js',
        'js/quote-manager.js',
        'js/frequency-manager.js',
        'js/call-manager.js',
        'js/backup-panel.js',
        'js/listeners.js',
        'js/app.js'
      ])
    )
  );
  self.skipWaiting(); // 让新版本立即激活
});

// 激活时清理旧缓存，并立刻接管页面
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    )).then(() => self.clients.claim())
  );
});

// 拦截请求：有网就去服务器拿最新，没网就用缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 如果网络请求成功，更新缓存并返回最新文件
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
        return response;
      })
      .catch(() => caches.match(event.request)) // 断网时使用旧缓存
  );
});