// 単価メモ の更新用ファイル
// 同じGitHubアカウントの残業メモ・ゲット図鑑と場所を共有するため、
// 「tanka-memo-」で始まる自分の保管分だけを扱い、ほかのアプリの分には触れない。
var CACHE_PREFIX = "tanka-memo-";
var CACHE_NAME = CACHE_PREFIX + "v1";
var FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // ネット上の最新版を取りにいく（端末の一時保存は使わない）
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isPageRequest(request) {
  if (request.mode === "navigate") return true;
  var url = request.url;
  return url.indexOf("index.html") !== -1 || url.charAt(url.length - 1) === "/";
}

function fetchAndCache(request, fresh) {
  // 画面のファイルは、毎回GitHubに新しい版がないか確認する
  var p = fresh ? fetch(request.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(request);
  return p.then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  // このアプリの範囲外（残業メモ・ゲット図鑑など）の読み込みには関与しない
  if (event.request.url.indexOf(self.registration.scope) !== 0) return;

  if (isPageRequest(event.request)) {
    // 画面はネット優先：開くたびに新しい版を確認し、つながらない時（電波の弱い店内など）は保存分を使う
    event.respondWith(
      fetchAndCache(event.request, true).catch(function () {
        return caches.match(event.request).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
  } else {
    // アイコンなどは保存分優先
    event.respondWith(
      caches.match(event.request).then(function (hit) {
        return hit || fetchAndCache(event.request);
      })
    );
  }
});
