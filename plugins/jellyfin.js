(function () {
  'use strict';

  if (window.__jellyfinPlugin_loaded) return;
  window.__jellyfinPlugin_loaded = true;

  var STORAGE_PREFIX = 'jellyfin';
  var SETTINGS_COMPONENT = STORAGE_PREFIX;
  var DISPLAY_COMPONENT = STORAGE_PREFIX + 'Display';
  var CATEGORIES_COMPONENT = STORAGE_PREFIX + 'Categories';
  var API_COMPONENT = STORAGE_PREFIX + 'Api';
  var HLS_COMPONENT = STORAGE_PREFIX + 'Hls';
  var BUTTONS_COMPONENT = STORAGE_PREFIX + 'Buttons';
  var PANEL_COMPONENT = STORAGE_PREFIX + 'Panel';
  var HUB_COMPONENT = STORAGE_PREFIX + 'Hub';
  var PHOTO_VIEWER_COMPONENT = STORAGE_PREFIX + 'PhotoViewer';
  var DETAIL_COMPONENT = STORAGE_PREFIX + 'Detail';
  var AUDIO_PLAYER_COMPONENT = STORAGE_PREFIX + 'AudioPlayer';
  var EPISODES_COMPONENT = STORAGE_PREFIX + 'Episodes';
  var HUB_PREVIEW_LIMIT = 12;

  var DEFAULT_URL = '';
  var DEFAULT_API_KEY = '';

  var HTTP_TIMEOUT_MS = 15000;
  var TMDB_TIMEOUT_MS = 10000;
  var TMDB_ENRICH_CONCURRENCY = 8;
  var PAGE_SIZE = 48;
  var IMG_PLACEHOLDER = './img/img_load.svg';
  var API_CACHE_TTL_MS = 30 * 60 * 1000;
  var API_USERDATA_TTL_MS = 3 * 60 * 1000;
  var API_LATEST_TTL_MS = 5 * 60 * 1000;
  var API_CACHE_MAX_ENTRIES = 72;
  var LIBRARY_INDEX_TTL_MS = 10 * 60 * 1000;
  var TMDB_META_TTL_MS = 24 * 60 * 60 * 1000;
  var TMDB_META_MAX_ENTRIES = 400;

  var RETURN_TARGET_KEY = STORAGE_PREFIX + 'Return';
  var RETURN_TARGET_TTL_MS = 60 * 60 * 1000;

  var AUDIO_CACHE_KEY = STORAGE_PREFIX + 'AudioCache';
  var JELLYFIN_ACTIVITY_KEY = STORAGE_PREFIX + 'Activity';
  var WATCH_TARGET_KEY = STORAGE_PREFIX + 'WatchTarget';
  var WATCH_TARGET_TTL_MS = 24 * 60 * 60 * 1000;
  var VIEWER_RESUME_KEY = STORAGE_PREFIX + 'ViewerResume';
  var VIEWER_RESUME_TTL_MS = 24 * 60 * 60 * 1000;
  var ROUTE_CACHE_KEY = STORAGE_PREFIX + 'Route';
  var ROUTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  var ROUTE_MAX_DEPTH = 24;
  var RESTORE_MAX_DEPTH = 5;
  var RESTORE_STEP_DELAY = 120;
  var routeStack = [];
  var routeCacheStoreKey = '';
  var routePending = false;
  var routeRestored = false;
  var routeRebuilding = false;
  var routeRestorePending = false;
  var routePendingTimer = null;
  var routeAdoptStrong = false;
  var routeAdoptTopSig = '';
  var audioReturnTarget = null;
  var jellyfinResumeHandled = false;
  var jellyfinLoadUrl = '';
  try {
    jellyfinLoadUrl = String(window.location.href || '');
  } catch (e) {}

  var RELEASE_FOLDER_RE =
    /(Season\s*\d+)|(S\d{1,2}\s*E\d{0,2}\s*WEB)|WEB-DL|WEBRip|BluRay|2160p|1080p|720p|HDR10|HDR\b|\bDV\b|NOIR\s+VER|COLOR\s+VER|x265|x264/i;

  var JELLYFIN_ICON_PATHS =
    '<path d="M256 196.2c-22.4 0-94.8 131.3-83.8 153.4s156.8 21.9 167.7 0-61.3-153.4-83.9-153.4"/>' +
    '<path d="M256 0C188.3 0-29.8 395.4 3.4 462.2s472.3 66 505.2 0S323.8 0 256 0m165.6 404.3c-21.6 43.2-309.3 43.8-331.1 0S211.7 101.4 256 101.4 443.2 361 421.6 404.3"/>';

  var JELLYFIN_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">' +
    JELLYFIN_ICON_PATHS +
    '</svg>';

  var MANIFEST = {
    type: 'video',
    version: '2.0.0 Beta 5',
    author: 'bibibi-Matrix',
    name: 'Jellyfin',
    description: 'Browse and play your Jellyfin library in Lampa',
    component: SETTINGS_COMPONENT,
    icon:
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 512 512" fill="currentColor">' +
      JELLYFIN_ICON_PATHS +
      '</svg>',
  };

  var FULLSTART_BTN_ICON =
    '<svg class="jellyfin-fullstart__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">' +
    JELLYFIN_ICON_PATHS +
    '</svg>';

  var HEAD_ICON_SVG = JELLYFIN_ICON_SVG;

  var $headIconEl = null;
  var $menuBtnEl = null;

  var cachedUserId = '';
  var cachedAutoUserName = '';
  var libraryIndex = { byTmdb: {}, loadedAt: 0 };
  var tmdbMetaCache = {};
  var tmdbPosterInflight = {};
  var apiResponseCache = {};
  var apiCacheOrder = [];
  var apiInflight = {};
  var apiCacheEpoch = 0;
  var libraryIndexInflight = null;
  var hubDataInflight = null;
  var hubRefreshTimer = null;
  var LOCAL_PROGRESS_KEY = STORAGE_PREFIX + 'Progress';
  var LOCAL_PROGRESS_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  var localProgressCache = null;
  var currentPlaySessionId = '';
  var activePlaySessionIds = {};
  var currentAudioStreamIndex = null;
  var playlistItems = [];
  var playlistBuild = null;
  var currentPlayItemId = null;
  var currentTimelineHash = null;
  var currentPlayRow = null;
  var lastCompletedRowId = null;
  var lastProgressResetRowId = null;
  var lastProgressResetTimer = null;
  var lastLivePlaylistId = null;
  var playlistLiveRows = {};
  var playlistLiveTimer = null;
  var playlistFocusedRow = null;
  var playlistRingFocused = false;
  var playlistKeyHandlerAttached = false;
  var lastPlaybackState = null;
  var externalPlay = null;
  var externalPlayTicker = null;
  var syncingTimelineHash = '';

  function addLang() {
    Lampa.Lang.add({
      jellyfin_title: { en: 'Jellyfin', ru: 'Jellyfin' },
      jellyfin_movies: { en: 'Movies', ru: 'Фильмы' },
      jellyfin_series: { en: 'TV Series', ru: 'Сериалы' },
      jellyfin_resume: { en: 'Continue watching', ru: 'Продолжить просмотр' },
      jellyfin_latest: { en: 'Latest added', ru: 'Недавно добавлено' },
      jellyfin_nextup: { en: 'Next up', ru: 'Далее' },
      jellyfin_recently: { en: 'Recently added in', ru: 'Недавно добавлено в' },
      jellyfin_stat_resume: { en: 'Continue', ru: 'Продолжить' },
      jellyfin_stat_latest: { en: 'Latest', ru: 'Недавние' },
      jellyfin_stat_movies: { en: 'Movies', ru: 'Фильмы' },
      jellyfin_stat_series: { en: 'Series', ru: 'Сериалы' },
      jellyfin_play: { en: 'Play', ru: 'Смотреть' },
      jellyfin_box_contents: { en: 'Contents', ru: 'Содержимое' },
      jellyfin_open_card: { en: 'Open card', ru: 'Открыть карточку' },
      jellyfin_episodes: { en: 'Episodes', ru: 'Эпизоды' },
      jellyfin_pick_episode: { en: 'Choose episode', ru: 'Выберите эпизод' },
      jellyfin_all_seasons: { en: 'All seasons', ru: 'Все сезоны' },
      jellyfin_season: { en: 'Season', ru: 'Сезон' },
      jellyfin_min: { en: 'min', ru: 'мин' },
      jellyfin_empty: { en: 'Library is empty', ru: 'Библиотека пуста' },
      jellyfin_empty_descr: {
        en: 'Add media to Jellyfin or check connection settings',
        ru: 'Добавьте медиа в Jellyfin или проверьте настройки подключения',
      },
      jellyfin_retry: { en: 'Retry', ru: 'Повторить' },
      jellyfin_playlist: { en: 'Playlist', ru: 'Плейлист' },
      jellyfin_settings: { en: 'Settings', ru: 'Настройки' },
      jellyfin_speed: { en: 'Playback speed', ru: 'Скорость воспроизведения' },
      jellyfin_speed_default: { en: 'Normal', ru: 'Обычная' },
      jellyfin_shuffle: { en: 'Shuffle', ru: 'Перемешать' },
      jellyfin_repeat: { en: 'Repeat', ru: 'Повтор' },
      jellyfin_on: { en: 'On', ru: 'Вкл' },
      jellyfin_off: { en: 'Off', ru: 'Выкл' },
      jellyfin_repeat_off: { en: 'Off', ru: 'Выкл' },
      jellyfin_repeat_all: { en: 'All', ru: 'Все' },
      jellyfin_repeat_one: { en: 'One', ru: 'Один' },
      jellyfin_buffer: { en: 'buffer', ru: 'буфер' },
      jellyfin_sec: { en: 'sec', ru: 'сек' },
      jellyfin_open_settings: { en: 'Open settings', ru: 'Открыть настройки' },
      jellyfin_play: { en: 'Watch', ru: 'Смотреть' },
      jellyfin_watch_server: { en: 'Watch from Jellyfin', ru: 'Смотреть Jellyfin' },
      jellyfin_auth_ok: { en: 'Connection OK', ru: 'Подключение успешно' },
      jellyfin_auth_fail: { en: 'Connection failed', ru: 'Не удалось подключиться' },
      jellyfin_test: { en: 'Test connection', ru: 'Проверить подключение' },
      jellyfin_url: { en: 'Server URL', ru: 'URL сервера' },
      jellyfin_key: { en: 'API key', ru: 'API-ключ' },
      jellyfin_no_tmdb: {
        en: 'No TMDB id on this item',
        ru: 'Нет TMDB id у этого элемента',
      },
      jellyfin_person_not_found: {
        en: 'Person not found on TMDB',
        ru: 'Персона не найдена на TMDB',
      },
      jellyfin_error: { en: 'Something went wrong', ru: 'Что-то пошло не так' },
      jellyfin_settings_name: { en: 'Jellyfin', ru: 'Jellyfin' },
      jellyfin_settings_hint: {
        en: 'Jellyfin URL and API key from Dashboard → API Keys',
        ru: 'URL Jellyfin и API-ключ из Панель → Ключи API',
      },
      jellyfin_set_dedupe: {
        en: 'Merge duplicates (TMDB)',
        ru: 'Объединять дубликаты (TMDB)',
      },
      jellyfin_set_hide_folders: {
        en: 'Hide release folders',
        ru: 'Скрывать папки релизов',
      },
      jellyfin_set_tmdb_posters: {
        en: 'TMDB posters & titles',
        ru: 'Постеры и названия из TMDB',
      },
      jellyfin_set_full_button: {
        en: 'Show Jellyfin button on card',
        ru: 'Отобразить кнопку Jellyfin на карточке',
      },
      jellyfin_more: { en: 'More', ru: 'Ещё' },
      jellyfin_libraries: { en: 'Library', ru: 'Библиотека' },
      jellyfin_set_tap_play: {
        en: 'Tap card to play (long = menu)',
        ru: 'Нажатие — смотреть (долгое — меню)',
      },
      jellyfin_set_transcode: {
        en: 'HLS transcoding (Lampa player)',
        ru: 'HLS-транскодинг (плеер Lampa)',
      },
      jellyfin_set_stream_hint: {
        en: 'When on, Lampa player uses HLS transcode with quality selection. External players always use direct stream.',
        ru: 'Если включено, плеер Lampa использует HLS-транскодинг с выбором качества. Внешние плееры всегда получают прямой поток.',
      },
      jellyfin_set_ext_quality: {
        en: 'Quality picker (external players)',
        ru: 'Меню качества (внешние плееры)',
      },
      jellyfin_set_ext_quality_hint: {
        en: 'When on, a popup with video quality options is shown before starting playback in an external player. Selected quality is served via HLS transcode, "Auto" plays the direct stream.',
        ru: 'Если включено, перед запуском во внешнем плеере показывается меню с вариантами качества видео. Выбранное качество отдаётся через HLS-транскодинг, «Авто» — прямой поток.',
      },
      jellyfin_set_categories_hint: {
        en: 'Select which library categories the plugin collects and shows',
        ru: 'Отметьте категории медиатеки, которые плагин собирает и показывает',
      },
      jellyfin_set_categories_btn: {
        en: 'Media library categories',
        ru: 'Категории медиатеки',
      },
      jellyfin_set_api_hint: {
        en: 'Server address and API key are taken from Jellyfin Dashboard → Advanced → API Keys. The plugin uses the same key for all users.',
        ru: 'Адрес сервера и API-ключ берутся из Jellyfin: Панель → Дополнительно → Ключи API. Один ключ используется для всех пользователей.',
      },
      jellyfin_set_api_btn: {
        en: 'Server and user',
        ru: 'Сервер и пользователь',
      },
      jellyfin_set_display_btn: {
        en: 'Interface',
        ru: 'Интерфейс',
      },
      jellyfin_set_buttons_btn: {
        en: 'Buttons display',
        ru: 'Отображение кнопок',
      },
      jellyfin_set_head_btn: {
        en: 'Show Jellyfin button in the top panel',
        ru: 'Отобразить кнопку Jellyfin в верхней панели',
      },
      jellyfin_set_menu_btn: {
        en: 'Show Jellyfin button in the side menu',
        ru: 'Отобразить кнопку Jellyfin в боковом меню',
      },
      jellyfin_set_hls_btn: {
        en: 'HLS transcoding',
        ru: 'HLS-транскодинг',
      },
      jellyfin_set_format: {
        en: 'Transcode format',
        ru: 'Формат транскодинга',
      },
      jellyfin_format_auto: {
        en: 'Auto (recommended)',
        ru: 'Авто (рекомендуется)',
      },
      jellyfin_format_hls_ts: {
        en: 'HLS-TS (h264)',
        ru: 'HLS-TS (h264)',
      },
      jellyfin_format_hls_fmp4: {
        en: 'HLS-fMP4 (h264)',
        ru: 'HLS-fMP4 (h264)',
      },
      jellyfin_format_webm: {
        en: 'WebM / VP9',
        ru: 'WebM / VP9',
      },
      jellyfin_set_max_audio_channels: {
        en: 'Max audio channels (transcode)',
        ru: 'Макс. число аудио-каналов (транскод)',
      },
      jellyfin_audio_channels_2: { en: '2.0 (Stereo)', ru: '2.0 (Стерео)' },
      jellyfin_audio_channels_6: { en: '5.1', ru: '5.1' },
      jellyfin_set_tracks_subs: {
        en: 'Audio tracks & subtitles (transcode)',
        ru: 'Аудио-дорожки и субтитры (транскод)',
      },
      jellyfin_quality_auto: { en: 'Auto', ru: 'Авто' },
      jellyfin_play_from_library: {
        en: 'Play from Jellyfin',
        ru: 'Смотреть из Jellyfin',
      },
      jellyfin_pick_quality: { en: 'Choose quality', ru: 'Выберите качество' },
      jellyfin_play_4k: { en: 'Play 4K', ru: 'Смотреть 4K' },
      jellyfin_play_1080: { en: 'Play 1080p', ru: 'Смотреть 1080p' },
      jellyfin_watched: { en: 'Watched', ru: 'Просмотрено' },
      jellyfin_mark_watched: { en: 'Mark as watched', ru: 'Отметить просмотренным' },
      jellyfin_mark_unwatched: { en: 'Mark as unwatched', ru: 'Снять отметку просмотра' },
      jellyfin_mark_watched_ok: { en: 'Marked as watched', ru: 'Отмечено как просмотрено' },
      jellyfin_mark_unwatched_ok: { en: 'Marked as unwatched', ru: 'Отметка просмотра снята' },
      jellyfin_season_n: { en: 'Season {0}', ru: 'Сезон {0}' },
      jellyfin_user: { en: 'Jellyfin user', ru: 'Пользователь Jellyfin' },
      jellyfin_user_pick: { en: 'Choose user', ru: 'Выбрать пользователя' },
      jellyfin_user_auto: { en: 'First user (auto)', ru: 'Первый пользователь (авто)' },
      jellyfin_mylib: { en: 'My Media', ru: 'Моя медиатека' },
      jellyfin_ct_movies: { en: 'Movies', ru: 'Фильмы' },
      jellyfin_ct_music: { en: 'Music', ru: 'Музыка' },
      jellyfin_ct_tvshows: { en: 'TV Series', ru: 'Сериалы' },
      jellyfin_ct_books: { en: 'Books', ru: 'Книги' },
      jellyfin_ct_homevideos: { en: 'Home videos & photos', ru: 'Домашние видео и фото' },
      jellyfin_ct_musicvideos: { en: 'Music videos', ru: 'Муз. видео' },
      jellyfin_ct_mixed: { en: 'Mixed movies & shows', ru: 'Смешанные фильмы и передачи' },
      jellyfin_ct_default: { en: 'Media', ru: 'Медиатека' },
    });
  }

  function storageStr(suffix, fallback) {
    try {
      var v =
        String(Lampa.Storage.get(STORAGE_PREFIX + suffix) || '').trim() ||
        String(Lampa.Storage.field(STORAGE_PREFIX + suffix) || '').trim();
      if (v) return v;
    } catch (e) { }
    return fallback == null ? '' : String(fallback);
  }

  function storageToggle(suffix, defaultOn) {
    try {
      var v = Lampa.Storage.field(STORAGE_PREFIX + suffix);
      if (v === true) return true;
      if (v === false) return false;
    } catch (e) { }
    return defaultOn !== false;
  }

  function normalizeBase(raw) {
    var s = String(raw || '').trim().replace(/\/+$/, '');
    if (!s.length) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }

  function apiBase() {
    return normalizeBase(storageStr('Url', DEFAULT_URL));
  }

  function apiKey() {
    return storageStr('Key', DEFAULT_API_KEY);
  }

  function apiCacheKey(url) {
    return apiCacheEpoch + '|' + String(url || '');
  }

  function apiCacheTtl(url) {
    var u = String(url || '');
    if (/\/Items\/Resume(?:\?|$)/i.test(u)) return 0;
    if (/MediaSources/i.test(u)) return 0;
    if (/\/PlayedItems\//i.test(u)) return 0;
    if (/SortBy=DateCreated/i.test(u)) return API_LATEST_TTL_MS;
    if (/UserData/i.test(u)) return API_USERDATA_TTL_MS;
    return API_CACHE_TTL_MS;
  }

  function trimApiCache() {
    while (apiCacheOrder.length > API_CACHE_MAX_ENTRIES) {
      var oldKey = apiCacheOrder.shift();
      delete apiResponseCache[oldKey];
    }
  }

  function readApiCache(url) {
    var ttl = apiCacheTtl(url);
    if (!ttl) return null;
    var key = apiCacheKey(url);
    var entry = apiResponseCache[key];
    if (!entry) return null;
    if (Date.now() - entry.loadedAt > ttl) {
      delete apiResponseCache[key];
      apiCacheOrder = apiCacheOrder.filter(function (k) {
        return k !== key;
      });
      return null;
    }
    return entry.data;
  }

  function writeApiCache(url, data) {
    if (!apiCacheTtl(url)) return;
    var key = apiCacheKey(url);
    if (apiResponseCache[key]) {
      apiCacheOrder = apiCacheOrder.filter(function (k) {
        return k !== key;
      });
    }
    apiResponseCache[key] = { data: data, loadedAt: Date.now() };
    apiCacheOrder.push(key);
    trimApiCache();
  }

  function resetApiCacheStore() {
    apiResponseCache = {};
    apiCacheOrder = [];
    apiInflight = {};
  }

  function clearApiCache() {
    apiCacheEpoch++;
    resetApiCacheStore();
  }

  function invalidateUserDataCaches() {
    apiCacheEpoch++;
    resetApiCacheStore();
    libraryIndex.loadedAt = 0;
    libraryIndexInflight = null;
    hubDataInflight = null;
  }

  function currentTmdbLang() {
    return Lampa.Storage.field('tmdb_lang') || Lampa.Storage.get('language') || 'en';
  }

  function tmdbCacheKey(tmdb) {
    return String(tmdb.method || '') + '/' + String(tmdb.id || '') + '/' + currentTmdbLang();
  }

  function trimTmdbMetaCache() {
    var keys = Object.keys(tmdbMetaCache);
    if (keys.length <= TMDB_META_MAX_ENTRIES) return;
    keys
      .sort(function (a, b) {
        return (tmdbMetaCache[a].loadedAt || 0) - (tmdbMetaCache[b].loadedAt || 0);
      })
      .slice(0, keys.length - TMDB_META_MAX_ENTRIES)
      .forEach(function (key) {
        delete tmdbMetaCache[key];
      });
  }

  function readTmdbMetaCache(tmdb) {
    var key = tmdbCacheKey(tmdb);
    var entry = tmdbMetaCache[key];
    if (!entry) return null;
    if (Date.now() - entry.loadedAt > TMDB_META_TTL_MS) {
      delete tmdbMetaCache[key];
      return null;
    }
    return entry.data;
  }

  function writeTmdbMetaCache(tmdb, meta) {
    if (!meta) return;
    tmdbMetaCache[tmdbCacheKey(tmdb)] = { data: meta, loadedAt: Date.now() };
    trimTmdbMetaCache();
  }

  function clearTmdbMetaCache() {
    tmdbMetaCache = {};
    tmdbPosterInflight = {};
  }

  var netInstance = null;
  function network() {
    if (!netInstance && Lampa.Reguest) netInstance = new Lampa.Reguest();
    return netInstance;
  }

  function jfHttp(path, opts) {
    opts = opts || {};
    var base = apiBase();
    var key = apiKey();
    if (!base || !key) return Promise.reject(new Error('Jellyfin URL or API key is empty'));

    var p = String(path || '');
    var url = base + (p.charAt(0) === '/' ? p : '/' + p);
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    if (url.indexOf('api_key=') < 0) url += sep + 'api_key=' + encodeURIComponent(key);

    var timeout = typeof opts.timeout === 'number' ? opts.timeout : HTTP_TIMEOUT_MS;
    var dataType = opts.dataType || 'json';
    var method = (opts.method || 'GET').toUpperCase();
    var postData = method === 'POST' && opts.jsonBody === undefined ? opts.data : undefined;
    var net = network();
    var useJsonAjax = opts.jsonBody !== undefined || method === 'DELETE';
    var useCache = method === 'GET' && !useJsonAjax && opts.cache !== false;
    var cached = useCache ? readApiCache(url) : null;
    if (cached !== null) return Promise.resolve(cached);
    if (useCache && apiInflight[apiCacheKey(url)]) return apiInflight[apiCacheKey(url)];

    var request = new Promise(function (resolve, reject) {
      function ok(raw) {
        if (dataType === 'json' && typeof raw === 'string' && raw.length) {
          try {
            raw = JSON.parse(raw);
          } catch (ignore) { }
        }
        if (useCache) writeApiCache(url, raw);
        resolve(raw);
      }
      function fail(err) {
        var msg =
          (err && (err.decode_error || err.responseText || err.statusText || err.message)) ||
          (err && err.responseJSON && err.responseJSON.title) ||
          'Request failed';
        reject(new Error(msg));
      }

      if (useJsonAjax) {
        $.ajax({
          url: url,
          type: method,
          timeout: timeout,
          dataType: dataType === 'text' ? 'text' : 'json',
          contentType: opts.jsonBody !== undefined ? 'application/json' : undefined,
          data: opts.jsonBody !== undefined ? JSON.stringify(opts.jsonBody) : undefined,
        })
          .done(ok)
          .fail(fail);
        return;
      }

      if (!net) {
        Lampa.Network.silent(url, ok, fail, postData, { timeout: timeout, dataType: dataType });
        return;
      }

      net.timeout(timeout);
      net.silent(url, ok, fail, postData, { timeout: timeout, dataType: dataType });
    });

    if (useCache) {
      var inflightKey = apiCacheKey(url);
      apiInflight[inflightKey] = request.finally(function () {
        delete apiInflight[inflightKey];
      });
      return apiInflight[inflightKey];
    }

    return request;
  }

  function tmdbJson(url) {
    if (tmdbPosterInflight[url]) return tmdbPosterInflight[url];
    var net = network();
    var inner = new Promise(function (resolve, reject) {
      if (!net) {
        Lampa.Network.silent(url, resolve, reject, null, {
          timeout: TMDB_TIMEOUT_MS,
          dataType: 'json',
        });
        return;
      }
      net.timeout(TMDB_TIMEOUT_MS);
      net.silent(url, resolve, reject, null, { timeout: TMDB_TIMEOUT_MS, dataType: 'json' });
    });
    tmdbPosterInflight[url] = inner.finally(function () {
      delete tmdbPosterInflight[url];
    });
    return tmdbPosterInflight[url];
  }

  function storedUserId() {
    return storageStr('UserId', '');
  }

  function storedUserLabel() {
    return storageStr('UserLabel', '');
  }

  function invalidateUserCache() {
    cachedUserId = '';
    cachedAutoUserName = '';
    clearApiCache();
    clearTmdbMetaCache();
    clearRouteCache();
    libraryIndex.loadedAt = 0;
    libraryIndexInflight = null;
    hubDataInflight = null;
  }

  function fetchUsers() {
    return jfHttp('/Users').then(function (users) {
      if (!Array.isArray(users) || !users.length) throw new Error('No Jellyfin users');
      return users;
    });
  }

  function defaultUserFromList(users) {
    if (!users || !users.length) return null;
    var i;
    for (i = 0; i < users.length; i++) {
      if (users[i] && users[i].EnableAutoLogin) return users[i];
    }
    return users
      .slice()
      .sort(function (a, b) {
        return String(a.Name || '').localeCompare(String(b.Name || ''), undefined, {
          sensitivity: 'base',
        });
      })[0];
  }

  function rememberAutoUser(user) {
    if (!user) return;
    cachedAutoUserName = String(user.Name || '');
    if (!storedUserId()) cachedUserId = String(user.Id || '');
  }

  function prefetchAutoUser() {
    if (storedUserId()) return;
    fetchUsers()
      .then(function (users) {
        rememberAutoUser(defaultUserFromList(users));
        try {
          Lampa.Settings.update();
        } catch (e) { }
        syncUserInfoField();
      })
      .catch(function () { });
  }

  function resolveUserId() {
    var picked = storedUserId();
    if (picked) {
      cachedUserId = picked;
      return Promise.resolve(picked);
    }
    if (cachedUserId) return Promise.resolve(cachedUserId);
    return fetchUsers().then(function (users) {
      var user = defaultUserFromList(users);
      if (!user || !user.Id) throw new Error('Invalid Jellyfin user id');
      rememberAutoUser(user);
      return cachedUserId;
    });
  }

  function currentUserLabel() {
    var label = storedUserLabel();
    if (label) return label;
    if (cachedAutoUserName) return cachedAutoUserName;
    return Lampa.Lang.translate('jellyfin_user_auto');
  }

  function autoUserPickTitle(users) {
    var user = defaultUserFromList(users);
    var title = Lampa.Lang.translate('jellyfin_user_auto');
    if (user && user.Name) title += ' — ' + user.Name;
    return title;
  }

  function syncUserInfoField() {
    var $descr = $('[data-name="' + STORAGE_PREFIX + 'UserInfo"] .settings-param__descr');
    if ($descr.length) $descr.text(currentUserLabel());
  }

  function pickUserFromList(onDone) {
    var ctl = enabledControllerName('settings');
    fetchUsers()
      .then(function (users) {
        var items = users.map(function (user) {
          return { title: user.Name || user.Id, userId: String(user.Id || '') };
        });
        rememberAutoUser(defaultUserFromList(users));
        items.unshift({
          title: autoUserPickTitle(users),
          userId: '',
        });
        Lampa.Select.show({
          title: Lampa.Lang.translate('jellyfin_user_pick'),
          items: items,
          onBack: function () {
            deferControllerToggle(ctl);
            if (typeof onDone === 'function') onDone();
          },
          onSelect: function (item) {
            if (!item) return;
            if (item.userId) {
              Lampa.Storage.set(STORAGE_PREFIX + 'UserId', item.userId);
              Lampa.Storage.set(STORAGE_PREFIX + 'UserLabel', item.title || '');
            } else {
              Lampa.Storage.set(STORAGE_PREFIX + 'UserId', '');
              Lampa.Storage.set(STORAGE_PREFIX + 'UserLabel', '');
            }
            invalidateUserCache();
            if (item.userId) cachedAutoUserName = '';
            else prefetchAutoUser();
            Lampa.Settings.update();
            syncUserInfoField();
            deferControllerToggle(ctl);
            if (typeof onDone === 'function') onDone();
          },
        });
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_auth_fail') });
      });
  }

  function posterUrl(item) {
    if (!item) return IMG_PLACEHOLDER;
    var tag =
      (item.ImageTags && item.ImageTags.Primary) || item.SeriesPrimaryImageTag || '';
    if (!tag) return IMG_PLACEHOLDER;
    var id = item.Id;
    if (!id && item.SeriesId) id = item.SeriesId;
    if (!id) return IMG_PLACEHOLDER;
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(id) +
      '/Images/Primary?maxHeight=500&tag=' +
      encodeURIComponent(tag) +
      '&api_key=' +
      encodeURIComponent(apiKey())
    );
  }

  function episodeCoverUrl(item) {
    if (!item) return IMG_PLACEHOLDER;
    var key = apiKey();
    if (item.ImageTags && item.ImageTags.Primary && item.Id) {
      return (
        apiBase() +
        '/Items/' +
        encodeURIComponent(item.Id) +
        '/Images/Primary?maxHeight=360&tag=' +
        encodeURIComponent(item.ImageTags.Primary) +
        '&api_key=' +
        encodeURIComponent(key)
      );
    }
    if (item.SeriesPrimaryImageTag && item.SeriesId) {
      return (
        apiBase() +
        '/Items/' +
        encodeURIComponent(item.SeriesId) +
        '/Images/Primary?maxHeight=360&tag=' +
        encodeURIComponent(item.SeriesPrimaryImageTag) +
        '&api_key=' +
        encodeURIComponent(key)
      );
    }
    if (item.SeriesThumbImageTag && item.SeriesId) {
      return (
        apiBase() +
        '/Items/' +
        encodeURIComponent(item.SeriesId) +
        '/Images/Thumb?maxHeight=360&tag=' +
        encodeURIComponent(item.SeriesThumbImageTag) +
        '&api_key=' +
        encodeURIComponent(key)
      );
    }
    return IMG_PLACEHOLDER;
  }

  function seriesPosterFromItem(item) {
    if (!item || !item.SeriesId || !item.SeriesPrimaryImageTag) return IMG_PLACEHOLDER;
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(item.SeriesId) +
      '/Images/Primary?maxHeight=500&tag=' +
      encodeURIComponent(item.SeriesPrimaryImageTag) +
      '&api_key=' +
      encodeURIComponent(apiKey())
    );
  }

  function buildTmdbImageUrl(path) {
    var posterSize = Lampa.Storage.field('poster_size') || 'w342';
    return Lampa.Api.img(path, posterSize);
  }

  function getDeviceId() {
    var key = STORAGE_PREFIX + 'DeviceId';
    var id = String(Lampa.Storage.get(key, '') || '').trim();
    if (id) return id;
    id = 'lampa-' + (Lampa.Utils && Lampa.Utils.uid ? Lampa.Utils.uid() : String(Date.now()));
    Lampa.Storage.set(key, id);
    return id;
  }

  function canMSE(mime) {
    try {
      if (window.MediaSource && MediaSource.isTypeSupported) {
        return MediaSource.isTypeSupported(mime);
      }
    } catch (e) { }
    return false;
  }

  function canVideo(mime) {
    try {
      var v = document.createElement('video');
      var r = v.canPlayType(mime);
      return r === 'probably' || r === 'maybe';
    } catch (e) { }
    return false;
  }

  function transcodeFormat() {
    var f = '';
    try {
      f = String(Lampa.Storage.get(STORAGE_PREFIX + 'TranscodeFormat', 'auto') || 'auto')
        .trim()
        .toLowerCase();
    } catch (e) {
      f = 'auto';
    }
    if (f === 'hls-fmp4' || f === 'webm' || f === 'hls-ts') return f;
    if (
      usesLampaNativePlayer() &&
      Lampa.Platform &&
      typeof Lampa.Platform.is === 'function' &&
      Lampa.Platform.is('apple')
    ) {
      return 'hls-fmp4';
    }
    return 'hls-ts';
  }

  function transcodeParamsFor(format) {
    if (format === 'hls-fmp4') {
      return { videoCodec: 'h264', audioCodec: 'aac', container: 'mp4', segment: 'mp4', protocol: 'hls' };
    }
    if (format === 'webm') {
      return { videoCodec: 'vp9', audioCodec: 'opus', container: 'webm', segment: 'webm', protocol: 'http' };
    }
    return { videoCodec: 'h264', audioCodec: 'aac', container: 'ts', segment: 'ts', protocol: 'hls' };
  }

  function makePlaySessionId() {
    var id =
      'lampa-' +
      (Lampa.Utils && Lampa.Utils.uid
        ? Lampa.Utils.uid()
        : String(Date.now()) + '-' + Math.floor(Math.random() * 1e6));
    activePlaySessionIds[id] = true;
    return id;
  }

  function playSessionId() {
    if (!currentPlaySessionId) {
      currentPlaySessionId = makePlaySessionId();
    }
    return currentPlaySessionId;
  }

  function stopActiveTranscode(keep) {
    var psids = Object.keys(activePlaySessionIds);
    var retained = {};
    var kill = [];
    var keepId = keep ? String(keep) : '';
    psids.forEach(function (psid) {
      if (keepId && keepId === String(psid)) retained[psid] = true;
      else kill.push(psid);
    });
    activePlaySessionIds = retained;
    if (!keepId || keepId !== String(currentPlaySessionId)) currentPlaySessionId = '';
    if (!kill.length) return;
    var deviceId = encodeURIComponent(getDeviceId());
    kill.forEach(function (psid) {
      try {
        jfHttp(
          '/Videos/ActiveEncodings?deviceId=' + deviceId + '&playSessionId=' + encodeURIComponent(psid),
          { method: 'DELETE', dataType: 'text' }
        ).catch(function () { });
      } catch (e) { }
    });
  }

  function handlePlayerDestroy() {
    stopExternalPlaybackTicker();
    flushPlaybackProgress();
    flushPlaylistProgress();
    invalidateUserDataCaches();
    scheduleHubRefresh();
    externalPlay = null;
    currentAudioStreamIndex = null;
    currentPlayItemId = null;
    currentTimelineHash = null;
    currentPlayRow = null;
    autoQualityStop();
    if (autoQuality) {
      autoQuality.manualLock = false;
      autoQuality.itemId = null;
    }
    stopActiveTranscode();
    try {
      setPlayerEpisodeButtonsDisabled(false, false);
      document.body.classList.remove('jellyfin-movie-playing');
      document.body.classList.remove('jellyfin-playing');
    } catch (e) { }
  }

  function scheduleHubRefresh() {
    try {
      if (hubRefreshTimer) clearTimeout(hubRefreshTimer);
      hubRefreshTimer = setTimeout(function () {
        hubRefreshTimer = null;
        try {
          Lampa.Listener.send('jellyfin:hub-refresh', {});
        } catch (e) { }
      }, 1500);
    } catch (e) { }
  }

  function screenTv() {
    return (
      Lampa.Platform &&
      typeof Lampa.Platform.screen === 'function' &&
      Lampa.Platform.screen('tv')
    );
  }

  function bindScrollLayerVisible(scroll) {
    scroll.onScroll = function () {
      if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
    };
  }

  function scheduleReflowFocus(scroll, owner, lastEl, opts) {
    opts = opts || {};
    setTimeout(function () {
      try {
        if (opts.layerOnly) {
          if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
          return;
        }
        var act = typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        if (owner && (!act || act.activity !== owner)) return;
        var ctr = Lampa.Controller.enabled();
        var allowed = opts.controller ? [opts.controller] : ['content', 'items_line'];
        if (!ctr || allowed.indexOf(ctr.name) < 0) return;
        Lampa.Controller.collectionSet(scroll.render(true));
        Lampa.Controller.collectionFocus(lastEl || false, scroll.render(true));
        if (lastEl) scroll.update($(lastEl), !!opts.animate);
      } catch (e) { }
    }, 0);
  }

  function activePlayerId() {
    try {
      return String(Lampa.Storage.field('player') || Lampa.Storage.get('player', 'inner') || 'inner')
        .trim()
        .toLowerCase();
    } catch (e) {
      return 'inner';
    }
  }

  function usesLampaNativePlayer() {
    var player = activePlayerId();
    if (player === 'inner' || player === 'lampa') return true;

    var Platform = Lampa.Platform;
    if (!Platform || typeof Platform.is !== 'function') return player === 'ios';

    if (Platform.is('apple') && player === 'ios') return true;
    if (Platform.is('webos') && player === 'webos') return false;
    if (Platform.is('android') && player === 'android') return false;
    if (typeof Platform.desktop === 'function' && Platform.desktop() && player === 'other') {
      return false;
    }

    var external = {
      vlc: 1,
      nplayer: 1,
      infuse: 1,
      senplayer: 1,
      vidhub: 1,
      svplayer: 1,
      tracyplayer: 1,
      tvospro: 1,
      tvos: 1,
      tvosl: 1,
      tvosselect: 1,
      mpv: 1,
      iina: 1,
    };
    if (external[player]) return false;

    return true;
  }

  function transcodingEnabled() {
    if (!usesLampaNativePlayer()) return false;
    return storageToggle('Transcode', true);
  }

  function externalQualityPickerEnabled() {
    if (usesLampaNativePlayer()) return false;
    return storageToggle('ExternalQuality', true);
  }

  function tracksSubsEnabled() {
    return usesLampaNativePlayer() && transcodingEnabled() && storageToggle('TracksSubs', true);
  }

  var TRANSCODE_QUALITY_PRESETS = {
    '240p': {
      maxWidth: 480,
      maxHeight: 240,
      videoBitrate: 400000,
      maxStreamingBitrate: 30000000,
      audioBitrate: 192000,
      h264Level: '30',
    },
    '360p': {
      maxWidth: 640,
      maxHeight: 360,
      videoBitrate: 800000,
      maxStreamingBitrate: 30000000,
      audioBitrate: 192000,
      h264Level: '30',
    },
    '480p': {
      maxWidth: 854,
      maxHeight: 480,
      videoBitrate: 1500000,
      maxStreamingBitrate: 30000000,
      audioBitrate: 192000,
      h264Level: '31',
    },
    '540p': {
      maxWidth: 960,
      maxHeight: 540,
      videoBitrate: 2500000,
      maxStreamingBitrate: 30000000,
      audioBitrate: 256000,
      h264Level: '31',
    },
    '720p': {
      maxWidth: 1280,
      maxHeight: 720,
      videoBitrate: 4000000,
      maxStreamingBitrate: 30000000,
      audioBitrate: 384000,
      h264Level: '42',
    },
    '1080p': {
      maxWidth: 1920,
      maxHeight: 1080,
      videoBitrate: 12000000,
      maxStreamingBitrate: 80000000,
      audioBitrate: 384000,
      h264Level: '51',
    },
    '1440p': {
      maxWidth: 2560,
      maxHeight: 1440,
      videoBitrate: 25000000,
      maxStreamingBitrate: 100000000,
      audioBitrate: 384000,
      h264Level: '51',
    },
    '2160p': {
      maxWidth: 3840,
      maxHeight: 2160,
      videoBitrate: 45000000,
      maxStreamingBitrate: 120000000,
      audioBitrate: 640000,
      h264Level: '52',
    },
  };

  var PLAYER_TRANSCODE_QUALITIES = [
    { key: '240p', preset: '240p' },
    { key: '360p', preset: '360p' },
    { key: '480p', preset: '480p' },
    { key: '540p', preset: '540p' },
    { key: '720p', preset: '720p' },
    { key: '1080p', preset: '1080p' },
    { key: '1440p', preset: '1440p' },
    { key: '2160p', preset: '2160p' },
  ];

  function defaultTranscodePresetKey() {
    try {
      var def = parseInt(
        Lampa.Storage.field('video_quality_default') ||
        Lampa.Storage.get('video_quality_default', '1080'),
        10
      );
      if (def >= 2160) return '2160p';
      if (def >= 1440) return '1440p';
      if (def >= 1080) return '1080p';
      if (def >= 720) return '720p';
      if (def >= 540) return '540p';
      if (def >= 480) return '480p';
      if (def >= 360) return '360p';
      if (def >= 240) return '240p';
      return '360p';
    } catch (e) {
      return '1080p';
    }
  }

  function streamQualityPreset(presetKey) {
    return TRANSCODE_QUALITY_PRESETS[presetKey || defaultTranscodePresetKey()] || TRANSCODE_QUALITY_PRESETS['1080p'];
  }

  function maxAudioChannels() {
    try {
      var v = parseInt(String(storageStr('MaxAudioChannels', '6') || '6'), 10);
      return v === 2 ? 2 : 6;
    } catch (e) {
      return 6;
    }
  }

  function appendTranscodeQualityParams(parts, presetKey, format) {
    var quality = streamQualityPreset(presetKey);
    parts.push('MaxStreamingBitrate=' + quality.maxStreamingBitrate);
    parts.push('MaxStaticBitrate=' + quality.maxStreamingBitrate);
    parts.push('VideoBitrate=' + quality.videoBitrate);
    parts.push('AudioBitrate=' + quality.audioBitrate);
    parts.push('MaxWidth=' + quality.maxWidth);
    if (quality.maxHeight) parts.push('MaxHeight=' + quality.maxHeight);
    if (format !== 'webm') {
      parts.push('h264-profile=high,main,baseline,constrainedbaseline');
      parts.push('h264-level=' + quality.h264Level);
    }
    parts.push('TranscodingMaxAudioChannels=' + maxAudioChannels());
  }

  function mediaSourceId(itemId) {
    return String(itemId || '').replace(/-/g, '');
  }

  function streamUrl(itemId, opts) {
    opts = opts || {};
    var id = String(itemId || '');
    if (!id) return '';

    var msId = opts.mediaSourceId ? String(opts.mediaSourceId) : id;
    var parts = [
      'DeviceId=' + encodeURIComponent(getDeviceId()),
      'MediaSourceId=' + encodeURIComponent(mediaSourceId(msId)),
      'api_key=' + encodeURIComponent(apiKey()),
    ];
    if (opts.userId) parts.push('UserId=' + encodeURIComponent(opts.userId));
    if (opts.playSessionId) parts.push('PlaySessionId=' + encodeURIComponent(opts.playSessionId));
    if (opts.audioStreamIndex !== null && opts.audioStreamIndex !== undefined && opts.audioStreamIndex !== -1 && opts.audioStreamIndex !== '') {
      parts.push('AudioStreamIndex=' + encodeURIComponent(opts.audioStreamIndex));
    }

    var doTranscode = opts.forceTranscode ? true : transcodingEnabled();

    if (!doTranscode) {
      parts.push('Static=true');
      return apiBase() + '/Videos/' + encodeURIComponent(id) + '/stream?' + parts.join('&');
    }

    var format = opts.format || transcodeFormat();

    if (format === 'webm') {
      parts.push('Static=false');
      parts.push('VideoCodec=vp9');
      parts.push('AudioCodec=opus');
      parts.push('TranscodingContainer=webm');
      parts.push('TranscodingProtocol=http');
      appendTranscodeQualityParams(parts, opts.qualityPreset, format);
      return apiBase() + '/Videos/' + encodeURIComponent(id) + '/stream.webm?' + parts.join('&');
    }

    var tp = transcodeParamsFor(format);
    parts.push('VideoCodec=' + tp.videoCodec);
    parts.push('AudioCodec=' + tp.audioCodec);
    parts.push('TranscodingContainer=' + tp.container);
    parts.push('TranscodingProtocol=' + tp.protocol);
    parts.push('SegmentContainer=' + tp.segment);
    parts.push('MinSegments=1');
    parts.push('BreakOnNonKeyFrames=false');
    parts.push('EnableFastSeek=true');
    appendTranscodeQualityParams(parts, opts.qualityPreset, format);
    return apiBase() + '/Videos/' + encodeURIComponent(id) + '/master.m3u8?' + parts.join('&');
  }

  function audioStreamUrl(itemId, opts) {
    opts = opts || {};
    var id = String(itemId || '');
    if (!id) return '';

    var msId = opts.mediaSourceId ? String(opts.mediaSourceId) : id;
    var parts = [
      'DeviceId=' + encodeURIComponent(getDeviceId()),
      'MediaSourceId=' + encodeURIComponent(mediaSourceId(msId)),
      'api_key=' + encodeURIComponent(apiKey()),
    ];
    if (opts.userId) parts.push('UserId=' + encodeURIComponent(opts.userId));
    if (opts.playSessionId) parts.push('PlaySessionId=' + encodeURIComponent(opts.playSessionId));

    if (!transcodingEnabled()) {
      parts.push('Static=true');
      return apiBase() + '/Audio/' + encodeURIComponent(id) + '/stream?' + parts.join('&');
    }

    parts.push('AudioCodec=aac');
    parts.push('TranscodingContainer=aac');
    parts.push('TranscodingProtocol=hls');
    parts.push('MaxAudioChannels=2');
    return apiBase() + '/Audio/' + encodeURIComponent(id) + '/master.m3u8?' + parts.join('&');
  }

  function audioPlayerUrl(row, userId) {
    var id = String((row && row.id) || '');
    if (!id) return '';
    var variant = null;
    if (hasMultipleVariants(row)) {
      variant = resolvePlayVariant(row);
    } else {
      variant = variantFromRow(row);
    }
    var msId = (variant && variant.mediaSourceId) ? variant.mediaSourceId : id;
    var parts = [
      'DeviceId=' + encodeURIComponent(getDeviceId()),
      'MediaSourceId=' + encodeURIComponent(mediaSourceId(msId)),
      'api_key=' + encodeURIComponent(apiKey()),
      'Static=true',
    ];
    if (userId) parts.push('UserId=' + encodeURIComponent(userId));
    return apiBase() + '/Audio/' + encodeURIComponent(id) + '/stream?' + parts.join('&');
  }

  function buildStreamQualityMap(itemId, opts) {
    if (!transcodingEnabled()) return null;
    var map = {};
    PLAYER_TRANSCODE_QUALITIES.forEach(function (entry) {
      map[entry.key] = streamUrl(
        itemId,
        Object.assign({}, opts, {
          qualityPreset: entry.preset,
          playSessionId: makePlaySessionId(),
        })
      );
    });
    return map;
  }

  function resolveDefaultQualityUrl(map, raw) {
    if (!map || typeof map !== 'object') return '';
    var key = defaultQualityKey(raw);
    var qa = map[key];
    if (qa) {
      return qa && typeof qa === 'object' ? qa.url : typeof qa === 'string' ? qa : '';
    }
    var def;
    try {
      def = Lampa.Storage.field('video_quality_default');
    } catch (e) {
      def = null;
    }
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var q = keys[i];
      var entry = map[q];
      var qu = entry && typeof entry === 'object' ? entry.url : typeof entry === 'string' ? entry : '';
      if (parseInt(q, 10) == def && qu) return qu;
    }
    return '';
  }

  function mediaSourceForPlayTarget(raw, mediaSourceId) {
    var sources = (raw && raw.MediaSources) || [];
    if (!sources.length) return raw || null;
    var msId = String(mediaSourceId || '');
    if (msId) {
      for (var i = 0; i < sources.length; i++) {
        if (String(sources[i].Id) === msId) return sources[i];
      }
    }
    return sources[0];
  }

  function defaultAudioStream(ms) {
    var streams = (ms && ms.MediaStreams) || [];
    var audio = [];
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type === 'Audio') audio.push(streams[i]);
    }
    if (!audio.length) return null;
    for (i = 0; i < audio.length; i++) {
      if (audio[i].IsDefault) return audio[i];
    }
    return audio[0];
  }

  function currentQualityKeyForReload(fallback) {
    try {
      var w =
        Lampa.Player && typeof Lampa.Player.playdata === 'function'
          ? Lampa.Player.playdata()
          : null;
      if (w && w.quality_switched) {
        var k = w.quality_switched;
        if (TRANSCODE_QUALITY_PRESETS[k]) return k;
        if (autoQuality && autoQuality.on && autoQuality.currentKey && TRANSCODE_QUALITY_PRESETS[autoQuality.currentKey]) {
          return autoQuality.currentKey;
        }
        return k;
      }
    } catch (e) { }
    return fallback || defaultTranscodePresetKey();
  }

  function reloadForStreamSelection(itemId, baseOpts, qualityMap, item, defaultKey) {
    var key = currentQualityKeyForReload(defaultKey);
    var base = Object.assign({}, baseOpts);
    if (currentAudioStreamIndex !== null && currentAudioStreamIndex !== undefined && currentAudioStreamIndex !== -1) {
      base.audioStreamIndex = currentAudioStreamIndex;
    } else {
      delete base.audioStreamIndex;
    }
    if (qualityMap) {
      PLAYER_TRANSCODE_QUALITIES.forEach(function (entry) {
        var mk = entry.key;
        if (!qualityMap[mk]) return;
        var nurl = streamUrl(
          itemId,
          Object.assign({}, base, {
            qualityPreset: entry.preset,
            playSessionId: makePlaySessionId(),
          })
        );
        qualityMap[mk] = nurl;
        if (item && item.quality) {
          item.quality[mk] = nurl;
        }
      });
    }
    var url = streamUrl(
      itemId,
      Object.assign({}, base, {
        qualityPreset: key,
        playSessionId: makePlaySessionId(),
      })
    );
    try {
      if (item && item.quality) {
        var autoEntry = item.quality[autoQualityKey()];
        if (autoEntry && typeof autoEntry === 'object') autoEntry.url = url;
      }
    } catch (e) { }
    if (autoQuality) autoQuality.internalSend = true;
    try {
      if (Lampa.PlayerPanel && Lampa.PlayerPanel.listener) {
        Lampa.PlayerPanel.listener.send('quality', { name: key, url: url });
      }
    } catch (e) { }
    if (autoQuality) autoQuality.internalSend = false;
  }

  function rebuildPlaylistWithAudio() {
    if (!playlistBuild || !playlistBuild.rows) return;
    try {
      var items = playlistFromRows(playlistBuild.rows, playlistBuild.userId, playlistBuild.opts);
      if (currentPlayItemId) {
        var origCurrent = null;
        for (var j = 0; j < playlistItems.length; j++) {
          if (playlistItems[j] && playlistItems[j].jellyfinId === currentPlayItemId) {
            origCurrent = playlistItems[j];
            break;
          }
        }
        if (origCurrent) {
          for (var i = 0; i < items.length; i++) {
            if (items[i] && items[i].jellyfinId === currentPlayItemId) {
              items[i].url = origCurrent.url;
              break;
            }
          }
        }
      }
      playlistItems = items;
      if (Lampa.Player && typeof Lampa.Player.playlist === 'function') {
        Lampa.Player.playlist(items);
      }
    } catch (e) { }
  }

  function buildAudioTracks(playTarget, baseOpts, qualityMap, item, defaultKey) {
    var ms = mediaSourceForPlayTarget(playTarget.raw, playTarget.mediaSourceId);
    var streams = (ms && ms.MediaStreams) || [];
    var audio = [];
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type === 'Audio') audio.push(streams[i]);
    }
    if (!audio.length) return [];
    var def = defaultAudioStream(ms);
    var itemId = playTarget.id;
    return audio.map(function (stream) {
      var idx = Number(stream.Index) || 0;
      var title = String(stream.DisplayTitle || stream.Language || 'Audio ' + (idx + 1));
      var track = {
        name: stream.Language || title,
        language: stream.Language || '',
        label: title,
        extra: {},
        selected: def === stream,
      };
      if (stream.Channels) track.extra.channels = stream.Channels;
      if (stream.Codec) track.extra.fourCC = String(stream.Codec).toUpperCase();
      track.onSelect = (function (streamIndex) {
        return function () {
          currentAudioStreamIndex = streamIndex;
          reloadForStreamSelection(itemId, baseOpts, qualityMap, item, defaultKey);
          rebuildPlaylistWithAudio();
        };
      })(idx);
      return track;
    });
  }

  function subtitleStreamUrl(itemId, mediaSourceId, index, format) {
    var base = apiBase();
    if (!base) return '';
    var msId = mediaSourceId || itemId;
    var fmt = format || 'vtt';
    return (
      base +
      '/Videos/' +
      encodeURIComponent(itemId) +
      '/' +
      encodeURIComponent(msId) +
      '/Subtitles/' +
      encodeURIComponent(index) +
      '/Stream.' +
      fmt +
      '?api_key=' +
      encodeURIComponent(apiKey())
    );
  }

  function subtitleCodecSupported(codec) {
    var c = String(codec || '').toLowerCase();
    return ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'vtt', 'text', 'mov_text'].indexOf(c) >= 0;
  }

  function junkSubtitleStream(stream) {
    var t = String(stream.DisplayTitle || stream.Title || stream.Language || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    return t.indexOf('region:subtitle') >= 0;
  }

  function buildSubtitleTracks(playTarget) {
    var ms = mediaSourceForPlayTarget(playTarget.raw, playTarget.mediaSourceId);
    var streams = (ms && ms.MediaStreams) || [];
    var subs = [];
    var i;
    for (i = 0; i < streams.length; i++) {
      if (
        streams[i].Type === 'Subtitle' &&
        subtitleCodecSupported(streams[i].Codec) &&
        !junkSubtitleStream(streams[i])
      ) {
        subs.push(streams[i]);
      }
    }
    if (!subs.length) return [];
    var itemId = playTarget.id;
    var msId = playTarget.mediaSourceId || itemId;
    return subs.map(function (stream) {
      var idx = Number(stream.Index);
      if (!isFinite(idx) || idx < 0) idx = 0;
      var title = String(stream.DisplayTitle || stream.Language || 'Subtitle ' + (idx + 1));
      var track = {
        label: title,
        url: subtitleStreamUrl(itemId, msId, idx, 'vtt'),
        selected: false,
      };
      if (stream.Language) track.flag = String(stream.Language).slice(0, 2).toLowerCase();
      return track;
    });
  }

  function timelineHashFor(row) {
    var id = row && row.raw && row.raw.Id;
    if (!id) return '';
    var s = 'jellyfin:' + String(id);
    if (Lampa.Utils && typeof Lampa.Utils.hash === 'function') {
      return 'jf' + Lampa.Utils.hash(s);
    }
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return 'jf' + (h >>> 0);
  }

  function playItemFromRow(row, userId, includeMovie, opts) {
    opts = opts || {};
    var variant;
    if (opts.qualityTarget && !usesLampaNativePlayer()) {
      variant = findVariantForQuality(row, opts.qualityTarget) || resolvePlayVariant(row);
    } else {
      variant = resolvePlayVariant(row);
    }
    var playTarget = rowWithVariant(row, variant);
    var format = transcodeFormat();
    var defaultKey = defaultQualityKey(playTarget.raw);
    var streamOpts = {
      userId: userId,
      mediaSourceId: playTarget.mediaSourceId || variant.mediaSourceId,
      playSessionId: playSessionId(),
      format: format,
      qualityPreset: opts.qualityPreset || defaultKey,
    };
    if (opts.forceTranscode) streamOpts.forceTranscode = true;
    if (currentAudioStreamIndex !== null && currentAudioStreamIndex !== undefined && currentAudioStreamIndex !== -1) {
      streamOpts.audioStreamIndex = currentAudioStreamIndex;
    }
    var qualityMap =
      !opts.singleStream && transcodingEnabled() && format !== 'webm'
        ? buildStreamQualityMap(playTarget.id, streamOpts)
        : null;
    var item = {
      title: row.title,
      jellyfinId: playTarget.id,
      url:
        row.type === 'Audio'
          ? audioStreamUrl(playTarget.id, streamOpts)
          : streamUrl(playTarget.id, streamOpts),
    };
    if (row.type === 'Movie' || row.type === 'Episode') {
      item.timeline = {
        hash: timelineHashFor(row),
        time: playTarget.resumeSec,
        duration: 0,
        percent: 0,
        handler: function (percent, time, duration) {
          reportPlaybackProgress(row, percent, time, duration);
        },
      };
    } else if (playTarget.resumeSec > 0) {
      item.timeline = includeMovie
        ? { time: playTarget.resumeSec, duration: 0, percent: 0 }
        : { time: playTarget.resumeSec };
    }
    if (qualityMap) {
      var lampaDefaultUrl = '';
      if (row.type === 'Movie' || row.type === 'Episode') {
        lampaDefaultUrl = resolveDefaultQualityUrl(qualityMap, playTarget.raw);
        if (lampaDefaultUrl) item.url = lampaDefaultUrl;
        item.jellyfinQualityAuto = {
          map: qualityMap,
          startKey: defaultKey,
          nativeKey: nativeQualityKey(playTarget.raw),
        };
      }
      item.quality = qualityMapForLampa(qualityMap, playTarget.raw, lampaDefaultUrl);
    }
    if (
      tracksSubsEnabled() &&
      (row.type === 'Movie' || row.type === 'Episode')
    ) {
      var audioTracks = buildAudioTracks(playTarget, streamOpts, qualityMap, item, defaultKey);
      if (audioTracks && audioTracks.length) item.voiceovers = audioTracks;
      var subtitleTracks = buildSubtitleTracks(playTarget);
      if (subtitleTracks && subtitleTracks.length) item.subtitles = subtitleTracks;
    }
    if (includeMovie) item.movie = playTarget.raw;
    return item;
  }

  function buildEpisodeDisplay(row) {
    var raw = row.raw || {};
    var pct = Number(row.playedPct) || 0;
    if (row.watched && pct < 100) pct = 100;
    if (!pct && !row.watched) {
      var local = readLocalProgress(row.id);
      if (local && local.pct > 0) pct = local.pct;
    }
    return {
      id: row.id,
      code: episodeCode(raw),
      name: cleanEpisodeName(raw.Name) || row.title,
      cover: episodeCoverUrl(raw),
      overview: raw.Overview || '',
      quality: row.quality || '',
      runtimeMin: raw.RunTimeTicks
        ? Math.max(1, Math.round(raw.RunTimeTicks / 600000000))
        : 0,
      pct: pct,
      watched: !!row.watched,
    };
  }

  function playlistFromRows(rows, userId, opts) {
    return rows.map(function (row) {
      var item = playItemFromRow(row, userId, false, opts);
      if (
        item &&
        row &&
        (row.type === 'Episode' || row.type === 'Movie')
      ) {
        item._display = buildEpisodeDisplay(row);
      }
      return item;
    });
  }

  function ticksToSeconds(ticks) {
    var n = Number(ticks);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n / 10000000);
  }

  function tmdbFromItem(item) {
    if (!item || !item.ProviderIds) return null;
    var id = item.ProviderIds.Tmdb || item.ProviderIds.tmdb;
    if (!id) return null;
    var method = item.Type === 'Series' || item.SeriesName ? 'tv' : 'movie';
    if (item.Type === 'Episode' && item.SeriesId) method = 'tv';
    return { method: method, id: String(id) };
  }

  function detectQuality(name) {
    var n = String(name || '');
    if (/2160p|\b4K\b/i.test(n)) return '4K';
    if (/1080p/i.test(n)) return '1080p';
    if (/720p/i.test(n)) return '720p';
    if (/HDR/i.test(n)) return 'HDR';
    return '';
  }

  function videoStreamHeight(source) {
    var streams = (source && source.MediaStreams) || [];
    var h = 0;
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type !== 'Video') continue;
      h = Math.max(h, Number(streams[i].Height) || 0);
    }
    return h;
  }

  function qualityFromHeight(height) {
    var h = Number(height) || 0;
    if (h >= 2160) return '4K';
    if (h >= 1440) return '1440p';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 540) return '540p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    if (h >= 240) return '240p';
    return '';
  }

  function nativeQualityKey(raw) {
    var sources = (raw && raw.MediaSources) || [];
    var h = 0;
    var i;
    for (i = 0; i < sources.length; i++) {
      var vh = videoStreamHeight(sources[i]);
      if (vh > h) h = vh;
    }
    if (h >= 2160) return '2160p';
    if (h >= 1440) return '1440p';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 540) return '540p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    if (h >= 240) return '240p';
    if (h > 0) return '240p';
    var label = sources.length === 1 ? mediaSourceQuality(sources[0]) : '';
    var fallback = lampaQualityKey(label);
    return fallback || '1080p';
  }

  function defaultQualityKey(raw) {
    var ranks = { '240p': 1, '360p': 2, '480p': 3, '540p': 4, '720p': 5, '1080p': 6, '1440p': 7, '2160p': 8 };
    var native = nativeQualityKey(raw);
    var setting = defaultTranscodePresetKey();
    var nRank = ranks[native] || 6;
    var sRank = ranks[setting] || 6;
    return sRank < nRank ? setting : native;
  }

  function qualityMapForLampa(map, raw, defaultUrl) {
    if (!map || typeof map !== 'object') return map;
    var nativeKey = raw ? nativeQualityKey(raw) : null;
    var nativeRank = nativeKey ? qualityRank(nativeKey) : Infinity;
    var out = {};
    out[autoQualityKey()] = {
      call: autoQualityOnSelect,
      url: defaultUrl || '',
      auto: {
        map: map,
        nativeKey: nativeKey || '',
      },
    };
    PLAYER_TRANSCODE_QUALITIES.forEach(function (entry) {
      var key = entry.key;
      if (!map[key]) return;
      if (nativeRank !== Infinity && qualityRank(key) > nativeRank) return;
      out[key] = map[key];
    });
    return out;
  }

  var autoQuality = {
    on: false,
    nativeKey: null,
    currentKey: null,
    map: null,
    timer: null,
    buffering: 0,
    stable: 0,
    cooldown: 0,
    switching: false,
    itemId: null,
    manualLock: false,
    internalSend: false,
  };

  function autoQualityKey() {
    try {
      return Lampa.Lang.translate('jellyfin_quality_auto') || 'Авто';
    } catch (e) {
      return 'Авто';
    }
  }

  function autoQualityKeys() {
    return PLAYER_TRANSCODE_QUALITIES.map(function (e) {
      return e.key;
    });
  }

  function autoQualityStart(map, startKey, nativeKey) {
    autoQualityStop();
    var self = autoQuality;
    var keys = autoQualityKeys();
    if (!nativeKey || keys.indexOf(nativeKey) < 0) nativeKey = keys[keys.length - 1];
    if (!startKey || keys.indexOf(startKey) < 0) startKey = nativeKey;
    self.on = true;
    self.map = map || {};
    self.nativeKey = nativeKey;
    self.currentKey = startKey;
    self.buffering = 0;
    self.stable = 0;
    self.cooldown = 0;
    self.switching = false;
    self.timer = setInterval(autoQualityTick, 5000);
  }

  function autoQualityStop() {
    var self = autoQuality;
    self.on = false;
    if (self.timer) {
      clearInterval(self.timer);
      self.timer = null;
    }
  }

  function autoQualitySwitchTo(key) {
    var self = autoQuality;
    var url = self.map && self.map[key];
    if (!url) return;
    self.currentKey = key;
    self.switching = key;
    self.internalSend = true;
    try {
      if (Lampa.PlayerPanel && Lampa.PlayerPanel.listener) {
        Lampa.PlayerPanel.listener.send('quality', { name: key, url: url });
      }
    } catch (e) { }
    self.internalSend = false;
    self.switching = false;
  }

  function autoQualityTick() {
    var self = autoQuality;
    if (!self.on) return;
    var vid = document.querySelector('.player-video__video');
    if (!vid || vid.paused) return;
    var buffering = vid.readyState < 3;
    if (buffering) {
      self.stable = 0;
      if (self.cooldown > 0) self.cooldown--;
      else self.buffering++;
    } else {
      if (self.cooldown > 0) self.cooldown--;
      if (self.buffering > 0) self.buffering--;
      else self.stable++;
    }
    var keys = autoQualityKeys();
    var idx = keys.indexOf(self.currentKey);
    var nidx = keys.indexOf(self.nativeKey);
    if (idx < 0 || nidx < 0) return;
    if (self.buffering >= 2 && idx > 0) {
      var drop = idx - 1;
      if (idx >= 6 && drop > 0) drop = idx - 2;
      if (drop < 0) drop = 0;
      self.currentKey = keys[drop];
      self.buffering = 0;
      self.stable = 0;
      self.cooldown = 2;
      autoQualitySwitchTo(self.currentKey);
    } else if (self.stable >= 12 && idx < nidx) {
      self.currentKey = keys[idx + 1];
      self.stable = 0;
      self.cooldown = 4;
      autoQualitySwitchTo(self.currentKey);
    }
  }

  function autoQualityOnSelect(instance, callback) {
    var data = (instance && instance.auto) || {};
    var keys = autoQualityKeys();
    var nativeKey = data.nativeKey;
    if (!nativeKey || keys.indexOf(nativeKey) < 0) nativeKey = keys[keys.length - 1];
    autoQualityStart(data.map || {}, nativeKey, nativeKey);
    var url = (data.map || {})[nativeKey];
    if (url) {
      if (callback) callback(url);
      else autoQualitySwitchTo(nativeKey);
    }
  }

  function mediaSourceQuality(source) {
    if (!source) return '';
    var q = detectQuality(source.Name);
    if (q) return q;
    var streams = source.MediaStreams || [];
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type !== 'Video') continue;
      var h = Number(streams[i].Height) || 0;
      q = qualityFromHeight(h);
      if (q) return q;
      var title = String(streams[i].DisplayTitle || '');
      if (/\b4K\b/i.test(title)) return '4K';
    }
    q = qualityFromHeight(videoStreamHeight(source));
    if (q) return q;
    return detectQuality(String(source.Container || ''));
  }

  function qualityLabelFromItem(item) {
    if (!item) return '';
    var sources = item.MediaSources || [];
    if (sources.length > 1) {
      var labels = [];
      sources.forEach(function (source) {
        var q = mediaSourceQuality(source);
        if (q && labels.indexOf(q) < 0) labels.push(q);
      });
      labels.sort(function (a, b) {
        return qualityRank(b) - qualityRank(a);
      });
      if (labels.length) return labels.join(' / ');
    }
    if (sources.length === 1) return mediaSourceQuality(sources[0]) || detectQuality(item.Name);
    return detectQuality(item.Name);
  }

  function fetchItemMediaSources(itemId) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Items/' +
        encodeURIComponent(itemId) +
        '?UserId=' +
        encodeURIComponent(userId) +
        '&Fields=' +
        encodeURIComponent('MediaSources')
      );
    });
  }

  function fetchFreshResume(row) {
    var id = row && row.raw && row.raw.Id;
    if (!id) return Promise.resolve(row ? row.resumeSec : 0);
    return resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Users/' + encodeURIComponent(userId) + '/Items/' + encodeURIComponent(id),
          { dataType: 'json', cache: false }
        );
      })
      .then(function (item) {
        var local = readLocalProgress(id);
        if (item && item.UserData) {
          var sec = ticksToSeconds(item.UserData.PlaybackPositionTicks);
          if (item.UserData.Played) {
            clearLocalProgress(id);
            return 0;
          }
          if (localProgressIsNewer(local, item.UserData)) {
            return local && local.played ? 0 : Number(local.time) || 0;
          }
          return sec > 0 ? sec : localResumeSec(id);
        }
        return localResumeSec(id);
      })
      .catch(function () {
        return row ? row.resumeSec : 0;
      });
  }

  function variantsFromItemDetails(item, row) {
    var sources = (item && item.MediaSources) || [];
    if (!sources.length) return [variantFromRow(row)];
    return sources.map(function (ms) {
      return {
        itemId: item.Id,
        mediaSourceId: ms.Id,
        id: item.Id,
        quality: mediaSourceQuality(ms) || variantQualityKey(row),
        raw: item,
        resumeSec: row.resumeSec,
        playedPct: row.playedPct,
        watched: row.watched,
      };
    });
  }

  function hydrateRowVariantsFromItem(row) {
    var item = row.raw || {};
    var sources = item.MediaSources || [];
    if (sources.length > 1) {
      var variants = variantsFromItemDetails(item, row);
      if (variants.length > 1) {
        row.variants = variants;
        row.variantsResolved = true;
        updateRowQualityLabel(row);
      }
    }
    return row;
  }

  function variantsNeedResolve(row) {
    if (!row || row.variantsResolved) return false;
    var raw = row.raw || {};
    if (Number(raw.MediaSourceCount) > 1) return true;
    if (hasMultipleVariants(row)) {
      return !row.variants.every(function (v) {
        return !!v.mediaSourceId;
      });
    }
    return false;
  }

  function ensurePlaybackVariants(row) {
    if (!row) return Promise.resolve(row);
    normalizeVariants(row);
    if (!variantsNeedResolve(row)) return Promise.resolve(row);

    var itemIds = [];
    if (hasMultipleVariants(row)) {
      row.variants.forEach(function (v) {
        var itemId = v.itemId || v.id;
        if (itemId && itemIds.indexOf(itemId) < 0) itemIds.push(itemId);
      });
    } else {
      itemIds.push(row.id);
    }

    return Promise.all(
      itemIds.map(function (itemId) {
        var base = row;
        if (hasMultipleVariants(row)) {
          row.variants.forEach(function (v) {
            if ((v.itemId || v.id) === itemId) base = rowWithVariant(row, v);
          });
        }
        return fetchItemMediaSources(itemId).then(function (item) {
          return variantsFromItemDetails(item, base);
        });
      })
    )
      .then(function (parts) {
        var merged = [];
        parts.forEach(function (list) {
          list.forEach(function (v) {
            var exists = merged.some(function (m) {
              return m.mediaSourceId === v.mediaSourceId;
            });
            if (!exists) merged.push(v);
          });
        });
        merged.sort(function (a, b) {
          return qualityRank(b.quality) - qualityRank(a.quality);
        });
        if (merged.length) {
          row.variants = merged;
          row.variantsResolved = true;
          updateRowQualityLabel(row);
        }
        return row;
      })
      .catch(function () {
        return row;
      });
  }

  function qualityRank(key) {
    var ranks = {
      '4K': 8,
      '2160p': 8,
      '1440p': 7,
      '1080p': 6,
      '720p': 5,
      '540p': 4,
      '480p': 3,
      '360p': 2,
      '240p': 1,
      'HDR': 1,
    };
    return ranks[key] || 0;
  }

  function lampaQualityKey(label) {
    var s = String(label || '').trim();
    if (!s) return '';
    if (s === '4K' || /2160/i.test(s)) return '2160p';
    if (/^\d+p$/i.test(s)) return s.toLowerCase();
    if (s === 'HDR' || /hdr/i.test(s)) return '2160p';
    if (/1080/i.test(s)) return '1080p';
    if (/720/i.test(s)) return '720p';
    if (/480/i.test(s)) return '480p';
    return s;
  }

  function resolvePlayVariant(row) {
    if (!hasMultipleVariants(row)) return variantFromRow(row);
    if (row.mediaSourceId) {
      var matched = null;
      row.variants.forEach(function (v) {
        if (v.mediaSourceId === row.mediaSourceId) matched = v;
      });
      if (matched) return matched;
    }
    return pickDefaultVariant(row);
  }

  function variantQualityKey(row) {
    return row.quality || detectQuality((row.raw && row.raw.Name) || '') || '';
  }

  function variantFromRow(row) {
    var raw = row.raw || {};
    var sources = raw.MediaSources || [];
    if (sources.length === 1) {
      var ms = sources[0];
      return {
        itemId: row.id,
        mediaSourceId: ms.Id,
        id: row.id,
        quality: mediaSourceQuality(ms) || variantQualityKey(row),
        raw: raw,
        resumeSec: row.resumeSec,
        playedPct: row.playedPct,
        watched: row.watched,
      };
    }
    return {
      itemId: row.id,
      mediaSourceId: row.mediaSourceId || row.id,
      id: row.id,
      quality: variantQualityKey(row),
      raw: raw,
      resumeSec: row.resumeSec,
      playedPct: row.playedPct,
      watched: row.watched,
    };
  }

  function normalizeVariants(row) {
    if (!row.variants) row.variants = [variantFromRow(row)];
    return row;
  }

  function updateRowQualityLabel(row) {
    if (!row.variants || row.variants.length < 2) return row;
    var labels = [];
    row.variants.forEach(function (v) {
      if (v.quality && labels.indexOf(v.quality) < 0) labels.push(v.quality);
    });
    labels.sort(function (a, b) {
      return qualityRank(b) - qualityRank(a);
    });
    if (labels.length) row.quality = labels.join(' / ');
    return row;
  }

  function addVariantToRow(primary, row) {
    normalizeVariants(primary);
    var incoming = variantFromRow(row);
    var exists = primary.variants.some(function (v) {
      return (
        (incoming.mediaSourceId && v.mediaSourceId === incoming.mediaSourceId) ||
        ((v.itemId || v.id) === (incoming.itemId || incoming.id) && v.quality === incoming.quality)
      );
    });
    if (!exists) primary.variants.push(incoming);
    primary.variants.sort(function (a, b) {
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
    return updateRowQualityLabel(primary);
  }

  function mergeTmdbRows(current, incoming) {
    if (!current) return updateRowQualityLabel(normalizeVariants(incoming));
    normalizeVariants(current);
    normalizeVariants(incoming);
    if (itemScore(incoming.raw) > itemScore(current.raw)) {
      var kept = current.variants.slice();
      incoming = normalizeVariants(incoming);
      kept.forEach(function (v) {
        if (v.id !== incoming.id) {
          addVariantToRow(incoming, {
            id: v.id,
            raw: v.raw,
            quality: v.quality,
            resumeSec: v.resumeSec,
            playedPct: v.playedPct,
            watched: v.watched,
          });
        }
      });
      addVariantToRow(incoming, current);
      return incoming;
    }
    addVariantToRow(current, incoming);
    return current;
  }

  function hasMultipleVariants(row) {
    return !!(row && row.variants && row.variants.length > 1);
  }

  function rowWithVariant(row, variant) {
    if (!variant) return row;
    return Object.assign({}, row, {
      id: variant.itemId || variant.id,
      mediaSourceId: variant.mediaSourceId || variant.id,
      raw: variant.raw,
      quality: variant.quality,
      resumeSec: variant.resumeSec,
      playedPct: variant.playedPct,
      watched: variant.watched,
      variants: row.variants,
      variantsResolved: row.variantsResolved,
    });
  }

  function pickDefaultVariant(row) {
    if (!hasMultipleVariants(row)) return variantFromRow(row);
    var pref = defaultStreamQualityKey();
    var picked = null;
    row.variants.forEach(function (v) {
      if (lampaQualityKey(v.quality) === pref) picked = v;
    });
    return picked || row.variants[0];
  }

  function defaultStreamQualityKey() {
    try {
      var def = parseInt(
        Lampa.Storage.field('video_quality_default') ||
        Lampa.Storage.get('video_quality_default', '1080'),
        10
      );
      if (def >= 2160) return '2160p';
      if (def >= 1080) return '1080p';
      if (def >= 720) return '720p';
      return '480p';
    } catch (e) {
      return '1080p';
    }
  }

  function findVariantForQuality(row, target) {
    if (!row || !target) return null;
    normalizeVariants(row);
    var want = lampaQualityKey(target) || String(target);
    var found = null;
    row.variants.forEach(function (v) {
      if (lampaQualityKey(v.quality) === want) found = v;
    });
    return found;
  }

  function externalPlayerSubtitle() {
    var id = activePlayerId();
    if (!id || id === 'inner' || id === 'lampa') return '';
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function qualityMenuLabel(target) {
    if (target === '2160p') return Lampa.Lang.translate('jellyfin_play_4k');
    if (target === '1080p') return Lampa.Lang.translate('jellyfin_play_1080');
    if (target === '720p') return '720p';
    return String(target || '');
  }

  function collectExternalQualityKeys(row) {
    var seen = {};
    function addKey(label) {
      var key = lampaQualityKey(label);
      if (key === '2160p' || key === '1080p') seen[key] = true;
    }
    normalizeVariants(row);
    (row.variants || []).forEach(function (v) {
      addKey(v.quality);
    });
    var sources = (row.raw && row.raw.MediaSources) || [];
    sources.forEach(function (ms) {
      addKey(mediaSourceQuality(ms));
    });
    var label = String(row.quality || '');
    if (/4K|2160/i.test(label)) seen['2160p'] = true;
    if (/1080/i.test(label)) seen['1080p'] = true;
    return seen;
  }

  function externalQualityTargetsFromSeen(seen) {
    var out = [];
    if (seen['2160p']) out.push('2160p');
    if (seen['1080p']) out.push('1080p');
    return out;
  }

  function guessExternalQualityTargets(row) {
    if (!row || row.type === 'Series') return [];
    return externalQualityTargetsFromSeen(collectExternalQualityKeys(row));
  }

  function needsExternalQualityPrefetch(row) {
    if (!row || row.type === 'Series' || usesLampaNativePlayer()) return false;
    if (guessExternalQualityTargets(row).length >= 2) return false;
    var raw = row.raw || {};
    if (Number(raw.MediaSourceCount) > 1) return true;
    return variantsNeedResolve(row);
  }

  function prepareRowForExternalQuality(row) {
    if (!needsExternalQualityPrefetch(row)) return Promise.resolve(row);
    return ensurePlaybackVariants(row);
  }

  function buildPlayMenuItems(row) {
    if (row.type === 'Series' || usesLampaNativePlayer() || externalQualityPickerEnabled()) {
      return [{ title: Lampa.Lang.translate('jellyfin_play'), action: 'play' }];
    }
    var targets = guessExternalQualityTargets(row);
    var sub = externalPlayerSubtitle();
    if (targets.length >= 2) {
      return targets.map(function (target) {
        return {
          title: qualityMenuLabel(target),
          subtitle: sub,
          action: 'play_quality',
          qualityTarget: target,
        };
      });
    }
    return [{ title: Lampa.Lang.translate('jellyfin_play'), action: 'play' }];
  }

  function externalQualityOptionsForRow(row) {
    var nativeKey = nativeQualityKey((row && row.raw) || {});
    var keys = PLAYER_TRANSCODE_QUALITIES.map(function (e) {
      return e.key;
    });
    var max = keys.indexOf(nativeKey);
    if (max < 0) max = keys.length - 1;
    var out = [];
    for (var i = max; i >= 0; i--) {
      out.push({ key: keys[i], title: keys[i] });
    }
    return out;
  }

  function showExternalTranscodeQualityPicker(row, allRows, opts) {
    var ctl = enabledControllerName();
    var items = [
      {
        title: Lampa.Lang.translate('jellyfin_quality_auto'),
        subtitle: externalPlayerSubtitle(),
        qualityKey: 'auto',
      },
    ];
    externalQualityOptionsForRow(row).forEach(function (q) {
      items.push({
        title: q.title,
        subtitle: externalPlayerSubtitle(),
        qualityKey: q.key,
      });
    });
    Lampa.Select.show({
      title: Lampa.Lang.translate('jellyfin_pick_quality'),
      items: items,
      onBack: function () {
        restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel || !sel.qualityKey) return;
        launchPlayerFromSelect(ctl, function () {
          var po = Object.assign({}, opts || {});
          if (sel.qualityKey === 'auto') {
            playRow(row, allRows, Object.assign({}, po, { singleStream: true }));
            return;
          }
          playRow(row, allRows, Object.assign({}, po, {
            singleStream: true,
            forceTranscode: true,
            qualityPreset: sel.qualityKey,
          }));
        });
      },
    });
  }

  function showExternalQualityPicker(row, allRows) {
    var ctl = enabledControllerName();
    var targets = guessExternalQualityTargets(row);
    if (targets.length < 2) {
      playEpisodeRow(row, allRows);
      return;
    }
    Lampa.Select.show({
      title: Lampa.Lang.translate('jellyfin_pick_quality'),
      items: targets.map(function (target) {
        return {
          title: qualityMenuLabel(target),
          subtitle: externalPlayerSubtitle(),
          qualityTarget: target,
        };
      }),
      onBack: function () {
        restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel || !sel.qualityTarget) return;
        launchPlayerFromSelect(ctl, function () {
          var variant = findVariantForQuality(row, sel.qualityTarget);
          if (!variant) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
            return;
          }
          playRow(rowWithVariant(row, variant), allRows, {
            singleStream: true,
            qualityTarget: sel.qualityTarget,
          });
        });
      },
    });
  }

  function playEpisodeRow(row, allRows) {
    ensurePlaybackVariants(row)
      .then(function (ready) {
        if (!usesLampaNativePlayer()) {
          if (externalQualityPickerEnabled()) {
            showExternalTranscodeQualityPicker(ready, allRows, {});
            return;
          }
          var targets = guessExternalQualityTargets(ready);
          if (targets.length >= 2) {
            showExternalQualityPicker(ready, allRows);
            return;
          }
          var streamOpts = { singleStream: true };
          var variant = null;
          if (targets.length === 1) {
            streamOpts.qualityTarget = targets[0];
            variant = findVariantForQuality(ready, targets[0]);
          }
          if (!variant) variant = resolvePlayVariant(ready);
          playRow(rowWithVariant(ready, variant), allRows, streamOpts);
          return;
        }
        playRow(ready, allRows);
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  function playMediaRowQuality(row, qualityTarget) {
    ensurePlaybackVariants(row)
      .then(function (ready) {
        if (ready.type === 'Series') {
          playMediaRowDirect(ready);
          return;
        }
        var variant = findVariantForQuality(ready, qualityTarget);
        if (!variant) {
          Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
          return;
        }
        playRow(rowWithVariant(ready, variant), null, {
          singleStream: true,
          qualityTarget: qualityTarget,
        });
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  function pad2(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function cleanJellyfinName(name) {
    return String(name || '')
      .replace(RELEASE_FOLDER_RE, '')
      .replace(/\(\s*\)|\s{2,}/g, ' ')
      .trim();
  }

  function episodeNumbers(item) {
    item = item || {};
    return {
      season: Number(item.ParentIndexNumber) || 0,
      episode: Number(item.IndexNumber) || 0,
    };
  }

  function episodeCode(item) {
    var n = episodeNumbers(item);
    return 'S' + pad2(n.season) + 'E' + pad2(n.episode);
  }

  function episodeCodeShort(item) {
    var n = episodeNumbers(item);
    return 'S' + n.season + ':E' + n.episode;
  }

  function cleanEpisodeName(name) {
    var n = String(name || '').trim();
    if (!n || /^s\d+\s*e\d+/i.test(n) || RELEASE_FOLDER_RE.test(n)) return '';
    return n;
  }

  function sortEpisodeRows(rows) {
    return rows.slice().sort(function (a, b) {
      var na = episodeNumbers(a.raw);
      var nb = episodeNumbers(b.raw);
      if (na.season !== nb.season) return na.season - nb.season;
      if (na.episode !== nb.episode) return na.episode - nb.episode;
      return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }

  function episodeTitle(item, seriesTitle) {
    var series = seriesTitle || cleanJellyfinName(item.SeriesName) || '';
    var epName = String(item.Name || '').trim();
    if (epName && !/^s\d+\s*e\d+/i.test(epName) && !RELEASE_FOLDER_RE.test(epName)) {
      return series ? series + ' — ' + epName : epName;
    }
    return series ? series + ' — ' + episodeCode(item) : episodeCode(item);
  }

  function cardTitle(item) {
    if (!item) return '';
    if (item.Type === 'Episode') return episodeTitle(item);
    return cleanJellyfinName(item.Name) || item.Name || '';
  }

  function displayTitleFromMeta(item, meta) {
    if (!meta) return cardTitle(item);
    if (item.Type === 'Episode') return episodeTitle(item, meta.title);
    return meta.title || cardTitle(item);
  }

  function hubCardTitle(row) {
    var title = row.title || '';
    if (Lampa.Utils && typeof Lampa.Utils.shortText === 'function') {
      return Lampa.Utils.shortText(title, 54);
    }
    return title.length > 54 ? title.slice(0, 51) + '...' : title;
  }

  function cardYear(item, meta) {
    if (meta && meta.year) return String(meta.year);
    return item.ProductionYear ? String(item.ProductionYear) : '';
  }

  function itemScore(raw) {
    var s = 0;
    if (raw.ImageTags && raw.ImageTags.Primary) s += 100;
    if (tmdbFromItem(raw)) s += 50;
    var name = String(raw.Name || '');
    if (name.length < 42) s += 10;
    if (!RELEASE_FOLDER_RE.test(name)) s += 30;
    if (raw.UserData && Number(raw.UserData.PlayedPercentage) > 0) s += 5;
    return s;
  }

  function localResumeSec(itemId) {
    var local = readLocalProgress(itemId);
    if (local && !local.played && local.time > 0) return local.time;
    return 0;
  }

  function localProgressIsNewer(local, userData) {
    if (!local || !local.updatedAt) return false;
    if (!userData || !userData.LastPlayedDate) return true;
    var ud = Date.parse(userData.LastPlayedDate);
    if (!isFinite(ud)) return true;
    return local.updatedAt > ud;
  }

  function mapRow(item, meta) {
    meta = meta || null;
    var tmdb = tmdbFromItem(item);
    var jellyPoster = posterUrl(item);
    var displayTitle = meta ? displayTitleFromMeta(item, meta) : cardTitle(item);
    var localP = readLocalProgress(item.Id);
    var serverResumeSec = item.UserData ? ticksToSeconds(item.UserData.PlaybackPositionTicks) : 0;
    var serverPlayed = !!(item.UserData && item.UserData.Played);
    var localNewer = localProgressIsNewer(localP, item.UserData);
    var resumeSec = serverResumeSec;
    if (localNewer && localP.played) {
      resumeSec = 0;
    } else if (localNewer && Number(localP.time) > 0) {
      resumeSec = Number(localP.time);
    } else if (!resumeSec) {
      if (serverPlayed) {
        clearLocalProgress(item.Id);
      } else {
        resumeSec = localResumeSec(item.Id);
      }
    }
    var serverPct = item.UserData
      ? Number(item.UserData.PlayedPercentage) || (serverPlayed ? 100 : 0)
      : 0;
    var playedPct = serverPct;
    if (localNewer && localP.played) playedPct = 100;
    else if (!playedPct && resumeSec && resumeSec !== serverResumeSec) {
      if (localP && !localP.played) playedPct = Number(localP.pct) || 0;
    }
    return hydrateRowVariantsFromItem({
      id: item.Id,
      raw: item,
      title: displayTitle,
      subtitle: meta && meta.subtitle ? meta.subtitle : '',
      year: cardYear(item, meta),
      poster: jellyPoster,
      displayPoster:
        meta && meta.poster
          ? meta.poster
          : jellyPoster !== IMG_PLACEHOLDER
            ? jellyPoster
            : IMG_PLACEHOLDER,
      type: item.Type || '',
      tmdb: tmdb,
      quality: qualityLabelFromItem(item),
      rating:
        item.CommunityRating && Number(item.CommunityRating) > 0
          ? parseFloat(item.CommunityRating).toFixed(1)
          : '',
      resumeSec: resumeSec,
      playedPct: playedPct,
      watched: serverPlayed || !!(localP && localP.played),
    });
  }

  function fetchTmdbMeta(tmdb) {
    var cached = readTmdbMetaCache(tmdb);
    if (cached) return Promise.resolve(cached);
    var lang = currentTmdbLang();
    var url = Lampa.TMDB.api(
      tmdb.method +
      '/' +
      tmdb.id +
      '?api_key=' +
      Lampa.TMDB.key() +
      '&language=' +
      lang
    );
    return tmdbJson(url)
      .then(function (data) {
        var meta = {
          title:
            data.title ||
            data.name ||
            data.original_title ||
            data.original_name ||
            '',
          year: String(
            (data.release_date || data.first_air_date || '').slice(0, 4) || ''
          ),
          poster: data.poster_path ? buildTmdbImageUrl(data.poster_path) : '',
          subtitle: data.tagline || '',
        };
        writeTmdbMetaCache(tmdb, meta);
        return meta;
      })
      .catch(function () {
        return null;
      });
  }

  function promiseAllChunks(items, size, fn) {
    if (!items.length) return Promise.resolve([]);
    size = Math.max(1, size || 8);
    var chunks = [];
    var i;
    for (i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    var seq = Promise.resolve([]);
    chunks.forEach(function (chunk) {
      seq = seq.then(function (acc) {
        return Promise.all(chunk.map(fn)).then(function (part) {
          return acc.concat(part);
        });
      });
    });
    return seq;
  }

  function enrichRowsFromTmdb(rows) {
    if (!storageToggle('TmdbPosters', true)) return Promise.resolve(rows);
    return promiseAllChunks(rows, TMDB_ENRICH_CONCURRENCY, function (row) {
      if (!row.tmdb) return Promise.resolve(row);
      var raw = row.raw || {};
      var needsPoster = !row.poster || row.poster === IMG_PLACEHOLDER;
      var needsTitle =
        RELEASE_FOLDER_RE.test(raw.Name || '') ||
        RELEASE_FOLDER_RE.test(raw.SeriesName || '') ||
        raw.Type === 'Episode';
      if (!needsPoster && !needsTitle) return Promise.resolve(row);
      return fetchTmdbMeta(row.tmdb).then(function (meta) {
        if (!meta) return row;
        return Object.assign({}, row, mapRow(row.raw, meta));
      });
    });
  }

  function dedupeRows(rows) {
    var best = {};
    var loose = [];
    rows.forEach(function (row) {
      if (row.tmdb) {
        var key = row.tmdb.method + '/' + row.tmdb.id;
        best[key] = mergeTmdbRows(best[key], row);
      } else {
        loose.push(row);
      }
    });
    var out = Object.keys(best).map(function (k) {
      return best[k];
    });
    var seen = {};
    loose.forEach(function (row) {
      var raw = row.raw || {};
      var nk = raw.Path
        ? String(raw.Path)
        : String(row.title || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
      if (!nk.length || seen[nk]) return;
      seen[nk] = true;
      out.push(row);
    });
    out.sort(function (a, b) {
      return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' });
    });
    return out;
  }

  function sortLatestRows(rows) {
    return rows.slice().sort(function (a, b) {
      var da = a && a.raw ? String(a.raw.DateCreated || '') : '';
      var db = b && b.raw ? String(b.raw.DateCreated || '') : '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      if (da === db) return 0;
      return da > db ? -1 : 1;
    });
  }

  function filterRows(rows, category) {
    if (!storageToggle('HideFolders', true)) return rows;
    return rows.filter(function (row) {
      if (row.type === 'Photo') return true;
      if (row.tmdb) return true;
      if (RELEASE_FOLDER_RE.test(row.raw.Name || row.title || '')) return false;
      if (
        category === 'Series' &&
        (!row.poster || row.poster === IMG_PLACEHOLDER) &&
        (!row.displayPoster || row.displayPoster === IMG_PLACEHOLDER)
      ) {
        return false;
      }
      return true;
    });
  }

  function dedupeEpisodeRows(rows) {
    var best = {};
    rows.forEach(function (row) {
      var raw = row.raw || {};
      var key =
        String(raw.SeriesId || '') +
        '/' +
        String(raw.ParentIndexNumber || 0) +
        '/' +
        String(raw.IndexNumber || 0);
      best[key] = mergeTmdbRows(best[key], row);
    });
    return sortEpisodeRows(
      Object.keys(best).map(function (k) {
        return best[k];
      })
    );
  }

  function processRows(items, category) {
    var rows = items.map(function (item) {
      return mapRow(item);
    });
    if (category === 'Episode') {
      rows = dedupeEpisodeRows(rows);
      return enrichRowsFromTmdb(rows).then(function (enriched) {
        return dedupeEpisodeRows(enriched);
      });
    }
    if (storageToggle('Dedupe', true)) rows = dedupeRows(rows);
    return enrichRowsFromTmdb(rows).then(function (enriched) {
      var filtered = filterRows(enriched, category);
      if (category === 'Latest') filtered = sortLatestRows(filtered);
      return filtered;
    });
  }

  function listFieldsQuery(startIndex) {
    var fields =
      'ProviderIds,ImageTags,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,UserData,SeriesId,SeriesPrimaryImageTag,CommunityRating,OfficialRating,RunTimeTicks,MediaSourceCount,MediaSources,Path,ParentId,Album';
    return (
      'StartIndex=' +
      (startIndex || 0) +
      '&Limit=' +
      PAGE_SIZE +
      '&Fields=' +
      encodeURIComponent(fields) +
      '&EnableImageTypes=Primary&SortBy=SortName&SortOrder=Ascending'
    );
  }

  function listPath(category, userId, startIndex) {
    var common = listFieldsQuery(startIndex);

    if (category === 'Resume') {
      return (
        '/Users/' +
        encodeURIComponent(userId) +
        '/Items/Resume?MediaTypes=Video&' +
        common
      );
    }

    var type = category === 'Series' ? 'Series' : 'Movie';
    return (
      '/Items?UserId=' +
      encodeURIComponent(userId) +
      '&Recursive=true&IncludeItemTypes=' +
      type +
      '&' +
      common
    );
  }

  function latestFieldsQuery(limit) {
    return (
      'Limit=' +
      (limit || PAGE_SIZE) +
      '&Fields=' +
      encodeURIComponent(
        'ProviderIds,ImageTags,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,UserData,SeriesId,SeriesPrimaryImageTag,CommunityRating,RunTimeTicks,MediaSourceCount,MediaSources,ParentId,Album'
      ) +
      '&EnableImageTypes=Primary'
    );
  }

  function latestItemsPath(userId, parentId, includeTypes, limit) {
    var fields =
      'ProviderIds,ImageTags,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,UserData,SeriesId,SeriesPrimaryImageTag,CommunityRating,RunTimeTicks,MediaSourceCount,MediaSources,ParentId,Album,DateCreated';
    return (
      '/Items?UserId=' +
      encodeURIComponent(userId) +
      (parentId ? '&ParentId=' + encodeURIComponent(parentId) : '') +
      '&IncludeItemTypes=' +
      encodeURIComponent(includeTypes) +
      '&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=' +
      (limit || PAGE_SIZE) +
      '&Fields=' +
      encodeURIComponent(fields) +
      '&EnableImageTypes=Primary'
    );
  }

  function fetchLatest(userId) {
    return jfHttp(
      latestItemsPath(userId, '', 'Movie,Series,MusicAlbum,PhotoAlbum,Video,MusicVideo,Book', PAGE_SIZE)
    ).then(function (data) {
      var items = (data && data.Items) || [];
      return processRows(items, 'Latest').then(function (rows) {
        return attachSeriesQualities(rows).then(function (rowsWithQuality) {
          return {
            rows: rowsWithQuality,
            total: (data && data.TotalRecordCount) || items.length,
            next: items.length,
            hasMore: false,
          };
        });
      });
    });
  }

  function fetchNextUp(userId) {
    return jfHttp(
      '/Shows/NextUp?UserId=' +
      encodeURIComponent(userId) +
      '&' +
      latestFieldsQuery()
    ).then(function (data) {
      var items = (data && data.Items) || [];
      return processRows(items, 'Episode').then(function (rows) {
        return {
          rows: rows,
          total: (data && data.TotalRecordCount) || rows.length,
          next: items.length,
          hasMore: false,
        };
      });
    });
  }

  function fetchSeriesLatestEpisodeQuality(seriesId) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Users/' +
        encodeURIComponent(userId) +
        '/Items?ParentId=' +
        encodeURIComponent(seriesId) +
        '&IncludeItemTypes=Episode&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=1&Fields=' +
        encodeURIComponent('MediaSources,MediaSourceCount') +
        '&EnableImageTypes=Primary'
      ).then(function (data) {
        var items = (data && data.Items) || [];
        return items.length ? qualityLabelFromItem(items[0]) : '';
      });
    });
  }

  function attachSeriesQualities(rows) {
    var tasks = [];
    rows.forEach(function (row) {
      if (row && row.type === 'Series' && row.id) {
        tasks.push(
          fetchSeriesLatestEpisodeQuality(row.id).then(function (quality) {
            if (quality) row.quality = quality;
          })
        );
      }
    });
    return Promise.all(tasks).then(function () {
      return rows;
    });
  }

  function fetchLibraryLatest(library) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        latestItemsPath(userId, library.Id, latestIncludeTypes(library), HUB_PREVIEW_LIMIT)
      ).then(function (data) {
        var items = (data && data.Items) || [];
        return processRows(items, 'Latest').then(function (rows) {
          return attachSeriesQualities(rows).then(function (rowsWithQuality) {
            return { library: library, rows: rowsWithQuality };
          });
        });
      });
    });
  }

  function fetchAllLibraryLatest(libraries) {
    return Promise.all(
      (libraries || []).map(function (library) {
        return fetchLibraryLatest(library).catch(function () {
          return { library: library, rows: [] };
        });
      })
    );
  }

  function fetchItems(category, startIndex) {
    return resolveUserId().then(function (userId) {
      if (category === 'Latest') return fetchLatest(userId);
      if (category === 'NextUp') return fetchNextUp(userId);
      if (category === 'Movie' && !libraryCategoryEnabled('movies')) {
        return { rows: [], total: 0, next: 0, hasMore: false };
      }
      if (category === 'Series' && !libraryCategoryEnabled('tvshows')) {
        return { rows: [], total: 0, next: 0, hasMore: false };
      }

      return jfHttp(listPath(category, userId, startIndex)).then(function (data) {
        var items = (data && data.Items) || [];
        var total =
          data && typeof data.TotalRecordCount === 'number'
            ? data.TotalRecordCount
            : items.length;
        return processRows(items, category).then(function (rows) {
          var rowsWithQuality =
            category === 'Series' ? attachSeriesQualities(rows) : Promise.resolve(rows);
          return rowsWithQuality.then(function (ready) {
            return {
              rows: ready,
              total: total,
              next: (startIndex || 0) + items.length,
              hasMore: (startIndex || 0) + items.length < total,
            };
          });
        });
      });
    });
  }

  function hubSection(result, category) {
    var rows = (result && result.rows) || [];
    return {
      category: category,
      rows: rows.slice(0, HUB_PREVIEW_LIMIT),
      total: (result && result.total) || rows.length,
      previewPosters: rows
        .slice(0, 3)
        .map(function (row) {
          return row.displayPoster || row.poster;
        })
        .filter(function (url) {
          return url && url !== IMG_PLACEHOLDER;
        }),
    };
  }

  function fetchHubData() {
    if (hubDataInflight) return hubDataInflight;

    hubDataInflight = Promise.all([
      safeFetchLibraries(),
      fetchItems('Resume', 0),
      fetchItems('NextUp', 0),
    ])
      .then(function (parts) {
        var libraries = parts[0];
        return fetchAllLibraryLatest(libraries).then(function (libSections) {
          return {
            libraries: libraries,
            resume: hubSection(parts[1], 'Resume'),
            nextup: hubSection(parts[2], 'NextUp'),
            libraryLatest: libSections,
          };
        });
      })
      .finally(function () {
        hubDataInflight = null;
      });

    return hubDataInflight;
  }

  function bindJellyfinCard($card, row, ctx) {
    $card.on('hover:touch', function () {
      if (ctx.onTouch) ctx.onTouch(this, $card, row);
    });
    $card.on('hover:focus', function () {
      if (ctx.onFocus) ctx.onFocus(this, $card, row);
    });
    if (ctx.owner) {
      $card.on('visible', function () {
        try {
          if (Lampa.Controller.own(ctx.owner)) Lampa.Controller.collectionAppend($card);
        } catch (e) { }
      });
    }
    if (ctx.interactive !== false) {
      var tapToPlay = ctx.tapToPlay;
      $card.on('hover:enter', function () {
        if (row.type === 'Photo') openPhotoViewerFlow(row);
        else if (row.type === 'PhotoAlbum') openFolderRow(row);
        else if (row.type === 'MusicAlbum') playMusicAlbum(row);
        else if (isFolderRowType(row.type)) {
          if (ctx && (ctx.homeMedia || ctx.musicMedia)) openFolderRow(row);
          else openBoxCard(row);
        } else if (row.type === 'Audio') playMediaRow(row);
        else if (row.type === 'Video' && ctx && ctx.homeMedia) playMediaRow(row);
        else if (ctx && ctx.playOnEnter) playMediaRow(row);
        else if (tapToPlay) playMediaRow(row);
        else openMediaCard(row);
      });
      $card.on('hover:long', function () {
        if (row.type === 'PhotoAlbum') openFolderRow(row);
        else if (isFolderRowType(row.type)) {
          if (ctx && (ctx.homeMedia || ctx.musicMedia)) openFolderRow(row);
          else openBoxCard(row);
        }
      });
    }
    $card.on('jf:update', function (_e, updated) {
      if (ctx && ctx.seriesDisplay) updated = episodeSeriesDisplayRow(updated);
      injectCardChrome($card, updated, { hubLine: !!(ctx && ctx.compact) });
      updateCardPoster($card, updated);
      $card.find('.card__title').text(ctx && ctx.compact ? hubCardTitle(updated) : updated.title);
      if (updated.year) $card.find('.card__age').text(updated.year);
      if (ctx && ctx.compact) applyHubCardMeta($card, updated);
    });
  }

  function episodeSeriesDisplayRow(row) {
    if (!row || row.type !== 'Episode' || !row.raw || !row.raw.SeriesId) return row;
    var seriesName =
      cleanJellyfinName(row.raw.SeriesName) || row.raw.SeriesName || row.title || '';
    var poster = seriesPosterFromItem(row.raw);
    return Object.assign({}, row, {
      title: seriesName,
      poster: poster !== IMG_PLACEHOLDER ? poster : row.poster,
      displayPoster: poster !== IMG_PLACEHOLDER ? poster : row.displayPoster,
    });
  }

  function applyHubCardMeta($card, row) {
    var $view = $card.find('.card__view');
    $view.find('.card__vote').remove();

    if (row.rating && parseFloat(row.rating) > 0) {
      $view.append($('<div class="card__vote"></div>').text(row.rating));
    }
  }

  function makeJellyfinCard(row, ctx) {
    if (ctx && ctx.seriesDisplay) row = episodeSeriesDisplayRow(row);
    var title = ctx && ctx.compact ? hubCardTitle(row) : row.title;
    var $card = Lampa.Template.get('card', {
      title: title,
      release_year: row.year,
    });
    $card.addClass('card--loaded jellyfin-card');
    if (ctx && ctx.compact) $card.addClass('jellyfin-card--hub-line');
    updateCardPoster($card, row);
    injectCardChrome($card, row, { hubLine: !!(ctx && ctx.compact) });
    if (ctx && ctx.compact) applyHubCardMeta($card, row);
    bindJellyfinCard($card, row, ctx);
    if (ctx.cardsById) ctx.cardsById[String(row.id)] = { $card: $card, row: row };
    return $card;
  }

  function makeFolderCard(folder, onFocus, opts) {
    opts = opts || {};
    var $card = Lampa.Template.get('jellyfin_folder', {});
    $card.find('.bookmarks-folder__title').text(folder.title || '');
    $card.find('.bookmarks-folder__num').text(String(folder.count || 0));

    var posters = (folder.posters || []).slice(0, 3);
    if (!posters.length) posters = [IMG_PLACEHOLDER];

    var $body = $card.find('.bookmarks-folder__body');
    posters.forEach(function (src, idx) {
      var $img = $('<img class="card__img i-' + idx + '">');
      $img.attr('src', src || IMG_PLACEHOLDER);
      $body.append($img);
    });

    $card.addClass('card--loaded');
    $card.on('hover:touch', function () {
      if (opts.onTouch) opts.onTouch(this, $card);
    });
    $card.on('hover:focus', function () {
      if (onFocus) onFocus(this, $card);
      var bg = posters[0];
      if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
    });
    if (!opts.noEnter) {
      $card.on('hover:enter', function () {
        if (folder.category) openCategory(folder.category);
      });
    }
    return $card;
  }

  function hubCategoryFromKey(key) {
    if (key === 'resume') return 'Resume';
    if (key === 'latest') return 'Latest';
    if (key === 'movies') return 'Movie';
    if (key === 'series') return 'Series';
    return '';
  }

  function libraryImage(library) {
    if (!library || !library.Id) return IMG_PLACEHOLDER;
    var tag = library.ImageTags && library.ImageTags.Primary;
    if (!tag) return IMG_PLACEHOLDER;
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(library.Id) +
      '/Images/Primary?maxHeight=280&tag=' +
      encodeURIComponent(tag) +
      '&api_key=' +
      encodeURIComponent(apiKey())
    );
  }

  function libraryTypeKey(collectionType) {
    var ct = String(collectionType || '').trim().toLowerCase();
    if (ct === 'movies') return 'jellyfin_ct_movies';
    if (ct === 'music') return 'jellyfin_ct_music';
    if (ct === 'tvshows') return 'jellyfin_ct_tvshows';
    if (ct === 'books') return 'jellyfin_ct_books';
    if (ct === 'homevideos' || ct === 'photos') return 'jellyfin_ct_homevideos';
    if (ct === 'musicvideos') return 'jellyfin_ct_musicvideos';
    if (ct === 'mixed') return 'jellyfin_ct_mixed';
    if (ct.indexOf('movie') >= 0) return 'jellyfin_ct_movies';
    if (ct.indexOf('tv') >= 0 || ct.indexOf('show') >= 0) return 'jellyfin_ct_tvshows';
    if (ct.indexOf('music') >= 0 && ct.indexOf('video') >= 0) return 'jellyfin_ct_musicvideos';
    if (ct.indexOf('music') >= 0) return 'jellyfin_ct_music';
    if (ct.indexOf('book') >= 0) return 'jellyfin_ct_books';
    if (ct.indexOf('video') >= 0 || ct.indexOf('photo') >= 0) return 'jellyfin_ct_homevideos';
    return 'jellyfin_ct_default';
  }

  var LIBRARY_CATEGORY_PARAM = {
    movies: 'CatMovies',
    tvshows: 'CatTvshows',
    music: 'CatMusic',
    books: 'CatBooks',
    homevideos: 'CatHomevideos',
    musicvideos: 'CatMusicvideos',
    mixed: 'CatMixed',
  };

  function libraryCategoryKey(ct) {
    var s = String(ct || '').trim().toLowerCase();
    if (s === 'movies') return 'movies';
    if (s === 'music') return 'music';
    if (s === 'tvshows') return 'tvshows';
    if (s === 'books') return 'books';
    if (s === 'homevideos' || s === 'photos') return 'homevideos';
    if (s === 'musicvideos') return 'musicvideos';
    if (s === 'mixed') return 'mixed';
    if (s.indexOf('movie') >= 0) return 'movies';
    if (s.indexOf('tv') >= 0 || s.indexOf('show') >= 0) return 'tvshows';
    if (s.indexOf('music') >= 0 && s.indexOf('video') >= 0) return 'musicvideos';
    if (s.indexOf('music') >= 0) return 'music';
    if (s.indexOf('book') >= 0) return 'books';
    if (s.indexOf('video') >= 0 || s.indexOf('photo') >= 0) return 'homevideos';
    return '';
  }

  function libraryCategoryEnabled(ct) {
    var key = libraryCategoryKey(ct);
    if (!key || !LIBRARY_CATEGORY_PARAM[key]) return true;
    return storageToggle(LIBRARY_CATEGORY_PARAM[key], true);
  }

  function fetchLibraries() {
    return resolveUserId().then(function (userId) {
      return jfHttp('/Users/' + encodeURIComponent(userId) + '/Views').then(function (data) {
        var items = Array.isArray(data) ? data : (data && data.Items) || [];
        return items.filter(function (item) {
          if (!(item && item.Id && item.Type === 'CollectionFolder')) return false;
          return libraryCategoryEnabled(item.CollectionType);
        });
      });
    });
  }

  function safeFetchLibraries() {
    return fetchLibraries().catch(function () {
      return [];
    });
  }

  function libraryIncludeTypes(library) {
    var ct = String((library && library.CollectionType) || '').toLowerCase();
    if (ct === 'movies') return 'Movie';
    if (ct === 'tvshows') return 'Series';
    if (ct === 'music') return 'Audio';
    if (ct === 'musicvideos') return 'MusicVideo';
    if (ct === 'homevideos') return 'Photo,Video';
    if (ct === 'photos') return 'Photo';
    if (ct === 'books') return 'Book';
    if (ct === 'mixed') return 'Movie,Series,Video,Audio';
    return 'Movie,Series,Video,Audio,MusicVideo,Book';
  }

  function latestIncludeTypes(library) {
    var ct = String((library && library.CollectionType) || '').toLowerCase();
    if (ct === 'music') return 'MusicAlbum';
    if (ct === 'musicvideos') return 'MusicVideo';
    if (ct === 'homevideos' || ct === 'photos') return 'PhotoAlbum';
    return libraryIncludeTypes(library);
  }

  function listLibraryPath(library, userId, startIndex) {
    var fields = listFieldsQuery(startIndex);
    return (
      '/Items?UserId=' +
      encodeURIComponent(userId) +
      '&ParentId=' +
      encodeURIComponent(library.Id) +
      '&IncludeItemTypes=' +
      encodeURIComponent(libraryIncludeTypes(library)) +
      '&Recursive=true&' +
      fields
    );
  }

  function listChildrenPath(parentId, userId, startIndex) {
    var fields = listFieldsQuery(startIndex);
    return (
      '/Items?UserId=' +
      encodeURIComponent(userId) +
      '&ParentId=' +
      encodeURIComponent(parentId) +
      '&Recursive=false&' +
      fields
    );
  }

  function isFolderRowType(type) {
    return (
      type === 'Folder' ||
      type === 'PhotoAlbum' ||
      type === 'CollectionFolder' ||
      type === 'MusicAlbum'
    );
  }

  function isPlayableRowType(type) {
    return (
      type === 'Movie' ||
      type === 'Episode' ||
      type === 'Series' ||
      type === 'Audio' ||
      type === 'MusicAlbum' ||
      type === 'Video'
    );
  }

  function isMusicLibrary(library) {
    return String((library && library.CollectionType) || '').toLowerCase() === 'music';
  }

  function fetchAlbums(parentId, startIndex) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Items?UserId=' +
        encodeURIComponent(userId) +
        '&ParentId=' +
        encodeURIComponent(parentId) +
        '&IncludeItemTypes=MusicAlbum&Recursive=true&' +
        listFieldsQuery(startIndex)
      ).then(function (data) {
        var items = (data && data.Items) || [];
        var total =
          data && typeof data.TotalRecordCount === 'number'
            ? data.TotalRecordCount
            : items.length;
        return processRows(items, 'Library').then(function (rows) {
          return {
            rows: rows,
            total: total,
            next: (startIndex || 0) + items.length,
            hasMore: (startIndex || 0) + items.length < total,
          };
        });
      });
    });
  }

  function decorateChildRows(rows, path) {
    return rows.map(function (row) {
      var raw = row.raw || {};
      var name = row.title || raw.Name || '';
      if (isFolderRowType(row.type)) {
        row.displayPath = (path ? path + '/' : '/') + name;
        return row;
      }
      return row;
    });
  }

  function sortAudioRows(rows) {
    if (!rows.length || rows[0].type !== 'Audio') return rows;
    var hasIndex = rows.some(function (r) {
      return Number((r.raw || {}).IndexNumber) > 0;
    });
    if (!hasIndex) return rows;
    return rows.slice().sort(function (a, b) {
      var ai = Number((a.raw || {}).IndexNumber) || 0;
      var bi = Number((b.raw || {}).IndexNumber) || 0;
      return ai - bi;
    });
  }

  function fetchChildren(parentId, path, startIndex) {
    return resolveUserId().then(function (userId) {
      return jfHttp(listChildrenPath(parentId, userId, startIndex)).then(function (data) {
        var items = (data && data.Items) || [];
        var total =
          data && typeof data.TotalRecordCount === 'number'
            ? data.TotalRecordCount
            : items.length;
        return processRows(items, 'Library').then(function (rows) {
          return {
            rows: sortAudioRows(decorateChildRows(rows, path)),
            total: total,
            next: (startIndex || 0) + items.length,
            hasMore: (startIndex || 0) + items.length < total,
          };
        });
      });
    });
  }

  function isHomeMediaLibrary(library) {
    var ct = String((library && library.CollectionType) || '').toLowerCase();
    return ct === 'homevideos' || ct === 'photos';
  }

  function fetchLibraryItems(library, startIndex) {
    if (isMusicLibrary(library)) {
      return fetchAlbums(library.Id, startIndex);
    }
    if (isHomeMediaLibrary(library)) {
      return fetchChildren(library.Id, '', startIndex);
    }
    return resolveUserId().then(function (userId) {
      return jfHttp(listLibraryPath(library, userId, startIndex)).then(function (data) {
        var items = (data && data.Items) || [];
        var total =
          data && typeof data.TotalRecordCount === 'number'
            ? data.TotalRecordCount
            : items.length;
        return processRows(items, 'Library').then(function (rows) {
          return attachSeriesQualities(rows).then(function (rowsWithQuality) {
            return {
              rows: rowsWithQuality,
              total: total,
              next: (startIndex || 0) + items.length,
              hasMore: (startIndex || 0) + items.length < total,
            };
          });
        });
      });
    });
  }

  function jellyfinNavUrl(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === undefined || parts[i] === null) continue;
      var p = String(parts[i]).trim();
      if (!p) continue;
      out.push(encodeURIComponent(p));
    }
    return out.join('/');
  }

  function jellyfinCategoryKey(category) {
    return String(category || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'library';
  }

  function openLibrary(library) {
    if (!library || !library.Id) return;
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'library', library.Id]),
      title: library.Name || Lampa.Lang.translate('jellyfin_mylib'),
      component: PANEL_COMPONENT,
      category: 'Library',
      libraryId: library.Id,
      library: {
        Id: library.Id,
        Name: library.Name,
        CollectionType: library.CollectionType,
        ImageTags: library.ImageTags,
      },
      homeMedia: isHomeMediaLibrary(library),
      musicMedia: isMusicLibrary(library),
      page: 1,
    });
  }

  function openFolderRow(row) {
    if (!row || !row.id) return;
    var path = row.displayPath || row.title || '';
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'folder', row.id]),
      title: row.title || path,
      component: PANEL_COMPONENT,
      category: 'Library',
      parentId: row.id,
      path: path,
      homeMedia: true,
      musicMedia: true,
      page: 1,
    });
  }

  function itemImageUrl(id, opts) {
    if (!id) return '';
    opts = opts || {};
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(id) +
      '/Images/Primary?maxWidth=' +
      (opts.maxWidth || 1280) +
      '&maxHeight=' +
      (opts.maxHeight || 720) +
      '&quality=90&api_key=' +
      encodeURIComponent(apiKey())
    );
  }

  function jellyfinDetailUrl(itemId, userId) {
    return (
      '/Users/' +
      encodeURIComponent(userId) +
      '/Items/' +
      encodeURIComponent(itemId) +
      '?Fields=Overview,Genres,CommunityRating,ProductionYear,PremiereDate,OriginalTitle,ImageTags,Path,RunTimeTicks'
    );
  }

  function openBoxCard(row) {
    if (!row) return;
    if (row.tmdb) {
      openMediaCard(row);
      return;
    }
    openJellyfinCard(row);
  }

  function openJellyfinCard(row) {
    if (!row) return;
    var jfType = String(row.type || (row.raw && row.raw.Type) || 'Movie');
    var id = String(row.id || (row.raw && row.raw.Id) || '');
    rememberCardReturn(id);
    var method = jfType === 'Series' || jfType === 'Season' || jfType === 'Episode' ? 'tv' : 'movie';
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'card', method, id]),
      title: (row && row.title) || '',
      component: 'full',
      jellyfinRow: row,
      category: 'Library',
      id: id,
      method: method,
      source: 'jellyfin',
      card: { id: id, source: 'jellyfin' },
    });
  }

  function jellyfinCountryCode(name) {
    var map = {
      'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Andorra': 'AD',
      'Argentina': 'AR', 'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT',
      'Azerbaijan': 'AZ', 'Bahamas': 'BS', 'Bangladesh': 'BD', 'Belarus': 'BY',
      'Belgium': 'BE', 'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA',
      'Brazil': 'BR', 'Bulgaria': 'BG', 'Cambodia': 'KH', 'Canada': 'CA',
      'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Costa Rica': 'CR',
      'Croatia': 'HR', 'Cuba': 'CU', 'Cyprus': 'CY', 'Czech Republic': 'CZ',
      'Czechoslovakia': 'CS', 'Denmark': 'DK', 'Dominican Republic': 'DO',
      'Ecuador': 'EC', 'Egypt': 'EG', 'Estonia': 'EE', 'Ethiopia': 'ET',
      'Finland': 'FI', 'France': 'FR', 'Georgia': 'GE', 'Germany': 'DE',
      'Greece': 'GR', 'Guatemala': 'GT', 'Hong Kong': 'HK', 'Hungary': 'HU',
      'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR',
      'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
      'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ',
      'Kenya': 'KE', 'South Korea': 'KR', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG',
      'Latvia': 'LV', 'Lebanon': 'LB', 'Lithuania': 'LT', 'Luxembourg': 'LU',
      'Malaysia': 'MY', 'Mexico': 'MX', 'Moldova': 'MD', 'Monaco': 'MC',
      'Mongolia': 'MN', 'Morocco': 'MA', 'Netherlands': 'NL',
      'New Zealand': 'NZ', 'Nicaragua': 'NI', 'Nigeria': 'NG',
      'North Korea': 'KP', 'Norway': 'NO', 'Pakistan': 'PK', 'Panama': 'PA',
      'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL',
      'Portugal': 'PT', 'Puerto Rico': 'PR', 'Romania': 'RO', 'Russia': 'RU',
      'Russian Federation': 'RU', 'Saudi Arabia': 'SA', 'Serbia': 'RS',
      'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI',
      'South Africa': 'ZA', 'Spain': 'ES', 'Sri Lanka': 'LK',
      'Sweden': 'SE', 'Switzerland': 'CH', 'Taiwan': 'TW', 'Thailand': 'TH',
      'Tunisia': 'TN', 'Turkey': 'TR', 'Ukraine': 'UA',
      'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
      'Great Britain': 'GB', 'United States': 'US', 'USA': 'US',
      'United States of America': 'US', 'Uruguay': 'UY', 'Uzbekistan': 'UZ',
      'Venezuela': 'VE', 'Vietnam': 'VN', 'West Germany': 'DE',
      'Soviet Union': 'RU', 'Yugoslavia': 'YU'
    };
    return map[name] || '';
  }

  function jellyfinProductionCountries(raw) {
    var locs = raw.ProductionLocations || [];
    return locs.map(function (name) {
      var code = jellyfinCountryCode(name);
      return code ? { iso_3166_1: code, name: name } : { name: name };
    });
  }

  function jellyfinMovieShape(row) {
    var raw = (row && row.raw) || {};
    var type = row && row.type ? String(row.type) : String(raw.Type || 'Movie');
    var isSeries = type === 'Series' || type === 'Season';
    var name = (row && row.title) || raw.Name || raw.OriginalTitle || '';
    var originalName = raw.OriginalTitle || raw.Name || name;
    var date = String(raw.PremiereDate || '').slice(0, 10);
    if (!date && raw.ProductionYear) date = String(raw.ProductionYear) + '-01-01';
    var poster = (row && (row.poster || row.displayPoster)) || posterUrl(raw);
    if (!poster || poster === IMG_PLACEHOLDER) poster = './img/img_broken.svg';
    var pgMatch = String(raw.OfficialRating || '').match(/(\d{1,2})/);
    var restrict = pgMatch ? Number(pgMatch[1]) : '';
    var backdrop = '';
    if (raw.Id && raw.BackdropImageTags && raw.BackdropImageTags.length) {
      backdrop =
        apiBase() +
        '/Items/' +
        encodeURIComponent(raw.BackdropItemId || raw.Id) +
        '/Images/Backdrop?tag=' +
        encodeURIComponent(raw.BackdropImageTags[0]) +
        '&api_key=' +
        encodeURIComponent(apiKey());
    }
    var movie = {
      id: (row && row.id) || raw.Id || '',
      source: 'jellyfin',
      title: name,
      original_title: originalName,
      overview: raw.Overview || '',
      img: poster,
      poster_path: '',
      background_image: backdrop,
      release_date: isSeries ? '' : date,
      first_air_date: isSeries ? date : '',
      genres: (raw.Genres || []).map(function (g) {
        return { name: String(g) };
      }),
      production_countries: jellyfinProductionCountries(raw),
      production_companies: [],
      vote_average: Number(raw.CommunityRating) || parseFloat(row && row.rating ? row.rating : 0) || 0,
      vote_count: 0,
      runtime: raw.RunTimeTicks ? Math.round(raw.RunTimeTicks / 600000000) : 0,
      budget: 0,
      tagline: '',
      restrict: restrict,
    };
    if (isSeries) {
      movie.name = name;
      movie.original_name = originalName;
      var seasonItems = raw.Seasons || [];
      movie.seasons = seasonItems.map(function (s) {
        return { episode_count: Number(s.ChildCount) || 0 };
      });
      movie.number_of_seasons = seasonItems.length ? seasonItems.length : movie.seasons.length;
      var totalEpisodes = 0;
      seasonItems.forEach(function (s) {
        totalEpisodes += Number(s.ChildCount) || 0;
      });
      movie.number_of_episodes = totalEpisodes;
    }
    return movie;
  }

  function jellyfinPersonImage(person) {
    if (!person || !person.Id) return '';
    var key = apiKey();
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(person.Id) +
      '/Images/Primary?maxWidth=300&maxHeight=450' +
      (person.PrimaryImageTag
        ? '&tag=' + encodeURIComponent(person.PrimaryImageTag)
        : '') +
      '&quality=90&api_key=' +
      encodeURIComponent(key)
    );
  }

  function jellyfinPersons(item) {
    var people = (item && item.People) || [];
    if (!people.length) return null;
    var crew = [];
    var cast = [];
    var seenCrew = {};
    var seenCast = {};
    var limitCast = 40;

    for (var i = 0; i < people.length; i++) {
      var p = people[i] || {};
      var name = String(p.Name || '').trim();
      var type = String(p.Type || '');
      if (!name) continue;

      var person = {
        name: name,
        character: '',
        job: '',
        img: jellyfinPersonImage(p),
        params: {
          emit: {
            onEnter: function (html, obj) {
              openTmdbActor(obj);
            },
          },
        },
      };

      if (type === 'Director') {
        if (seenCrew[name]) continue;
        seenCrew[name] = 1;
        person.job = 'Director';
        crew.push(person);
      } else if (type === 'Actor') {
        if (seenCast[name]) continue;
        seenCast[name] = 1;
        person.character = String(p.Role || '').trim();
        cast.push(person);
      }
    }

    if (!crew.length && !cast.length) return null;
    var persons = {};
    if (crew.length) persons.crew = crew;
    if (cast.length) persons.cast = cast.slice(0, limitCast);
    return persons;
  }

  function openTmdbActor(person) {
    var name = person && (person.name || person.title || '');
    if (!name) return;
    var tmdb =
      Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
    if (!tmdb || typeof tmdb.get !== 'function') return;
    tmdb.get(
      'search/person',
      { query: name },
      function (json) {
        var results = (json && json.results) || [];
        if (!results.length) {
          Lampa.Bell.push({
            text: Lampa.Lang.translate('jellyfin_person_not_found'),
          });
          return;
        }
        Lampa.Router.call('actor', results[0]);
      },
      function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      }
    );
  }

  function jellyfinFullData(row, oncomplite) {
    var data;
    var build = function (srcRow, persons) {
      try {
        data = { movie: jellyfinMovieShape(srcRow) };
      } catch (e) {
        data = {
          movie: {
            id: (srcRow && (srcRow.id || (srcRow.raw && srcRow.raw.Id))) || '',
            source: 'jellyfin',
            title: (srcRow && srcRow.title) || '',
            name: (srcRow && srcRow.title) || '',
            img: './img/img_broken.svg',
          },
        };
      }
      if (persons) data.persons = persons;
      oncomplite(data);
    };
    var itemId = (row && (row.id || (row.raw && row.raw.Id))) || '';
    if (!itemId) {
      build(row);
      return;
    }
    resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Users/' +
          encodeURIComponent(userId) +
          '/Items/' +
          encodeURIComponent(itemId) +
          '?Fields=Overview,Genres,CommunityRating,ProductionYear,PremiereDate,OriginalTitle,ImageTags,RunTimeTicks,Seasons,OfficialRating,ProductionLocations,People'
        ).then(function (item) {
          if (String(item.Type || '') !== 'Series') return item;
          return jfHttp(
            '/Shows/' +
            encodeURIComponent(itemId) +
            '/Seasons?UserId=' +
            encodeURIComponent(userId) +
            '&Fields=ChildCount'
          ).then(function (data) {
            var seasons = (data && data.Items) || [];
            if (!seasons.length) return item;
            return Object.assign({}, item, { Seasons: seasons });
          });
        });
      })
      .then(function (item) {
        var freshRow = Object.assign({}, row, {
          raw: Object.assign({}, row && row.raw, item),
          type: item.Type || (row && row.type) || '',
        });
        build(freshRow, jellyfinPersons(item));
      })
      .catch(function () {
        build(row);
      });
  }

  function wrapApiFull() {
    var api = Lampa.Api;
    if (!api || typeof api.full !== 'function') return;
    if (api.full._jfWrapped) return;
    var original = api.full;
    api.full = function (params, oncomplite, onerror) {
      if (params && typeof oncomplite === 'function') {
        if (params.jellyfinRow) {
          jellyfinFullData(params.jellyfinRow, oncomplite);
          return;
        }
        var jfSource = params.source === 'jellyfin' || (params.card && params.card.source === 'jellyfin');
        var jfId = String(params.id || (params.card && params.card.id) || '');
        if (jfSource && jfId) {
          var row = {
            id: jfId,
            raw: { Id: jfId },
            title: params.title || '',
            type: params.method === 'tv' ? 'Series' : 'Movie',
          };
          params.jellyfinRow = row;
          jellyfinFullData(row, oncomplite);
          return;
        }
      }
      return original.apply(api, arguments);
    };
    api.full._jfWrapped = true;
  }

  function makeLibraryCard(library, onFocus, opts) {
    opts = opts || {};
    var $card = Lampa.Template.get('jellyfin_library', {});
    $card.find('.jellyfin-library__title').text(library.Name || '');
    $card.find('.jellyfin-library__badge').text(
      Lampa.Lang.translate(libraryTypeKey(library.CollectionType))
    );
    var img = libraryImage(library);
    $card.find('.jellyfin-library__img').attr('src', img);
    $card.addClass('card--loaded');
    $card.on('hover:touch', function () {
      if (opts.onTouch) opts.onTouch(this, $card);
    });
    $card.on('hover:focus', function () {
      if (onFocus) onFocus(this, $card);
      if (img && img !== IMG_PLACEHOLDER) Lampa.Background.change(img);
    });
    if (!opts.noEnter) {
      $card.on('hover:enter', function () {
        openLibrary(library);
      });
    }
    return $card;
  }

  function buildHubLines(data) {
    var lines = [];
    if (data.libraries && data.libraries.length) {
      lines.push({
        title: Lampa.Lang.translate('jellyfin_mylib'),
        _jf_libraries: true,
        noimage: true,
        results: data.libraries.map(function (library) {
          return {
            jellyfin_library: library,
            title: library.Name || '',
          };
        }),
      });
    }

    function pushSection(spec) {
      var results = [];
      spec.rows.forEach(function (row) {
        results.push({
          jellyfin_row: row,
          title: hubCardTitle(row),
          release_year: row.year,
        });
      });
      if (!results.length) return;

      var more = spec.more !== undefined ? spec.more : spec.total > spec.rows.length;
      lines.push({
        title: spec.title,
        category: spec.category,
        _jf_key: spec.key,
        homeMedia: !!spec.homeMedia,
        noimage: true,
        more: more,
        nomore: !more,
        onMore: spec.onMore,
        results: results,
      });
    }

    if (data.resume.rows.length) {
      pushSection({
        key: 'resume',
        title: Lampa.Lang.translate('jellyfin_resume'),
        category: 'Resume',
        rows: data.resume.rows,
        total: data.resume.total,
      });
    }

    if (data.nextup.rows.length) {
      pushSection({
        key: 'nextup',
        title: Lampa.Lang.translate('jellyfin_nextup'),
        category: 'NextUp',
        rows: data.nextup.rows,
        total: data.nextup.total,
      });
    }

    (data.libraryLatest || []).forEach(function (section) {
      if (!section.rows.length) return;
      var library = section.library;
      pushSection({
        key: 'lib-' + library.Id,
        title: Lampa.Lang.translate('jellyfin_recently') + ' ' + library.Name,
        category: 'Latest',
        homeMedia: isHomeMediaLibrary(library),
        rows: section.rows,
        total: section.rows.length,
        more: true,
        onMore: function () {
          openLibrary(library);
        },
      });
    });

    return lines;
  }

  function attachHubRowListener(hubCtx) {
    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = hubCtx.cardsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      slot.$card.trigger('jf:update', [e.row]);
    }
    hubCtx.onRowUpdated = onRowUpdated;
    Lampa.Listener.follow('jellyfin:row-updated', onRowUpdated);
  }

  function detachHubRowListener(hubCtx) {
    if (hubCtx.onRowUpdated) Lampa.Listener.remove('jellyfin:row-updated', hubCtx.onRowUpdated);
  }

  function attachHubRefreshListener(hubCtx) {
    function onHubRefresh() {
      if (hubCtx.refreshHub) hubCtx.refreshHub();
    }
    hubCtx.onHubRefresh = onHubRefresh;
    Lampa.Listener.follow('jellyfin:hub-refresh', onHubRefresh);
  }

  function detachHubRefreshListener(hubCtx) {
    if (hubCtx.onHubRefresh) Lampa.Listener.remove('jellyfin:hub-refresh', hubCtx.onHubRefresh);
  }

  function hubHasContent(data) {
    if (data.resume.rows.length || data.nextup.rows.length) return true;
    var libs = data.libraryLatest || [];
    for (var i = 0; i < libs.length; i++) {
      if (libs[i].rows.length) return true;
    }
    return false;
  }

  function HubFallbackComponent(object, hubCtx) {
    var self = this;
    var scroll = new Lampa.Scroll({ mask: true, over: true, scroll_by_item: true, end_ratio: 1.5 });
    var html = $('<div class="jellyfin-hub"></div>');
    var lines = [];
    var active = 0;

    function clearHubLines() {
      lines.forEach(function (line) {
        try {
          line.destroy();
        } catch (e) { }
      });
      lines = [];
      active = 0;
      try {
        scroll.body().empty();
        scroll._items = [];
        scroll.active = 0;
      } catch (e) { }
    }

    function reorderHubDom() {
      try {
        var $body = scroll.body();
        var wanted = lines.map(function (line) { return line.render(); });
        var current = $body.children().toArray();
        var same = current.length === wanted.length;
        if (same) {
          for (var i = 0; i < current.length; i++) {
            if (current[i] !== wanted[i][0]) { same = false; break; }
          }
        }
        if (!same) {
          wanted.forEach(function ($el) { $body.append($el[0]); });
        }
        scroll._items = wanted;
        scroll.active = Math.max(0, Math.min(scroll.active, lines.length - 1));
      } catch (e) { }
    }

    function syncHubLines(data) {
      var next = buildHubLines(data);
      var byKey = {};
      lines.forEach(function (line) {
        byKey[line._jf_key || 'libraries'] = line;
      });

      var nextKeys = {};
      next.forEach(function (lineData) {
        nextKeys[lineData._jf_key || 'libraries'] = true;
      });

      var kept = [];
      var created = [];
      next.forEach(function (lineData) {
        var key = lineData._jf_key || 'libraries';
        var line = byKey[key];
        if (line) {
          if (key !== 'libraries') line.updateData(lineData);
          kept.push(line);
          return;
        }
        var nl = new HubLineFallback(lineData, hubCtx);
        nl._jf_key = key;
        nl.create();
        nl.onDown = self.down.bind(self);
        nl.onUp = self.up.bind(self);
        nl.onBack = self.back.bind(self);
        nl.onToggle = function () {
          scroll.update(nl.render());
        };
        created.push(nl);
      });

      lines.forEach(function (line) {
        var key = line._jf_key || 'libraries';
        if (!nextKeys[key]) {
          try { line.destroy(); } catch (e) { }
        }
      });

      created.forEach(function (nl) {
        scroll.append(nl.render());
      });

      lines = kept.concat(created);
      active = Math.max(0, Math.min(active, lines.length - 1));
      reorderHubDom();

      scroll.minus();
      if (lines.length) scroll.update(lines[0].render());
      if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
      if (lines.length && screenTv()) {
        try {
          var act = Lampa.Activity.active();
          if (act && act.activity === self.activity) lines[active].toggle();
        } catch (e) { }
      }
    }

    function renderData(data) {
      if (!hubHasContent(data) && !(data.libraries && data.libraries.length)) {
        clearHubLines();
        scroll.append(
          $('<div class="jellyfin-state jellyfin-hub-empty"><div class="jellyfin-state__title">' +
            Lampa.Lang.translate('jellyfin_empty') +
            '</div></div>')
        );
        return;
      }
      syncHubLines(data);
    }

    function loadData() {
      fetchHubData()
        .then(function (data) {
          renderData(data);
        })
        .catch(function () {
          if (!lines.length) {
            scroll.append(
              $('<div class="jellyfin-state"><div class="jellyfin-state__title">' +
                Lampa.Lang.translate('jellyfin_error') +
                '</div></div>')
            );
          }
        })
        .then(function () {
          self.activity.loader(false);
          try {
            if (Lampa.Player && typeof Lampa.Player.playdata === 'function' && Lampa.Player.playdata()) return;
            if (Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened()) return;
          } catch (e) { }
          self.activity.toggle();
        });
    }

    this.create = function () {
      self.activity.loader(true);
      html.append(scroll.render());

      bindScrollLayerVisible(scroll);

      scroll.onWheel = function (step) {
        if (!Lampa.Controller.own(self)) self.start();
        if (step > 0) self.down();
        else if (active > 0) self.up();
      };

      loadData();

      return html;
    };

    this.refresh = function () {
      if (self.destroyed) return;
      loadData();
    };

    this.down = function () {
      if (!lines.length) return;
      active = Math.min(active + 1, lines.length - 1);
      scroll.update(lines[active].render());
      lines[active].toggle();
    };

    this.up = function () {
      if (!lines.length) return;
      active--;
      if (active < 0) {
        active = 0;
        Lampa.Controller.toggle('head');
      } else {
        lines[active].toggle();
        scroll.update(lines[active].render());
      }
    };

    this.start = function () {
      self.background();
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          if (!lines.length) return;
          scroll.restorePosition();
          if (screenTv()) lines[active].toggle();
          else if (lines[active]) scroll.update(lines[active].render());
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else if (active > 0) self.up();
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (Navigator.canmove('down')) Navigator.move('down');
          else self.down();
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      Lampa.Background.immediately('');
    };
    this.pause = function () { };
    this.stop = function () { };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      detachHubRefreshListener(hubCtx);
      detachHubRowListener(hubCtx);
      hubCtx.cardsById = {};
      lines.forEach(function (line) {
        line.destroy();
      });
      lines = [];
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function HubComponent(object) {
    var hubCtx = {
      tapToPlay: storageToggle('TapPlay', false),
      cardsById: {},
    };

    attachHubRowListener(hubCtx);
    var comp = new HubFallbackComponent(object, hubCtx);
    hubCtx.refreshHub = function () {
      comp.refresh();
    };
    attachHubRefreshListener(hubCtx);
    return comp;
  }

  function HubLineFallback(data, hubCtx) {
    var self = this;
    var content = Lampa.Template.get('items_line', { title: data.title || '' });
    var body = content.find('.items-line__body');
    var scroll = new Lampa.Scroll({ horizontal: true, step: 300 });
    var last = null;
    var boxes = [];
    var $lineNav = null;

    function lineBoxIndex() {
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i][0] === last) return i;
      }
      return -1;
    }

    function updateLineNav() {
      if (!$lineNav) return;
      var idx = lineBoxIndex();
      $lineNav.find('.jellyfin-line-nav__btn--prev')
        .toggleClass('jellyfin-line-nav__btn--disabled', idx <= 0);
      $lineNav.find('.jellyfin-line-nav__btn--next')
        .toggleClass('jellyfin-line-nav__btn--disabled', idx >= boxes.length - 1);
    }

    function stepLine(dir) {
      if (!boxes.length) return;
      var idx = lineBoxIndex();
      if (idx < 0) idx = dir > 0 ? -1 : boxes.length;
      var target = Math.max(0, Math.min(boxes.length - 1, idx + dir));
      var $el = boxes[target];
      last = $el[0];
      try {
        $el.trigger('hover:focus');
      } catch (e) { }
      try {
        if (Lampa.Controller && Lampa.Controller.collectionFocus) {
          Lampa.Controller.collectionFocus($el[0], scroll.render(true));
        }
      } catch (e) { }
      updateLineNav();
    }

    var lastNavStep = 0;
    function navStep(dir) {
      var now = Date.now();
      if (now - lastNavStep < 250) return;
      lastNavStep = now;
      stepLine(dir);
    }

    function buildLineNav() {
      if (data._jf_stats || !data.title) return;
      if (boxes.length < 2) return;
      $lineNav = $('<div class="jellyfin-line-nav"></div>');
      $('<div class="jellyfin-line-nav__btn jellyfin-line-nav__btn--prev selector">' +
        PHOTO_ARROW_LEFT_SVG + '</div>')
        .on('hover:enter click hover:hover hover:touch mouseenter touchstart', function () { navStep(-1); })
        .appendTo($lineNav);
      $('<div class="jellyfin-line-nav__btn jellyfin-line-nav__btn--next selector">' +
        PHOTO_ARROW_RIGHT_SVG + '</div>')
        .on('hover:enter click hover:hover hover:touch mouseenter touchstart', function () { navStep(1); })
        .appendTo($lineNav);
      content.find('.items-line__head').append($lineNav);
      updateLineNav();
    }

    content.addClass('items-line--type-' + (data._jf_stats ? 'default' : 'cards'));
    if (data._jf_stats) content.addClass('items-line--jf-stats');
    if (!data.title) content.addClass('items-line--jf-no-title');

    function bindLineFocus($el, focusBg) {
      $el.on('hover:touch', function (e) {
        last = e.target;
      });
      $el.on('hover:focus', function (e) {
        last = e.target;
        scroll.update($el, true);
        updateLineNav();
        if (focusBg && focusBg !== IMG_PLACEHOLDER) Lampa.Background.change(focusBg);
      });
      $el.on('visible', function () {
        try {
          if (Lampa.Controller.own(self)) Lampa.Controller.collectionAppend($el);
        } catch (e) { }
      });
    }

    function destroyBoxes() {
      boxes.forEach(function ($el) {
        try {
          $el.remove();
        } catch (e) { }
      });
      boxes = [];
      last = null;
      try {
        scroll.body().empty();
        scroll._items = [];
        scroll.active = 0;
      } catch (e) { }
      if ($lineNav) {
        try {
          $lineNav.remove();
        } catch (e) { }
        $lineNav = null;
      }
    }

    function buildBoxes() {
      (data.results || []).forEach(function (element) {
        var $render = null;

        if (element._jf_stat) {
          var stat = element._jf_stat;
          $render = Lampa.Template.get('register');
          $render.addClass('selector register--line');
          $render.find('.register__name').text(stat.label || '');
          $render.find('.register__counter').text(String(stat.value == null ? 0 : stat.value));
          $render.on('hover:enter', function () {
            var category = hubCategoryFromKey(stat.key);
            if (category) openCategory(category);
          });
          bindLineFocus($render, null);
        } else if (element.jellyfin_library) {
          var library = element.jellyfin_library;
          $render = makeLibraryCard(
            library,
            function (el, $card) {
              last = el;
              scroll.update($card, true);
              updateLineNav();
            },
            {
              onTouch: function (el) {
                last = el;
              },
            }
          );
        } else if (element.jellyfin_folder) {
          var folder = element.jellyfin_folder;
          $render = makeFolderCard(
            folder,
            function (el, $card) {
              last = el;
              scroll.update($card, true);
              updateLineNav();
            },
            {
              onTouch: function (el) {
                last = el;
              },
            }
          );
        } else if (element.jellyfin_row) {
          var row = element.jellyfin_row;
          var rowBg = row.displayPoster || row.poster;
          var seriesLine = data.category === 'NextUp' || data.category === 'Resume';
          $render = makeJellyfinCard(row, {
            tapToPlay: hubCtx.tapToPlay,
            playOnEnter: seriesLine,
            seriesDisplay: seriesLine,
            homeMedia: data.homeMedia,
            cardsById: hubCtx.cardsById,
            compact: true,
            onTouch: function (el) {
              last = el;
            },
            onFocus: function (el, $card) {
              last = el;
              scroll.update($card, true);
              updateLineNav();
              if (rowBg && rowBg !== IMG_PLACEHOLDER) Lampa.Background.change(rowBg);
            },
          });
        }

        if (!$render) return;

        scroll.append($render);
        boxes.push($render);
      });

      if (data.category && data.more && !data.nomore) {
        var $more = Lampa.Template.get('card', { title: '', release_year: '' });
        $more.addClass('card--loaded jellyfin-card jellyfin-card--hub-line jellyfin-more-card selector');
        $more.find('.card__age').remove();
        var $moreImg = $more.find('.card__img');
        if ($moreImg.length) $moreImg.attr('src', IMG_PLACEHOLDER);
        $more.find('.card__view').append(
          $('<div class="jellyfin-more-card__label"></div>').text(
            Lampa.Lang.translate('jellyfin_more')
          )
        );
        $more.on('hover:enter', function () {
          if (data.onMore) data.onMore();
          else if (data.category) openCategory(data.category);
        });
        bindLineFocus($more);
        scroll.append($more);
        boxes.push($more);
      }

      buildLineNav();
    }

    this.create = function () {
      scroll.body().addClass('items-cards mapping--line');
      if (data.title) content.find('.items-line__title').text(data.title);

      bindScrollLayerVisible(scroll);

      scroll.onWheel = function (step) {
        if (!Lampa.Controller.own(self)) self.toggle();
        var ctl = Lampa.Controller.enabled().controller;
        if (ctl) ctl[step > 0 ? 'right' : 'left']();
      };

      buildBoxes();

      body.append(scroll.render());
      setTimeout(function () {
        content.trigger('visible');
        scheduleReflowFocus(scroll, null, last, { layerOnly: true });
      }, 0);
    };

    this.updateData = function (lineData) {
      data.title = lineData.title;
      data.category = lineData.category;
      data.results = lineData.results || [];
      data.more = lineData.more;
      data.nomore = lineData.nomore;
      data.onMore = lineData.onMore;
      data.homeMedia = lineData.homeMedia;
      destroyBoxes();
      buildBoxes();
      if (data.title) content.find('.items-line__title').text(data.title);
      content.show();
      content.trigger('visible');
      scheduleReflowFocus(scroll, null, last, { layerOnly: true });
    };

    this.toggle = function () {
      Lampa.Controller.add('items_line', {
        link: self,
        toggle: function () {
          Lampa.Controller.collectionSet(scroll.render(true));
          Lampa.Controller.collectionFocus(last || false, scroll.render(true));
          if (self.onToggle) self.onToggle();
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else if (self.onLeft) self.onLeft();
          else Lampa.Controller.toggle('menu');
        },
        down: this.onDown,
        up: this.onUp,
        gone: function () { },
        back: this.onBack,
      });
      Lampa.Controller.toggle('items_line');
    };

    this.render = function () {
      return content;
    };

    this.destroy = function () {
      scroll.destroy();
      content.remove();
    };
  }

  function fetchEpisodes(seriesId) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Items?UserId=' +
        encodeURIComponent(userId) +
        '&ParentId=' +
        encodeURIComponent(seriesId) +
        '&IncludeItemTypes=Episode&Recursive=true&Fields=' +
        encodeURIComponent(
          'ProviderIds,ImageTags,IndexNumber,ParentIndexNumber,UserData,SeriesName,SeriesPrimaryImageTag,SeriesThumbImageTag,Name,RunTimeTicks,MediaSourceCount,MediaSources,Overview'
        ) +
        '&SortBy=ParentIndexNumber&SortBy=IndexNumber&SortOrder=Ascending'
      ).then(function (data) {
        return processRows((data && data.Items) || [], 'Episode');
      });
    });
  }

  function refreshLibraryIndex(force) {
    if (!force && libraryIndex.loadedAt && Date.now() - libraryIndex.loadedAt < LIBRARY_INDEX_TTL_MS) {
      return Promise.resolve(libraryIndex.byTmdb);
    }
    if (libraryIndexInflight) return libraryIndexInflight;

    libraryIndexInflight = resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Items?UserId=' +
          encodeURIComponent(userId) +
          '&Recursive=true&IncludeItemTypes=Movie,Series&Fields=' +
          encodeURIComponent(
            'ProviderIds,Type,Id,Name,UserData,ImageTags,MediaSourceCount,MediaSources'
          ) +
          '&Limit=500'
        );
      })
      .then(function (data) {
        var byTmdb = {};
        ((data && data.Items) || []).forEach(function (item) {
          var type = String(item.Type || '').toLowerCase();
          if (type === 'movie' && !libraryCategoryEnabled('movies')) return;
          if (type === 'series' && !libraryCategoryEnabled('tvshows')) return;
          var tmdb = tmdbFromItem(item);
          if (!tmdb) return;
          var key = tmdb.method + '/' + tmdb.id;
          byTmdb[key] = mergeTmdbRows(byTmdb[key], mapRow(item));
        });
        libraryIndex.byTmdb = byTmdb;
        libraryIndex.loadedAt = Date.now();
        return byTmdb;
      })
      .catch(function () {
        return libraryIndex.byTmdb;
      })
      .finally(function () {
        libraryIndexInflight = null;
      });

    return libraryIndexInflight;
  }

  function findLibraryRow(method, id) {
    var key = String(method || '') + '/' + String(id || '');
    return libraryIndex.byTmdb[key] || null;
  }

  function enabledControllerName(fallback) {
    fallback = fallback || 'content';
    try {
      var cur = Lampa.Controller.enabled();
      return (cur && cur.name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function deferControllerToggle(name) {
    restoreController(name);
  }

  function restoreControllerNow(name) {
    try {
      if (name) Lampa.Controller.toggle(name);
    } catch (e) { }
  }

  function restoreController(name) {
    setTimeout(function () {
      restoreControllerNow(name);
    }, 10);
  }

  function readLocalProgressMap() {
    if (localProgressCache !== null) return localProgressCache;
    localProgressCache = {};
    try {
      var raw = Lampa.Storage.get(LOCAL_PROGRESS_KEY, '');
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') localProgressCache = parsed;
    } catch (e) { }
    return localProgressCache;
  }

  function saveLocalProgressMap() {
    try {
      Lampa.Storage.set(LOCAL_PROGRESS_KEY, JSON.stringify(localProgressCache));
    } catch (e) { }
  }

  function readLocalProgress(itemId) {
    var map = readLocalProgressMap();
    var p = map[String(itemId)];
    if (!p || !p.updatedAt) return null;
    if (Date.now() - p.updatedAt > LOCAL_PROGRESS_TTL_MS) {
      delete map[String(itemId)];
      saveLocalProgressMap();
      return null;
    }
    return p;
  }

  function writeLocalProgress(itemId, pct, timeSec, played) {
    var map = readLocalProgressMap();
    map[String(itemId)] = {
      pct: Math.min(100, Math.max(0, Math.round(pct || 0))),
      time: Math.max(0, timeSec || 0),
      played: !!played,
      updatedAt: Date.now(),
    };
    saveLocalProgressMap();
  }

  function clearLocalProgress(itemId) {
    var map = readLocalProgressMap();
    var key = String(itemId);
    if (map[key]) {
      delete map[key];
      saveLocalProgressMap();
    }
  }

  function syncExternalTimeline(row, resumeSec, durationSec) {
    try {
      if (!Lampa.Timeline || typeof Lampa.Timeline.update !== 'function') return;
      if (!row || !row.raw || !row.raw.Id) return;
      var hash = timelineHashFor(row);
      if (!hash) return;
      var dur = Math.max(0, Number(durationSec) || 0);
      var t = Math.max(0, Number(resumeSec) || 0);
      var pct = dur > 0 && t > 0 ? Math.min(100, Math.round((t / dur) * 100)) : 0;
      syncingTimelineHash = hash;
      Lampa.Timeline.update({
        hash: hash,
        percent: pct,
        time: t,
        duration: dur
      });
      syncingTimelineHash = '';
    } catch (e) {
      syncingTimelineHash = '';
    }
  }

  function launchPlayerFromSelect(ctl, launch) {
    restoreControllerNow(ctl);
    launch();
  }

  function pushCard(tmdb) {
    rememberCardReturn(String(tmdb.id));
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'card', tmdb.method, tmdb.id]),
      component: 'full',
      id: tmdb.id,
      method: tmdb.method,
      source: 'tmdb',
      card: { id: String(tmdb.id), source: 'tmdb' },
    });
  }

  function compactActivity(act) {
    if (!act || typeof act !== 'object') return null;
    var keep = [
      'url', 'title', 'component', 'category', 'libraryId', 'library',
      'homeMedia', 'musicMedia', 'page', 'path', 'parentId',
    ];
    var out = {};
    for (var i = 0; i < keep.length; i++) {
      var key = keep[i];
      if (act[key] !== undefined && act[key] !== null) out[key] = act[key];
    }
    return out.component ? out : null;
  }

  function rememberCardReturn(cardId) {
    if (!cardId) return;
    var act = Lampa.Activity.active && Lampa.Activity.active();
    if (!act) return;
    var comp = String(act.component || '');
    if (comp !== HUB_COMPONENT && comp !== PANEL_COMPONENT) return;
    var target = compactActivity(act);
    if (!target) return;
    Lampa.Storage.set(RETURN_TARGET_KEY, {
      forId: String(cardId),
      at: Date.now(),
      target: target,
    });
  }

  function readReturnRecord() {
    var rec = null;
    try {
      rec = Lampa.Storage.get(RETURN_TARGET_KEY);
    } catch (e) {
      return null;
    }
    if (!rec || !rec.target || !rec.target.component || !rec.forId) return null;
    if (Date.now() - rec.at > RETURN_TARGET_TTL_MS) {
      try {
        Lampa.Storage.remove(RETURN_TARGET_KEY);
      } catch (e) {}
      return null;
    }
    return rec;
  }

  function isJellyfinActivity(act) {
    if (!act || typeof act !== 'object' || !act.component) return false;
    var comp = String(act.component);
    if (
      comp === HUB_COMPONENT ||
      comp === PANEL_COMPONENT ||
      comp === EPISODES_COMPONENT ||
      comp === AUDIO_PLAYER_COMPONENT
    ) {
      return true;
    }
    if (comp === 'full') {
      return (
        act.source === 'jellyfin' ||
        (act.card && act.card.source === 'jellyfin') ||
        !!act.jellyfinRow
      );
    }
    return false;
  }

  function getOriginalNavUrl() {
    try {
      if (window.performance && window.performance.getEntriesByType) {
        var entries = window.performance.getEntriesByType('navigation');
        if (entries && entries[0] && entries[0].url) return String(entries[0].url);
      }
    } catch (e) {}
    return jellyfinLoadUrl || String(window.location.href || '');
  }

  function urlIsJellyfin(u) {
    var s = String(u || '');
    if (!s) return false;
    if (s.indexOf('url=jellyfin%2F') !== -1) return true;
    if (s.indexOf('url=jellyfin/') !== -1) return true;
    if (s.indexOf('source=jellyfin') !== -1) return true;
    if (s.indexOf('card=') !== -1 && s.indexOf('jellyfin') !== -1) return true;
    return false;
  }

  function isPageReload() {
    try {
      var nav = window.performance && window.performance.navigation;
      if (nav && typeof nav.type === 'number') return nav.type === 1;
      var entries =
        window.performance &&
        window.performance.getEntriesByType &&
        window.performance.getEntriesByType('navigation');
      if (entries && entries[0] && entries[0].type) return entries[0].type === 'reload';
    } catch (e) {}
    return false;
  }

  var jellyfinResumeKeys = [
    'url', 'title', 'component', 'category', 'libraryId', 'library',
    'homeMedia', 'musicMedia', 'page', 'path', 'parentId',
    'seriesId', 'seriesTitle', 'id', 'method', 'source', 'card',
  ];

  function buildResumeObject(stored) {
    if (!stored || typeof stored !== 'object' || !isJellyfinActivity(stored)) return null;
    if (String(stored.component) === AUDIO_PLAYER_COMPONENT) {
      var cache = readAudioCache();
      if (!cache || !cache.tracks || !cache.tracks.length) return null;
      return {
        url: jellyfinNavUrl(['jellyfin', 'audio']),
        title:
          (cache.tracks[cache.index] && cache.tracks[cache.index].title) ||
          (cache.tracks[0] && cache.tracks[0].title) ||
          '',
        component: AUDIO_PLAYER_COMPONENT,
        tracks: cache.tracks,
        index: cache.index,
      };
    }
    var object = {};
    for (var i = 0; i < jellyfinResumeKeys.length; i++) {
      var k = jellyfinResumeKeys[i];
      if (stored[k] !== undefined && stored[k] !== null) object[k] = stored[k];
    }
    return object.component ? object : null;
  }

  function jellyfinResumeCardObject(object) {
    if (
      !object ||
      String(object.component) !== 'full' ||
      String(object.source) !== 'jellyfin'
    ) {
      return Promise.resolve(object);
    }
    var itemId = String(object.id || (object.card && object.card.id) || '');
    if (!itemId) return Promise.resolve(object);
    return resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Users/' +
          encodeURIComponent(userId) +
          '/Items/' +
          encodeURIComponent(itemId) +
          '?Fields=ProviderIds'
        );
      })
      .then(function (item) {
        var tmdb = tmdbFromItem(item);
        if (!tmdb) return object;
        var method = tmdb.method || object.method || 'movie';
        return {
          url: jellyfinNavUrl(['jellyfin', 'card', method, tmdb.id]),
          title: object.title || (item && item.Name) || '',
          component: 'full',
          id: tmdb.id,
          method: method,
          source: 'tmdb',
          card: { id: String(tmdb.id), source: 'tmdb' },
        };
      })
      .catch(function () {
        return object;
      });
  }

  function readWatchTarget() {
    try {
      var rec = Lampa.Storage.get(WATCH_TARGET_KEY);
      if (!rec || !rec.id || !rec.type) return null;
      if (Date.now() - rec.at > WATCH_TARGET_TTL_MS) {
        try {
          Lampa.Storage.remove(WATCH_TARGET_KEY);
        } catch (e) {}
        return null;
      }
      return rec;
    } catch (e) {
      return null;
    }
  }

  function saveWatchTarget(row) {
    try {
      if (!row) return;
      var type = String(row.type || (row.raw && row.raw.Type) || 'Movie');
      if (type !== 'Movie' && type !== 'Series' && type !== 'Episode') return;
      var id = String(row.id || (row.raw && row.raw.Id) || '');
      var title = row.title || (row.raw && row.raw.Name) || '';
      if (type === 'Episode' && row.raw && row.raw.SeriesId) {
        id = String(row.raw.SeriesId);
        type = 'Series';
        title = row.raw.SeriesName || title;
      }
      if (!id) return;
      Lampa.Storage.set(WATCH_TARGET_KEY, {
        id: id,
        type: type,
        title: title,
        at: Date.now(),
      });
    } catch (e) {}
  }

  function clearWatchTarget() {
    try {
      Lampa.Storage.remove(WATCH_TARGET_KEY);
    } catch (e) {}
  }

  function saveViewerResumeTarget(target) {
    try {
      if (!target || !target.component) return;
      Lampa.Storage.set(VIEWER_RESUME_KEY, {
        target: target,
        at: Date.now(),
      });
    } catch (e) {}
  }

  function readViewerResumeTarget() {
    try {
      var rec = Lampa.Storage.get(VIEWER_RESUME_KEY);
      if (!rec || !rec.target || !rec.target.component) return null;
      if (Date.now() - rec.at > VIEWER_RESUME_TTL_MS) {
        try {
          Lampa.Storage.remove(VIEWER_RESUME_KEY);
        } catch (e) {}
        return null;
      }
      return rec.target;
    } catch (e) {
      return null;
    }
  }

  function clearViewerResumeTarget() {
    try {
      Lampa.Storage.remove(VIEWER_RESUME_KEY);
    } catch (e) {}
  }

  function photoFolderActivityFromRow(row) {
    if (!row || !row.id) return null;
    var raw = row.raw || {};
    var isAlbum = row.type === 'PhotoAlbum';
    var isFolder = isFolderRowType(row.type);
    if (!isAlbum && !isFolder) return null;
    return {
      url: jellyfinNavUrl(['jellyfin', 'folder', row.id]),
      title: row.title || (raw.Name || ''),
      component: PANEL_COMPONENT,
      category: 'Library',
      parentId: row.id,
      path: row.displayPath || row.title || '',
      homeMedia: true,
      musicMedia: true,
      page: 1,
    };
  }

  function savePhotoViewerResumeTarget(row) {
    if (!row) return;
    var act = null;
    try {
      act = Lampa.Activity.active && Lampa.Activity.active();
    } catch (e) {}
    var target = photoFolderActivityFromRow(row);
    if (!target) target = compactActivity(act);
    saveViewerResumeTarget(target);
  }

  function saveJellyfinActivity(act) {
    try {
      if (!act || typeof act !== 'object' || !isJellyfinActivity(act)) return;
      var out = {};
      for (var i = 0; i < jellyfinResumeKeys.length; i++) {
        var k = jellyfinResumeKeys[i];
        if (act[k] !== undefined && act[k] !== null) out[k] = act[k];
      }
      if (!out.component) return;
      Lampa.Storage.set(JELLYFIN_ACTIVITY_KEY, out);
    } catch (e) {}
  }

  function resumeViewerIfNeeded(navUrl) {
    var s = String(navUrl || '');
    var isPhoto = s.indexOf('jellyfin%2Fphoto') !== -1 || s.indexOf('jellyfin/photo') !== -1;
    var isAudio = s.indexOf('jellyfin%2Faudio') !== -1 || s.indexOf('jellyfin/audio') !== -1;
    if (!isPhoto && !isAudio) return null;
    return readViewerResumeTarget();
  }

  function savedTopMatches(active) {
    if (!active) return false;
    try {
      var saved = loadRouteCache();
      if (!saved || !saved.length) return false;
      var top = saved[saved.length - 1];
      return !!top && routeSig(top) === routeSig(active);
    } catch (e) {
      return false;
    }
  }

  function markRouteRestoreDone() {
    setTimeout(function () {
      routeRestorePending = false;
    }, 0);
  }

  function restoreRouteAfterRefresh(active) {
    try {
      var saved = loadRouteCache();
      if (!saved || !saved.length) return false;

      var stack = cleanRouteStack(saved);
      while (
        stack.length &&
        String(stack[stack.length - 1].component) === EPISODES_COMPONENT
      ) {
        stack.pop();
      }
      if (!stack.length) return false;
      var top = stack[stack.length - 1];
      if (!top || !top.component) return false;

      if (jellyfinResumeHandled) return true;
      jellyfinResumeHandled = true;
      routeRestorePending = true;

      cancelRoutePending();
      if (stack.length > RESTORE_MAX_DEPTH) {
        stack = stack.slice(stack.length - RESTORE_MAX_DEPTH);
      }
      routeStack = stack;
      routeRestored = true;
      persistRoute();

      restoreRouteStack(stack);
      return true;
    } catch (e) {
      return false;
    }
  }

  function restoreRouteStack(stack) {
    var i = 0;
    function next() {
      if (routeRebuilding) {
        setTimeout(next, RESTORE_STEP_DELAY);
        return;
      }
      if (i >= stack.length) {
        markRouteRestoreDone();
        return;
      }
      var entry = stack[i];
      var isFirst = i === 0;
      i++;
      if (String(entry.component) === 'full') {
        jellyfinResumeCardObject(entry).then(function (object) {
          openRestoredPage(object || entry, isFirst);
          setTimeout(next, RESTORE_STEP_DELAY);
        });
      } else {
        openRestoredPage(entry, isFirst);
        setTimeout(next, RESTORE_STEP_DELAY);
      }
    }
    next();
  }

  function openRestoredPage(object, isFirst) {
    try {
      if (!object || !object.component) return;
      if (isFirst) {
        Lampa.Activity.replace(object, true);
      } else {
        Lampa.Activity.push(object);
      }
    } catch (e) {}
  }

  function resumeJellyfinActivity() {
    try {
      var active = Lampa.Activity.active && Lampa.Activity.active();
      if (!active) {
        var schedule = function () {
          if (jellyfinResumeHandled) return;
          if (!(Lampa.Activity.active && Lampa.Activity.active())) return;
          resumeJellyfinActivity();
        };
        try {
          Lampa.Listener.follow('activity', function (e) {
            if (e && (e.type === 'start' || e.type === 'create' || e.type === 'init')) {
              schedule();
            }
          });
        } catch (err) {}
        return;
      }

      var navUrl = getOriginalNavUrl();
      var sNav = String(navUrl || '');
      var isPhotoNav = sNav.indexOf('jellyfin%2Fphoto') !== -1 || sNav.indexOf('jellyfin/photo') !== -1;
      var isAudioNav = sNav.indexOf('jellyfin%2Faudio') !== -1 || sNav.indexOf('jellyfin/audio') !== -1;

      var viewerTarget = resumeViewerIfNeeded(navUrl);
      if (viewerTarget) {
        finishJellyfinResume(viewerTarget);
        return;
      }

      if (!isPhotoNav && !isAudioNav) {
        if (isPageReload() || urlIsJellyfin(navUrl) || savedTopMatches(active)) {
          if (restoreRouteAfterRefresh(active)) return;
        }
      }

      if (!urlIsJellyfin(navUrl)) {
        jellyfinResumeHandled = true;
        return;
      }

      var stored = null;
      try {
        stored = Lampa.Storage.get(JELLYFIN_ACTIVITY_KEY, false);
        if (!stored || !isJellyfinActivity(stored)) {
          stored = Lampa.Storage.get('activity', false);
        }
      } catch (e) {
        jellyfinResumeHandled = true;
        return;
      }
      var object = buildResumeObject(stored);
      if (!object) {
        jellyfinResumeHandled = true;
        return;
      }

      if (String(object.component) === AUDIO_PLAYER_COMPONENT) {
        finishJellyfinResume(object);
        return;
      }

      var target = null;
      if (
        String(object.component) === 'full' &&
        (object.source === 'jellyfin' || (object.card && object.card.source === 'jellyfin'))
      ) {
        target = object;
      } else if (String(object.component) === EPISODES_COMPONENT && object.seriesId) {
        target = {
          url: jellyfinNavUrl(['jellyfin', 'card', 'tv', object.seriesId]),
          title: object.seriesTitle || object.title || '',
          component: 'full',
          id: object.seriesId,
          method: 'tv',
          source: 'jellyfin',
          card: { id: String(object.seriesId), source: 'jellyfin' },
        };
      }

      if (!target) {
        jellyfinResumeHandled = true;
        return;
      }

      jellyfinResumeCardObject(target).then(function (resumeObject) {
        finishJellyfinResume(resumeObject);
      });
    } catch (e) {}
  }

  function finishJellyfinResume(resumeObject) {
    setTimeout(function () {
      try {
        if (jellyfinResumeHandled) return;
        jellyfinResumeHandled = true;
        Lampa.Activity.replace(resumeObject, true);
      } catch (e) {}
    }, 0);
  }

  function setupBackAfterRefresh() {
    var activity = Lampa.Activity;
    if (!activity || !activity.listener || typeof activity.listener.follow !== 'function') return;
    activity.listener.follow('backward', function (e) {
      if (!e) return;
      if (e.count !== 1) {
        try {
          Lampa.Storage.remove(RETURN_TARGET_KEY);
        } catch (err) {}
        return;
      }
      var active = activity.active && activity.active();
      if (!active) return;
      if (
        routeRestored &&
        routeStack.length &&
        routeSig(active) === routeSig(routeStack[routeStack.length - 1])
      ) {
        return;
      }
      var rec = readReturnRecord();
      if (!rec || String(active.id || '') !== String(rec.forId || '')) return;
      try {
        Lampa.Storage.remove(RETURN_TARGET_KEY);
      } catch (err) {}
      setTimeout(function () {
        Lampa.Activity.replace(rec.target, true);
      }, 0);
    });
  }

  function routeCacheName() {
    if (!routeCacheStoreKey) routeCacheStoreKey = ROUTE_CACHE_KEY + '_' + getDeviceId();
    return routeCacheStoreKey;
  }

  function isTransientViewer(act) {
    var comp = String((act && act.component) || '');
    return comp === AUDIO_PLAYER_COMPONENT || comp === PHOTO_VIEWER_COMPONENT;
  }

  function isRouteActivity(act) {
    if (!act || typeof act !== 'object' || !act.component) return false;
    var comp = String(act.component);
    if (comp === HUB_COMPONENT || comp === PANEL_COMPONENT || comp === EPISODES_COMPONENT) {
      return true;
    }
    if (comp === 'full') {
      if (
        act.source === 'jellyfin' ||
        (act.card && act.card.source === 'jellyfin') ||
        act.jellyfinRow
      ) {
        return true;
      }
      if (act.url && String(act.url).indexOf('jellyfin/') === 0) return true;
      return false;
    }
    return false;
  }

  function routeSig(act) {
    var a = act || {};
    var comp = String(a.component || '');
    if (comp === 'full') {
      var method = String(a.method || (a.card && a.card.method) || '');
      var id = String(a.id || (a.card && a.card.id) || '');
      if (method || id) return 'full:' + method + ':' + id;
    }
    return String(a.url || comp || '');
  }

  function routeCompact(act) {
    if (!isRouteActivity(act)) return null;
    var out = {};
    for (var i = 0; i < jellyfinResumeKeys.length; i++) {
      var k = jellyfinResumeKeys[i];
      if (act[k] !== undefined && act[k] !== null) out[k] = act[k];
    }
    return out.component ? out : null;
  }

  function normalizeRouteEntry(entry) {
    if (!entry || typeof entry !== 'object' || !entry.component) return null;
    var out = {};
    for (var i = 0; i < jellyfinResumeKeys.length; i++) {
      var k = jellyfinResumeKeys[i];
      if (entry[k] !== undefined && entry[k] !== null) out[k] = entry[k];
    }
    if (!out.component) return null;
    return isRouteActivity(out) ? out : null;
  }

  function cleanRouteStack(stack) {
    var out = [];
    (stack || []).forEach(function (entry) {
      var c = normalizeRouteEntry(entry);
      if (!c) return;
      if (out.length && routeSig(out[out.length - 1]) === routeSig(c)) return;
      out.push(c);
    });
    if (out.length > ROUTE_MAX_DEPTH) out = out.slice(out.length - ROUTE_MAX_DEPTH);
    return out;
  }

  function persistRoute() {
    try {
      if (!routeStack.length) {
        Lampa.Storage.remove(routeCacheName());
        return;
      }
      Lampa.Storage.set(routeCacheName(), {
        stack: routeStack.slice(),
        savedAt: Date.now(),
      });
    } catch (e) {}
  }

  function loadRouteCache() {
    try {
      var rec = Lampa.Storage.get(routeCacheName());
      if (!rec || !rec.stack || !rec.stack.length) return null;
      if (Date.now() - Number(rec.savedAt || 0) > ROUTE_CACHE_TTL_MS) {
        Lampa.Storage.remove(routeCacheName());
        return null;
      }
      return cleanRouteStack(rec.stack);
    } catch (e) {
      return null;
    }
  }

  function clearRouteCache() {
    routeStack = [];
    routeRestored = false;
    cancelRoutePending();
    try {
      Lampa.Storage.remove(routeCacheName());
    } catch (e) {}
  }

  function cancelRoutePending() {
    routePending = false;
    if (routePendingTimer) {
      clearTimeout(routePendingTimer);
      routePendingTimer = null;
    }
  }

  function scheduleRoutePending(saved) {
    cancelRoutePending();
    if (!saved || !saved.length) return;
    routeAdoptTopSig = routeSig(saved[saved.length - 1]);
    var navUrl = getOriginalNavUrl();
    if (urlIsJellyfin(navUrl)) {
      routeAdoptStrong = true;
    } else if (!isPageReload()) {
      cancelRoutePending();
      return;
    } else {
      routeAdoptStrong = false;
    }
    routePending = true;
    routePendingTimer = setTimeout(function () {
      routePendingTimer = null;
      if (routePending && !routeRestored) {
        cancelRoutePending();
        clearRouteCache();
      }
    }, 10000);
  }

  function mainActivityObject() {
    try {
      var source = Lampa.Storage.field('source');
      return {
        url: '',
        title:
          (Lampa.Lang.translate('title_main') || 'Main') +
          ' - ' +
          String(source || '').toUpperCase(),
        component: 'main',
        source: source,
        page: 1,
      };
    } catch (e) {
      return { url: '', title: 'Main', component: 'main', source: '', page: 1 };
    }
  }

  function routeTopMatches(a, b) {
    if (!a || !b) return false;
    if (String(a.component) === 'full' && String(b.component) === 'full') return true;
    return routeSig(a) === routeSig(b);
  }

  function adoptSavedRoute(current) {
    cancelRoutePending();
    routeRestored = true;
    var c = routeCompact(current);
    var stack = [];
    if (c) {
      var saved = loadRouteCache();
      if (saved && saved.length) {
        var idx = -1;
        for (var i = saved.length - 1; i >= 0; i--) {
          if (routeTopMatches(saved[i], c)) {
            idx = i;
            break;
          }
        }
        if (idx >= 0) {
          stack = saved.slice(0, idx + 1);
          stack[idx] = c;
        } else {
          stack = [c];
        }
      } else {
        stack = [c];
      }
    } else {
      stack = loadRouteCache() || [];
    }
    routeStack = cleanRouteStack(stack);
    persistRoute();
  }

  function trackRouteActivity(act) {
    if (routeRebuilding) return;
    if (routeRestorePending) return;
    if (!act || typeof act !== 'object') return;

    if (isRouteActivity(act)) {
      var c = routeCompact(act);
      if (!c) return;
      if (routePending) {
        if (routeAdoptStrong || routeSig(c) === routeAdoptTopSig) {
          adoptSavedRoute(act);
        } else {
          cancelRoutePending();
          clearRouteCache();
          routeStack = [c];
          persistRoute();
        }
        return;
      }
      if (routeStack.length && routeSig(routeStack[routeStack.length - 1]) === routeSig(c)) {
        routeStack[routeStack.length - 1] = c;
      } else {
        var backIndex = -1;
        for (var i = routeStack.length - 1; i >= 0; i--) {
          if (routeSig(routeStack[i]) === routeSig(c)) {
            backIndex = i;
            break;
          }
        }
        if (backIndex >= 0) {
          routeStack = routeStack.slice(0, backIndex + 1);
          routeStack[backIndex] = c;
        } else {
          routeStack.push(c);
          if (routeStack.length > ROUTE_MAX_DEPTH) {
            routeStack = routeStack.slice(routeStack.length - ROUTE_MAX_DEPTH);
          }
        }
      }
      persistRoute();
      return;
    }

    if (isTransientViewer(act)) return;
    if (routePending) return;
    if (routeRestorePending) return;
    clearRouteCache();
  }

  function routeBack() {
    try {
      if (!routeRestored) return;
      var active = Lampa.Activity.active && Lampa.Activity.active();
      if (!active) return;
      if (routeStack.length < 2) {
        if (routeStack.length === 1 && routeSig(routeStack[0]) === routeSig(active)) {
          clearRouteCache();
          routeRebuilding = true;
          try {
            Lampa.Activity.replace(mainActivityObject(), true);
          } finally {
            routeRebuilding = false;
          }
        } else {
          clearRouteCache();
        }
        return;
      }
      if (routeSig(routeStack[routeStack.length - 1]) !== routeSig(active)) return;
      var prev = routeStack[routeStack.length - 2];
      routeStack.pop();
      persistRoute();
      routeRebuilding = true;
      try {
        Lampa.Activity.replace(prev, true);
      } finally {
        routeRebuilding = false;
      }
    } catch (e) {}
  }

  function setupRouteRestore() {
    var saved = loadRouteCache();
    if (saved && saved.length) scheduleRoutePending(saved);

    try {
      var activity = Lampa.Activity;
      if (activity && activity.listener && typeof activity.listener.follow === 'function') {
        activity.listener.follow('backward', function (e) {
          if (!e || routeRebuilding) return;
          if (e.count > 1) {
            if (routeStack.length > 1) {
              var active = activity.active && activity.active();
              if (active && routeSig(routeStack[routeStack.length - 1]) === routeSig(active)) {
                routeStack.pop();
                persistRoute();
              }
            }
            return;
          }
          if (routeRestored && routeStack.length === 1) {
            var active = activity.active && activity.active();
            if (active && routeSig(routeStack[0]) === routeSig(active)) {
              clearRouteCache();
              routeRebuilding = true;
              try {
                Lampa.Activity.replace(mainActivityObject(), true);
              } finally {
                routeRebuilding = false;
              }
            }
          }
        });
      }
    } catch (err) {}
  }

  function patchActivityPushState() {
    try {
      var win = window;
      if (!win.history || typeof win.history.pushState !== 'function') return;
      if (win.history.pushState.__jfUrlPatched) return;
      var origPush = win.history.pushState.bind(win.history);
      var origReplace = win.history.replaceState.bind(win.history);

      function cleanJellyfinUrl(url) {
        try {
          if (typeof url !== 'string' || url.indexOf('?') < 0) return url;
          var qi = url.indexOf('?');
          var params = url.slice(qi + 1);
          if (
            !params ||
            (params.indexOf('url=jellyfin%2F') < 0 && params.indexOf('url=jellyfin/') < 0)
          ) {
            return url;
          }
          var keep = [];
          var parts = params.split('&');
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p.indexOf('url=') === 0 || p.indexOf('r=') === 0) keep.push(p);
          }
          var base = url.slice(0, qi);
          return keep.length ? base + '?' + keep.join('&') : base;
        } catch (e) {
          return url;
        }
      }

      win.history.pushState = function (state, title, url) {
        return origPush(state, title, cleanJellyfinUrl(url));
      };
      win.history.replaceState = function (state, title, url) {
        return origReplace(state, title, cleanJellyfinUrl(url));
      };
      win.history.pushState.__jfUrlPatched = true;
    } catch (e) {}
  }

  function clearPlayerPlaylist() {
    try {
      if (Lampa.PlayerPlaylist && typeof Lampa.PlayerPlaylist.set === 'function') {
        Lampa.PlayerPlaylist.set([]);
      }
      if (Lampa.PlayerPanel && typeof Lampa.PlayerPanel.showNextEpisodeName === 'function') {
        Lampa.PlayerPanel.showNextEpisodeName({ playlist: [], position: 0 });
      }
      setPlayerEpisodeButtonsDisabled(false, false);
    } catch (e) { }
  }

  var episodePrevButtonDisabled = false;
  var episodeNextButtonDisabled = false;

  function setPlayerEpisodeButtonsDisabled(prevDisabled, nextDisabled) {
    try {
      episodePrevButtonDisabled = !!prevDisabled;
      episodeNextButtonDisabled = !!nextDisabled;
      $('body').toggleClass('jellyfin-episode-prev-disabled', episodePrevButtonDisabled);
      $('body').toggleClass('jellyfin-episode-next-disabled', episodeNextButtonDisabled);
    } catch (e) { }
  }

  function currentEpisodePosition(playlist) {
    try {
      var work =
        Lampa.Player && typeof Lampa.Player.playdata === 'function'
          ? Lampa.Player.playdata()
          : null;
      var id = work && String(work.jellyfinId || '');
      if (!id) return null;
      for (var i = 0; i < playlist.length; i++) {
        if (playlist[i] && String(playlist[i].jellyfinId || '') === id) return i;
      }
    } catch (err) { }
    return null;
  }

  function updatePlayerEpisodeButtons(e) {
    try {
      var playlist = (e && e.playlist) || [];
      var index = (e && e.index) != null ? Number(e.index) : -1;
      if (playlist[index] && playlist[index].jellyfinId) {
        currentPlayItemId = playlist[index].jellyfinId;
      }
      var position = currentEpisodePosition(playlist);
      if (position === null || position === undefined) {
        position = Number((e && e.position) != null ? e.position : 0);
      }
      setPlayerEpisodeButtonsDisabled(
        !!playlist.length && position <= 0,
        !!playlist.length && position >= playlist.length - 1
      );
    } catch (err) { }
  }

  function prepareEpisodeSwitch(item) {
    if (!item || !item.timeline) return;
    item.timeline.time = 0;
    item.timeline.percent = 0;
    item.timeline.duration = 0;
    var id = item.jellyfinId || (item.item && item.item.jellyfinId) || '';
    if (!id) return;
    var row = findPlaybackRow(id);
    if (row) {
      currentPlayRow = row;
      currentTimelineHash = timelineHashFor(row) || '';
      saveWatchTarget(row);
    }
    if (!row || !row.raw) return;
    fetchFreshResume(row)
      .then(function (resumeSec) {
        if (!item || !item.timeline) return;
        var sec = Number(resumeSec) || 0;
        if (!(sec > 0)) return;
        var dur = Math.round((Number(row.raw.RunTimeTicks) || 0) / 10000000) || 0;
        item.timeline.time = sec;
        item.timeline.duration = dur;
        item.timeline.percent = dur > 0 ? Math.min(100, Math.round((sec / dur) * 100)) : 0;
      })
      .catch(function () { });
  }

  function playRow(row, allRows, opts) {
    opts = opts || {};
    var streamOpts = {
      singleStream: !!opts.singleStream || !usesLampaNativePlayer(),
      qualityTarget: opts.qualityTarget || '',
    };
    if (opts.forceTranscode) streamOpts.forceTranscode = true;
    if (opts.qualityPreset) streamOpts.qualityPreset = opts.qualityPreset;
    var readyPromise = (
      row && row.variantsResolved ? Promise.resolve(row) : ensurePlaybackVariants(row)
    ).then(function (r) {
      if (!r || !r.raw || !r.raw.Id) return r;
      return fetchFreshResume(r).then(function (resumeSec) {
        r.resumeSec = resumeSec;
        return r;
      });
    });
    var rowsPromise;
    if (allRows && allRows.length) {
      rowsPromise = Promise.resolve(allRows);
    } else if (row && row.type === 'Episode') {
      var seriesId = row.raw && (row.raw.SeriesId || row.raw.ParentId);
      rowsPromise = seriesId
        ? fetchEpisodes(seriesId).then(function (eps) {
            if (eps && eps.length) {
              var found = false;
              for (var i = 0; i < eps.length; i++) {
                if (String(eps[i].id) === String(row.id)) {
                  found = true;
                  break;
                }
              }
              return found ? eps : [row].concat(eps);
            }
            return [row];
          })
        : Promise.resolve([row]);
    } else {
      rowsPromise = Promise.resolve([row]);
    }

    Promise.all([readyPromise, rowsPromise])
      .then(function (parts) {
        var ready = parts[0];
        var rows = parts[1];
        return resolveUserId().then(function (userId) {
          var playItem = playItemFromRow(ready, userId, true, streamOpts);
          if (ready && ready.type === 'Movie') {
            try {
              document.body.classList.add('jellyfin-movie-playing');
            } catch (e) { }
            playlistBuild = null;
            playlistItems = [];
            clearPlayerPlaylist();
          } else if (ready) {
            if (usesLampaNativePlayer()) {
              var playlist = playlistFromRows(rows, userId, streamOpts);
              if (playlist.length && playItem && playItem.url) {
                var readyId = String((ready && ready.id) || '');
                for (var pi = 0; pi < playlist.length; pi++) {
                  if (playlist[pi] && String(playlist[pi].jellyfinId || '') === readyId) {
                    playlist[pi].url = playItem.url;
                    break;
                  }
                }
              }
              playItem.playlist = playlist;
              playlistBuild = { rows: rows, userId: userId, opts: streamOpts };
              playlistItems = playlist.slice();
            } else {
              playlistBuild = null;
              playlistItems = [];
              clearPlayerPlaylist();
            }
          }
          currentPlayRow = ready || null;
          if (ready) saveWatchTarget(ready);
          if (ready && ready.raw && ready.raw.Id) {
            if (!ready.resumeSec) clearLocalProgress(ready.raw.Id);
            if (playItem && playItem.timeline) playItem.timeline.time = ready.resumeSec || 0;
          }
          currentTimelineHash =
            (playItem && playItem.timeline && playItem.timeline.hash) || '';
          if (ready && ready.raw && ready.raw.Id && !usesLampaNativePlayer()) {
            externalPlay = {
              rowId: ready.raw.Id,
              type: String(ready.type || ready.raw.Type || ''),
              startAt: Date.now(),
              resumeSec: Math.max(0, Number(ready.resumeSec) || 0),
              durationSec: Math.round((Number(ready.raw.RunTimeTicks) || 0) / 10000000),
            };
            cachePlaybackState(externalPlay.rowId, externalPlay.type, 0, externalPlay.resumeSec, externalPlay.durationSec);
            startExternalPlaybackTicker();
          } else {
            externalPlay = null;
          }
          if (ready && ready.raw && ready.raw.Id && !usesLampaNativePlayer()) {
            syncExternalTimeline(
              ready,
              ready.resumeSec,
              Math.round((Number(ready.raw.RunTimeTicks) || 0) / 10000000)
            );
          }
          Lampa.Player.play(playItem);
        });
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  function openSeriesEpisodes(row) {
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'series', row && row.id]),
      title: (row && row.title) || '',
      component: EPISODES_COMPONENT,
      seriesId: row && row.id,
      seriesTitle: (row && row.title) || '',
      page: 1,
    });
  }

  function applyLocalPlaybackState(row, played, pct, timeSec) {
    if (!row.raw) row.raw = {};
    if (!row.raw.UserData) row.raw.UserData = {};
    var ud = row.raw.UserData;
    ud.Played = !!played;
    ud.PlayedPercentage = Math.round(pct * 10) / 10;
    ud.PlaybackPositionTicks = Math.round((played ? 0 : timeSec) * 10000000);
    row.watched = !!played;
    row.playedPct = pct;
    row.resumeSec = played ? 0 : timeSec;
    try {
      Lampa.Listener.send('jellyfin:row-updated', { row: row });
    } catch (e) { }
  }

  function reportPlaybackProgress(row, percent, timeSec, durationSec) {
    if (!row || !row.raw || !row.raw.Id) return;
    var type = String(row.type || row.raw.Type || '');
    if (type !== 'Movie' && type !== 'Episode') return;
    if (lastProgressResetRowId && String(row.raw.Id) === String(lastProgressResetRowId)) return;

    var dur = Number(durationSec) || 0;
    var t = Number(timeSec) || 0;
    var pct = Number(percent);
    if (!isFinite(pct) || pct < 0) pct = 0;
    if (!pct && dur > 0 && t > 0) pct = Math.min(100, Math.round((t / dur) * 100));
    if (dur > 0 && t > 0 && t >= dur - 15) pct = 100;
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;
    var played = pct >= 90;
    if (row && row.raw && lastCompletedRowId && String(row.raw.Id) === String(lastCompletedRowId)) {
      pct = 100;
      played = true;
    }
    var ticks = Math.round(t * 10000000);

    writeLocalProgress(row.raw.Id, pct, played ? 0 : t, played);
    applyLocalPlaybackState(row, played, pct, t);

    try {
      var live = playlistLiveRows[row.raw.Id];
      if (live && live.item && live.item._display) {
        var d = live.item._display;
        var need = played !== !!d.watched || Math.round(pct) !== Math.round(Number(d.pct) || 0);
        if (need) {
          d.pct = pct;
          d.watched = played;
          updatePlaylistRowDom(live.$row, live.item);
        }
      }
    } catch (e) { }

    if (pct < 5 && t < 10) return;

    resolveUserId()
      .then(function (userId) {
        var body = {
          Played: played,
          PlayedPercentage: Math.round(pct * 10) / 10,
          PlaybackPositionTicks: played ? 0 : ticks,
          LastPlayedDate: new Date().toISOString(),
        };
        return jfHttp(
          '/Users/' +
          encodeURIComponent(userId) +
          '/Items/' +
          encodeURIComponent(row.raw.Id) +
          '/UserData',
          { method: 'POST', jsonBody: body, dataType: 'json', cache: false }
        );
      })
      .then(function () {
        invalidateUserDataCaches();
      })
      .catch(function () { });
  }

  function readPlaydata() {
    var w = null;
    try {
      if (Lampa.Player && typeof Lampa.Player.playdata === 'function') {
        w = Lampa.Player.playdata();
      }
    } catch (e) { }
    return w;
  }

  function cachePlaybackState(id, type, pct, time, duration) {
    lastPlaybackState = {
      id: id || '',
      type: type || '',
      pct: Number(pct) || 0,
      time: Number(time) || 0,
      duration: Number(duration) || 0,
      at: Date.now(),
    };
  }

  function readPlaybackState(row, rowId) {
    var id = rowId || (row && row.raw && row.raw.Id) || '';
    if (externalPlay && id && String(externalPlay.rowId) === String(id)) {
      var est = externalPlaybackEstimate();
      if (est) return est;
    }
    var w = readPlaydata();
    if (w && w.timeline) {
      var pct = Number(w.timeline.percent) || 0;
      var t = Number(w.timeline.time) || 0;
      var dur = Number(w.timeline.duration) || 0;
      var type = row ? String(row.type || row.raw.Type || '') : '';
      cachePlaybackState(id, type, pct, t, dur);
      return { pct: pct, time: t, duration: dur };
    }
    if (lastPlaybackState) {
      var lId = id;
      if (lastPlaybackState.id && lId && String(lastPlaybackState.id) === String(lId)) {
        return {
          pct: lastPlaybackState.pct,
          time: lastPlaybackState.time,
          duration: lastPlaybackState.duration,
        };
      }
    }
    return null;
  }

  function externalElapsedSeconds() {
    if (!externalPlay) return 0;
    return Math.max(0, Math.floor((Date.now() - externalPlay.startAt) / 1000));
  }

  function externalPlaybackEstimate() {
    if (!externalPlay || !externalPlay.rowId) return null;
    var elapsed = externalElapsedSeconds();
    if (elapsed < 10) return null;
    var t = (externalPlay.resumeSec || 0) + elapsed;
    var dur = externalPlay.durationSec || 0;
    var pct = dur > 0 ? Math.min(100, Math.round((t / dur) * 100)) : 0;
    return { pct: pct, time: t, duration: dur };
  }

  function tickExternalPlaybackProgress() {
    if (!externalPlay || !externalPlay.rowId) return;
    var elapsed = externalElapsedSeconds();
    if (elapsed < 10) return;
    var t = (externalPlay.resumeSec || 0) + elapsed;
    var dur = externalPlay.durationSec || 0;
    var pct = dur > 0 ? Math.min(100, Math.round((t / dur) * 100)) : 0;
    cachePlaybackState(externalPlay.rowId, externalPlay.type, pct, t, dur);
    if (currentPlayRow && String(currentPlayRow.raw.Id) === String(externalPlay.rowId)) {
      reportPlaybackProgress(currentPlayRow, pct, t, dur);
    }
  }

  function startExternalPlaybackTicker() {
    stopExternalPlaybackTicker();
    externalPlayTicker = setInterval(tickExternalPlaybackProgress, 30000);
  }

  function stopExternalPlaybackTicker() {
    if (!externalPlayTicker) return;
    try {
      clearInterval(externalPlayTicker);
    } catch (e) { }
    externalPlayTicker = null;
  }

  function flushPlaybackProgress() {
    var row = currentPlayRow;
    if (!row) return;
    var state = readPlaybackState(row, row && row.raw && row.raw.Id);
    if (!state) state = externalPlaybackEstimate();
    if (!state) return;
    reportPlaybackProgress(row, state.pct, state.time, state.duration);
  }

  function flushPlaylistProgress() {
    try {
      var rows = [];
      var seen = {};
      if (currentPlayRow && currentPlayRow.raw && currentPlayRow.raw.Id) {
        seen[String(currentPlayRow.raw.Id)] = true;
      }
      var pl = (playlistBuild && playlistBuild.rows) || [];
      for (var i = 0; i < pl.length; i++) {
        if (!pl[i] || !pl[i].raw || !pl[i].raw.Id) continue;
        var k = String(pl[i].raw.Id);
        if (seen[k]) continue;
        seen[k] = true;
        rows.push(pl[i]);
      }
      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var type = String(row.type || row.raw.Type || '');
        if (type !== 'Movie' && type !== 'Episode') continue;
        var local = readLocalProgress(row.raw.Id);
        if (!local) continue;
        if (!localProgressIsNewer(local, row.raw.UserData)) continue;
        var pct = local.played ? 100 : Number(local.pct) || 0;
        if (pct <= 0) continue;
        var t = local.played ? 0 : Number(local.time) || 0;
        reportPlaybackProgress(row, pct, t, 0);
      }
    } catch (e) { }
  }

  function syncFlushPlaybackProgress() {
    var row = currentPlayRow || null;
    var rowId = row && row.raw && row.raw.Id;
    var rowType = row ? String(row.type || row.raw.Type || '') : '';
    if (!rowId && lastPlaybackState) {
      rowId = lastPlaybackState.id;
      rowType = lastPlaybackState.type;
    }
    if (!rowId) return;
    if (rowType && rowType !== 'Movie' && rowType !== 'Episode') return;
    var state = readPlaybackState(row, rowId);
    if (!state && externalPlay && String(externalPlay.rowId) === String(rowId)) {
      state = externalPlaybackEstimate();
    }
    if (!state) return;
    var t = state.time;
    var dur = state.duration;
    var pct = state.pct;
    if (!pct && dur > 0 && t > 0) pct = Math.min(100, Math.round((t / dur) * 100));
    if (dur > 0 && t > 0 && t >= dur - 15) pct = 100;
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;
    var played = pct >= 90;
    if (rowId && lastCompletedRowId && String(rowId) === String(lastCompletedRowId)) {
      pct = 100;
      played = true;
    }
    writeLocalProgress(rowId, pct, played ? 0 : t, played);
    if (row) applyLocalPlaybackState(row, played, pct, t);
    var base = apiBase();
    var key = apiKey();
    var userId = String(storedUserId() || cachedUserId || '').trim();
    if (!base || !key || !userId) return;
    var url =
      base +
      '/Users/' +
      encodeURIComponent(userId) +
      '/Items/' +
      encodeURIComponent(rowId) +
      '/UserData?api_key=' +
      encodeURIComponent(key);
    var body = JSON.stringify({
      Played: played,
      PlayedPercentage: Math.round(pct * 10) / 10,
      PlaybackPositionTicks: played ? 0 : Math.round(t * 10000000),
      LastPlayedDate: new Date().toISOString(),
    });
    try {
      if (window.XMLHttpRequest) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body);
        return;
      }
    } catch (e) { }
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      }
    } catch (e) { }
  }

  function handleVideoSeeked(e) {
    if (!currentPlayRow || !currentPlayRow.raw || !currentPlayRow.raw.Id) return;
    if (externalPlay && externalPlay.rowId) return;
    var target = e && e.target;
    if (!target || String(target.tagName || '').toUpperCase() !== 'VIDEO') return;
    var dur = Number(target.duration) || 0;
    var t = Number(target.currentTime) || 0;
    if (!isFinite(dur) || !isFinite(t) || dur <= 0) return;
    var pct = Math.min(100, Math.max(0, Math.round((t / dur) * 100)));
    cachePlaybackState(
      currentPlayRow.raw.Id,
      String(currentPlayRow.type || currentPlayRow.raw.Type || ''),
      pct,
      t,
      dur
    );
    reportPlaybackProgress(currentPlayRow, pct, t, dur);
  }

  function findPlaybackRow(id) {
    if (currentPlayRow && currentPlayRow.raw && String(currentPlayRow.raw.Id) === String(id)) {
      return currentPlayRow;
    }
    var rows = (playlistBuild && playlistBuild.rows) || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && String(rows[i].id) === String(id)) return rows[i];
    }
    return null;
  }

  function handleVideoEnded(e) {
    try {
      if (externalPlay && externalPlay.rowId) return;
      var target = e && e.target;
      if (!target || String(target.tagName || '').toUpperCase() !== 'VIDEO') return;
      var dur = Number(target.duration) || 0;
      var t = Number(target.currentTime) || 0;
      if (!isFinite(dur) || !isFinite(t) || dur <= 0) return;
      var pd = readPlaydata();
      var id = (pd && (pd.jellyfinId || (pd.item && pd.item.jellyfinId))) || '';
      if (!id && currentPlayRow && currentPlayRow.raw) id = currentPlayRow.raw.Id;
      if (!id) return;
      var row = findPlaybackRow(id);
      if (!row || !row.raw) return;
      var type = String(row.type || row.raw.Type || '');
      if (type !== 'Movie' && type !== 'Episode') return;
      lastCompletedRowId = String(id);
      cachePlaybackState(id, type, 100, t, dur);
      reportPlaybackProgress(row, 100, t, dur);
      scheduleHubRefresh();
    } catch (err) { }
  }

  function currentPlaybackRow() {
    var id = currentPlayItemId;
    if (!id && currentPlayRow && currentPlayRow.raw) id = currentPlayRow.raw.Id;
    if (!id) return null;
    return findPlaybackRow(id);
  }

  function markCurrentEpisodeCompleted() {
    var row = currentPlaybackRow();
    if (!row || !row.raw) return;
    var type = String(row.type || row.raw.Type || '');
    if (type !== 'Movie' && type !== 'Episode') return;
    var id = String(row.raw.Id);
    lastCompletedRowId = id;
    cachePlaybackState(id, type, 100, 0, 0);
    reportPlaybackProgress(row, 100, 0, 0);
    scheduleHubRefresh();
  }

  function resetCurrentEpisodeProgress() {
    var row = currentPlaybackRow();
    if (!row || !row.raw) return;
    var type = String(row.type || row.raw.Type || '');
    if (type !== 'Movie' && type !== 'Episode') return;
    var id = String(row.raw.Id);
    if (lastCompletedRowId && String(lastCompletedRowId) === id) lastCompletedRowId = null;
    cachePlaybackState(id, type, 0, 0, 0);
    reportPlaybackProgress(row, 0, 0, 0);
    lastProgressResetRowId = id;
    if (lastProgressResetTimer) clearTimeout(lastProgressResetTimer);
    lastProgressResetTimer = setTimeout(function () {
      if (String(lastProgressResetRowId || '') === String(id)) lastProgressResetRowId = null;
      lastProgressResetTimer = null;
    }, 5000);
    postItemUnplayed(id);
    scheduleHubRefresh();
  }

  function postItemUnplayed(id) {
    resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Users/' +
          encodeURIComponent(userId) +
          '/Items/' +
          encodeURIComponent(id) +
          '/UserData',
          {
            method: 'POST',
            jsonBody: {
              Played: false,
              PlayedPercentage: 0,
              PlaybackPositionTicks: 0,
            },
            dataType: 'json',
            cache: false,
          }
        );
      })
      .then(function () {
        invalidateUserDataCaches();
      })
      .catch(function () { });
  }

  function applyWatchedState(row, watched) {
    row.watched = watched;
    row.playedPct = watched ? 100 : 0;
    row.resumeSec = 0;
    if (!row.raw.UserData) row.raw.UserData = {};
    row.raw.UserData.Played = watched;
    row.raw.UserData.PlayedPercentage = watched ? 100 : 0;
    row.raw.UserData.PlaybackPositionTicks = 0;
    return row;
  }

  function setItemWatched(row, watched) {
    return resolveUserId().then(function (userId) {
      var path =
        '/Users/' +
        encodeURIComponent(userId) +
        '/PlayedItems/' +
        encodeURIComponent(row.id);
      var req = watched
        ? jfHttp(path, { method: 'POST', jsonBody: {} })
        : jfHttp(path, { method: 'DELETE', dataType: 'text' });
      return req.then(function (result) {
        invalidateUserDataCaches();
        return result;
      });
    });
  }

  function notifyRowWatchedChange(row, watched) {
    applyWatchedState(row, watched);
    Lampa.Bell.push({
      text: Lampa.Lang.translate(
        watched ? 'jellyfin_mark_watched_ok' : 'jellyfin_mark_unwatched_ok'
      ),
    });
    try {
      Lampa.Listener.send('jellyfin:row-updated', { row: row });
    } catch (e) { }
  }

  function EpisodesComponent(object) {
    var self = this;
    var seriesId = (object && object.seriesId) || '';
    var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
    var $list = $('<div class="jellyfin-episodes-list"></div>');
    var $rows = $('<div class="jellyfin-episodes-list__rows"></div>');
    var html = $('<div class="jellyfin-module"></div>');
    var $filterWrap = $('<div class="jellyfin-episodes__filter"></div>');
    var allRows = [];
    var seasons = [];
    var currentSeason = 0;
    var rowsById = {};
    var last = null;
    var loading = false;

    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = rowsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      updateRowDom(slot.$row, e.row);
    }

    Lampa.Listener.follow('jellyfin:row-updated', onRowUpdated);

    scroll.append($list);
    $list.append($filterWrap);
    $list.append($rows);
    html.append(scroll.render());

    bindScrollLayerVisible(scroll);

    scroll.onWheel = function (step) {
      if (!Lampa.Controller.own(self)) self.start();
      if (Navigator && Navigator.move) Navigator.move(step > 0 ? 'down' : 'up');
    };

    function currentSeasonLabel() {
      if (currentSeason === 0) return Lampa.Lang.translate('jellyfin_all_seasons');
      return Lampa.Lang.translate('jellyfin_season') + ' ' + currentSeason;
    }

    function updateRowDom($row, updated) {
      updatePlaylistRowDom($row, {
        _display: buildEpisodeDisplay(updated),
        title: updated.title,
      });
    }

    function toggleEpisodeWatched(row, $row) {
      var target = !(row.watched || Number(row.playedPct) >= 100);
      setItemWatched(row, target)
        .then(function () {
          try {
            writeLocalProgress(row.id, target ? 100 : 0, 0, target);
            syncExternalTimeline(row, 0, 0);
          } catch (e) { }
          notifyRowWatchedChange(row, target);
        })
        .catch(function () {
          Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
        });
    }

    function makeEpisodeRowDom(row) {
      var $row = episodeRowDom();
      $row.addClass('selector');
      var item = { _display: buildEpisodeDisplay(row), title: row.title };
      bindPlaylistRingClick($row.find('.jellyfin-episode__state'), item, $row);
      updatePlaylistRowDom($row, item);
      $row.on('hover:focus', function () {
        last = this;
        playlistFocusedRow = $row;
        if (playlistRingFocused) setPlaylistRingFocus($row, true);
        scroll.update($row, false);
        var bg = episodeCoverUrl(row.raw);
        if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
      });
      $row.on('hover:enter', function () {
        if ($row.hasClass('jellyfin-ring-focus')) {
          toggleEpisodeWatched(row, $row);
          return;
        }
        playEpisodeRow(row, allRows);
      });
      $row.on('visible', function () {
        try {
          if (Lampa.Controller.own(self)) Lampa.Controller.collectionAppend($row);
        } catch (e) { }
      });
      return $row;
    }

    function renderEmpty(opts) {
      $rows.empty().addClass('jellyfin-catalog--state');
      playlistFocusedRow = null;
      playlistRingFocused = false;
      opts = opts || {};
      var $box = $('<div class="jellyfin-state"></div>');
      $box.append(
        '<div class="jellyfin-state__title">' +
        $('<div>').text(opts.title || Lampa.Lang.translate('jellyfin_empty')).html() +
        '</div>'
      );
      $box.append(
        '<div class="jellyfin-state__descr">' +
        $('<div>').text(opts.descr || Lampa.Lang.translate('jellyfin_empty_descr')).html() +
        '</div>'
      );
      var $retry = $(
        '<div class="simple-button selector">' + Lampa.Lang.translate('jellyfin_retry') + '</div>'
      );
      $retry.on('hover:enter', load);
      $retry.on('hover:focus', function () {
        last = this;
        scroll.update($retry, true);
      });
      $box.append($retry);
      $rows.append($box);
      last = $retry[0];
      scheduleReflowFocus(scroll, self, last, { animate: true });
    }

    function renderEpisodes() {
      var visible = allRows;
      if (currentSeason > 0) {
        visible = allRows.filter(function (r) {
          return episodeNumbers(r.raw).season === currentSeason;
        });
      }
      $rows.empty().removeClass('jellyfin-catalog--state');
      rowsById = {};
      playlistFocusedRow = null;
      playlistRingFocused = false;
      if (!visible.length) {
        renderEmpty();
        return;
      }
      visible.forEach(function (row) {
        var $row = makeEpisodeRowDom(row);
        rowsById[String(row.id)] = { $row: $row, row: row };
        $rows.append($row);
      });
      last = $rows.children().first()[0];
      scheduleReflowFocus(scroll, self, last, { animate: true });
    }

    function openSeasonSelect() {
      var items = [
        { title: Lampa.Lang.translate('jellyfin_all_seasons'), season: 0 },
      ];
      seasons.forEach(function (s) {
        items.push({
          title: Lampa.Lang.translate('jellyfin_season') + ' ' + s,
          season: s,
        });
      });
      Lampa.Select.show({
        title: Lampa.Lang.translate('jellyfin_episodes'),
        items: items,
        onSelect: function (sel) {
          if (!sel) return;
          currentSeason = typeof sel.season !== 'undefined' ? sel.season : 0;
          buildFilter();
          renderEpisodes();
        },
      });
    }

    function buildFilter() {
      if (!seasons.length) {
        $filterWrap.empty();
        return;
      }
      var $chip = $(
        '<div class="simple-button simple-button--filter selector jellyfin-season-chip">' +
        '<span></span><div></div></div>'
      );
      $chip.find('span').text(Lampa.Lang.translate('jellyfin_episodes'));
      $chip.find('div').text(currentSeasonLabel()).removeClass('hide');
      $chip.on('hover:focus', function () {
        last = this;
        if (playlistRingFocused && playlistFocusedRow && playlistFocusedRow.length) {
          setPlaylistRingFocus(playlistFocusedRow, false);
        }
        playlistFocusedRow = null;
        scroll.update($chip, false);
      });
      $chip.on('hover:enter', openSeasonSelect);
      $filterWrap.empty().append($chip);
    }

    function load() {
      if (loading) return;
      loading = true;
      self.activity.loader(true);
      fetchEpisodes(seriesId)
        .then(function (eps) {
          allRows = sortEpisodeRows(eps);
          seasons = [];
          var seen = {};
          allRows.forEach(function (r) {
            var s = episodeNumbers(r.raw).season;
            if (!seen[s]) {
              seen[s] = true;
              seasons.push(s);
            }
          });
          seasons.sort(function (a, b) {
            return a - b;
          });
          buildFilter();
          renderEpisodes();
        })
        .catch(function () {
          renderEmpty({
            title: Lampa.Lang.translate('jellyfin_error'),
            descr: Lampa.Lang.translate('jellyfin_settings_hint'),
          });
        })
        .then(function () {
          loading = false;
          self.activity.loader(false);
          self.activity.toggle();
        });
    }

    this.create = function () {
      scroll.minus();
      load();
      return html;
    };

    this.start = function () {
      self.background();
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          scroll.restorePosition();
          Lampa.Controller.collectionSet(scroll.render(true));
          Lampa.Controller.collectionFocus(last || false, scroll.render(true));
          if (last) scroll.update($(last), false);
        },
        left: function () {
          if (playlistRingFocused && playlistFocusedRow && playlistFocusedRow.length) {
            setPlaylistRingFocus(playlistFocusedRow, false);
            return;
          }
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (!playlistRingFocused && playlistFocusedRow && playlistFocusedRow.length) {
            setPlaylistRingFocus(playlistFocusedRow, true);
            return;
          }
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (playlistRingFocused && playlistFocusedRow && playlistFocusedRow.length) {
            setPlaylistRingFocus(playlistFocusedRow, false);
          }
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (playlistRingFocused && playlistFocusedRow && playlistFocusedRow.length) {
            setPlaylistRingFocus(playlistFocusedRow, false);
          }
          if (Navigator.canmove('down')) Navigator.move('down');
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      Lampa.Background.immediately('');
    };
    this.pause = function () { };
    this.stop = function () { };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      Lampa.Listener.remove('jellyfin:row-updated', onRowUpdated);
      playlistFocusedRow = null;
      playlistRingFocused = false;
      rowsById = {};
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function fetchAlbumAudioRows(albumId) {
    if (!albumId) return Promise.resolve([]);
    return resolveUserId()
      .then(function (userId) {
        return jfHttp(
          '/Items?UserId=' +
          encodeURIComponent(userId) +
          '&ParentId=' +
          encodeURIComponent(albumId) +
          '&Recursive=false&IncludeItemTypes=Audio&Fields=' +
          encodeURIComponent('MediaSources,RunTimeTicks,ProviderIds,AlbumId,Album,ArtistItems') +
          '&SortBy=ParentIndexNumber&SortBy=IndexNumber&SortOrder=Ascending'
        ).then(function (data) {
          var items = ((data && data.Items) || []).filter(function (it) {
            return it && it.Type === 'Audio';
          });
          return items.map(function (it) {
            return mapRow(it);
          });
        });
      })
      .catch(function () {
        return [];
      });
  }

  function playAlbumTracks(row) {
    var albumId = (row.raw && row.raw.AlbumId) || '';
    fetchAlbumAudioRows(albumId).then(function (rows) {
      if (!rows.length) {
        openAudioPlayer([row], 0);
        return;
      }
      var start = 0;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === row.id) {
          start = i;
          break;
        }
      }
      openAudioPlayer(rows, start);
    });
  }

  function playMusicAlbum(row) {
    if (!row || !row.id) return;
    fetchAlbumAudioRows(row.id).then(function (rows) {
      if (!rows.length) {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_empty') });
        return;
      }
      openAudioPlayer(rows, 0);
    });
  }

  function saveAudioCache(rows, index) {
    try {
      Lampa.Storage.set(AUDIO_CACHE_KEY, JSON.stringify({ tracks: rows, index: index || 0 }));
    } catch (e) {}
  }

  function readAudioCache() {
    try {
      var raw = Lampa.Storage.get(AUDIO_CACHE_KEY, '');
      var parsed = null;
      if (raw != null && raw !== '') {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      if (!parsed || !Array.isArray(parsed.tracks) || !parsed.tracks.length) return null;
      return { tracks: parsed.tracks, index: Number(parsed.index) || 0 };
    } catch (e) {
      return null;
    }
  }

  function clearAudioCache() {
    try {
      Lampa.Storage.remove(AUDIO_CACHE_KEY);
    } catch (e) {}
  }

  function openAudioPlayer(rows, index) {
    if (!rows || !rows.length) return;
    index = typeof index === 'number' ? index : 0;
    saveAudioCache(rows, index);
    audioReturnTarget = compactActivity(Lampa.Activity.active());
    saveViewerResumeTarget(audioReturnTarget);
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'audio']),
      title: (rows[0] && rows[0].title) || '',
      component: AUDIO_PLAYER_COMPONENT,
      tracks: rows,
      index: index,
    });
  }

  function playMediaRowDirect(row) {
    if ((row.type === 'Movie' || row.type === 'Episode') && externalQualityPickerEnabled()) {
      showExternalTranscodeQualityPicker(row, null, {});
      return;
    }
    if (row.type === 'Series') {
      fetchEpisodes(row.id)
        .then(function (eps) {
          if (!eps.length) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_empty') });
            return;
          }
          var resume = eps.find(function (ep) {
            return ep.playedPct > 0 && ep.playedPct < 100;
          });
          if (resume) {
            playRow(resume, eps);
            return;
          }
          if (eps.length === 1) {
            playRow(eps[0], eps);
            return;
          }
          openSeriesEpisodes(row);
        })
        .catch(function () {
          Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
        });
      return;
    }
    if (row.type === 'Audio') {
      playAlbumTracks(row);
      return;
    }
    playRow(row);
  }

  function playMediaRow(row) {
    if (row && row.type === 'MusicAlbum') {
      playMusicAlbum(row);
      return;
    }
    if (row && row.type === 'PhotoAlbum') {
      openFolderRow(row);
      return;
    }
    if (row && isFolderRowType(row.type)) {
      openFolderRow(row);
      return;
    }
    if (row && row.type === 'Photo') {
      openPhotoViewerFlow(row);
      return;
    }
    ensurePlaybackVariants(row)
      .then(playMediaRowDirect)
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  var PHOTO_ARROW_LEFT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>';
  var PHOTO_ARROW_RIGHT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"></path></svg>';
  var PHOTO_PLAY_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 5v14l11-7z"></path></svg>';
  var PHOTO_PAUSE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M6 5h4v14H6zM14 5h4v14h-4z"></path></svg>';
  var PHOTO_FULLSCREEN_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>';
  var PHOTO_ROTATE_LEFT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"></path></svg>';
  var PHOTO_ROTATE_RIGHT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15.55 5.55 11 1v4.07C7.06 5.56 4 8.92 4 13s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.52.75.87 1.59 1.01 2.47h2.03zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.41-1.42c-.75.52-1.59.87-2.46 1.01zM19.93 13H17.9c.14.88.5 1.72 1.02 2.47l1.42-1.41c-.38-.33-.72-.7-1.01-1.06z"></path></svg>';
  var PHOTO_ZOOM_IN_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"></path></svg>';
  var PHOTO_ZOOM_OUT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM11 10H7V9h4v1z"></path></svg>';
  var PHOTO_ZOOM_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>';
  var AUDIO_VOLUME_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>';
  var AUDIO_VOLUME_OFF_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"></path></svg>';
  var SHUFFLE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"></path></svg>';
  var REPEAT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"></path></svg>';
  var REPEAT_ONE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"></path></svg>';
  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>';
  var PLAYLIST_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"></path></svg>';
  var SEEK_BACK_SVG =
    '<svg viewBox="0 0 35 24" aria-hidden="true">' +
    '<path d="M14.75 10.2302C13.4167 11 13.4167 12.9245 14.75 13.6943L32 23.6536C33.3333 24.4234 35 23.4612 35 21.9216L35 2.00298C35 0.463381 33.3333 -0.498867 32 0.270933L14.75 10.2302Z" fill="currentColor"></path>' +
    '<path d="M1.75 10.2302C0.416665 11 0.416667 12.9245 1.75 13.6943L19 23.6536C20.3333 24.4234 22 23.4612 22 21.9216L22 2.00298C22 0.463381 20.3333 -0.498867 19 0.270933L1.75 10.2302Z" fill="currentColor"></path>' +
    '<rect width="6" height="24" rx="2" transform="matrix(-1 0 0 1 6 0)" fill="currentColor"></rect>' +
    '</svg>';
  var SEEK_FWD_SVG =
    '<svg viewBox="0 0 35 24" aria-hidden="true">' +
    '<path d="M20.25 10.2302C21.5833 11 21.5833 12.9245 20.25 13.6943L3 23.6536C1.66666 24.4234 -6.72981e-08 23.4612 0 21.9216L8.70669e-07 2.00298C9.37967e-07 0.463381 1.66667 -0.498867 3 0.270933L20.25 10.2302Z" fill="currentColor"></path>' +
    '<path d="M33.25 10.2302C34.5833 11 34.5833 12.9245 33.25 13.6943L16 23.6536C14.6667 24.4234 13 23.4612 13 21.9216L13 2.00298C13 0.463381 14.6667 -0.498867 16 0.270933L33.25 10.2302Z" fill="currentColor"></path>' +
    '<rect x="29" width="6" height="24" rx="2" fill="currentColor"></rect>' +
    '</svg>';
  var SEEK_START_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M5 6h2v12H5zM19 6l-9 6 9 6z"></path></svg>';
  var SEEK_END_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M5 6l9 6-9 6zM17 6h2v12h-2z"></path></svg>';
  var SETTINGS_SVG =
    '<svg viewBox="0 0 28 29" aria-hidden="true">' +
    '<path d="M2.35883 18.1883L1.63573 17.4976L2.35883 18.1883L3.00241 17.5146C3.8439 16.6337 4.15314 15.4711 4.15314 14.4013C4.15314 13.3314 3.8439 12.1688 3.00241 11.2879L2.27931 11.9786L3.00241 11.2879L2.35885 10.6142C1.74912 9.9759 1.62995 9.01336 2.0656 8.24564L2.66116 7.19613C3.10765 6.40931 4.02672 6.02019 4.90245 6.24719L5.69281 6.45206C6.87839 6.75939 8.05557 6.45293 8.98901 5.90194C9.8943 5.36758 10.7201 4.51559 11.04 3.36732L11.2919 2.46324C11.5328 1.59833 12.3206 1 13.2185 1H14.3282C15.225 1 16.0121 1.59689 16.2541 2.46037L16.5077 3.36561C16.8298 4.51517 17.6582 5.36897 18.5629 5.90557C19.498 6.4602 20.6725 6.75924 21.8534 6.45313L22.6478 6.2472C23.5236 6.02019 24.4426 6.40932 24.8891 7.19615L25.4834 8.24336C25.9194 9.0118 25.7996 9.97532 25.1885 10.6135L24.5426 11.2882C23.7 12.1684 23.39 13.3312 23.39 14.4013C23.39 15.4711 23.6992 16.6337 24.5407 17.5146L25.1842 18.1883C25.794 18.8266 25.9131 19.7891 25.4775 20.5569L24.8819 21.6064C24.4355 22.3932 23.5164 22.7823 22.6406 22.5553L21.8503 22.3505C20.6647 22.0431 19.4876 22.3496 18.5541 22.9006C17.6488 23.4349 16.8231 24.2869 16.5031 25.4352L16.2513 26.3393C16.0103 27.2042 15.2225 27.8025 14.3246 27.8025H13.2184C12.3206 27.8025 11.5328 27.2042 11.2918 26.3393L11.0413 25.4402C10.7206 24.2889 9.89187 23.4336 8.98627 22.8963C8.05183 22.342 6.87822 22.0432 5.69813 22.3491L4.90241 22.5553C4.02667 22.7823 3.10759 22.3932 2.66111 21.6064L2.06558 20.5569C1.62993 19.7892 1.74911 18.8266 2.35883 18.1883Z" stroke="currentColor" stroke-width="2.4" fill="none"></path>' +
    '<circle cx="13.7751" cy="14.4013" r="4.1675" stroke="currentColor" stroke-width="2.4" fill="none"></circle>' +
    '</svg>';

  function photoImageUrl(row) {
    var id = row && row.id;
    if (id) {
      return (
        apiBase() +
        '/Items/' +
        encodeURIComponent(id) +
        '/Images/Primary?maxWidth=3840&maxHeight=2160&quality=90' +
        '&api_key=' +
        encodeURIComponent(apiKey())
      );
    }
    return (row && row.poster) || '';
  }

  function fetchSiblingPhotos(row) {
    return resolveUserId().then(function (userId) {
      var raw = row.raw || {};
      var itemPath = raw.Path || '';
      var itemFolder = '';
      if (itemPath) {
        var parts = itemPath.replace(/\\/g, '/').split('/');
        parts.pop();
        itemFolder = parts.join('/');
      }
      var libUrl = '/Users/' + encodeURIComponent(userId) + '/Views?api_key=' + encodeURIComponent(apiKey());
      return jfHttp(libUrl).then(function (views) {
        var libs = (views && views.Items) || [];
        var photoLibs = [];
        for (var i = 0; i < libs.length; i++) {
          if (libs[i].CollectionType === 'homevideos' || libs[i].CollectionType === 'photos') {
            photoLibs.push(libs[i]);
          }
        }
        if (!photoLibs.length) return [];
        var queries = photoLibs.map(function (lib) {
          var searchUrl =
            '/Items?UserId=' + encodeURIComponent(userId) +
            '&ParentId=' + encodeURIComponent(lib.Id) +
            '&Recursive=true&IncludeItemTypes=Photo&' +
            listFieldsQuery(0);
          return jfHttp(searchUrl).then(function (data) {
            return (data && data.Items) || [];
          }).catch(function () { return []; });
        });
        return Promise.all(queries).then(function (results) {
          var allItems = [];
          results.forEach(function (items) { allItems = allItems.concat(items); });
          if (itemFolder) {
            var folderName = itemFolder.split('/').pop().toLowerCase();
            allItems = allItems.filter(function (it) {
              var p = (it.Path || '').replace(/\\/g, '/').split('/');
              p.pop();
              return p.join('/').toLowerCase().indexOf(folderName) !== -1;
            });
          }
          return allItems.map(function (it) { return mapRow(it); });
        });
      }).catch(function () { return []; });
    });
  }

  function openPhotoViewer(row, photos, index) {
    var list = Array.isArray(photos) && photos.length ? photos : [row];
    savePhotoViewerResumeTarget(row);
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'photo']),
      title: (row && row.title) || '',
      component: PHOTO_VIEWER_COMPONENT,
      row: row,
      photos: list,
      index: typeof index === 'number' ? index : 0,
    });
  }


  function openPhotoViewerFlow(row, index) {
    if (!row) return;
    var idx = typeof index === 'number' ? index : 0;

    if (row.type === 'PhotoAlbum' || isFolderRowType(row.type)) {
      openFolderRow(row);
      return;
    }

    if (row.type === 'Photo') {
      fetchSiblingPhotos(row).then(function (list) {
        if (!list.length) {
          openPhotoViewer(row, [row], 0);
          return;
        }
        var at = 0;
        list.forEach(function (r, i) {
          if (String(r.id) === String(row.id)) at = i;
        });
        openPhotoViewer(list[at] || row, list, at);
      }).catch(function () {
        openPhotoViewer(row, [row], 0);
      });
      return;
    }

    openPhotoViewer(row, [row], idx);
  }

  function PhotoViewerComponent(object) {
    var self = this;
    var row = (object && object.row) || null;
    var photos = (object && object.photos) || [];
    if (!photos.length && row) photos = [row];
    var multi = photos.length > 1;
    var index = photos.length
      ? Math.max(0, Math.min(Number((object && object.index) || 0) || 0, photos.length - 1))
      : 0;
    var slideshowOn = false;
    var slideshowTimer = null;
    var SLIDESHOW_INTERVAL_MS = 5000;
    var rotation = 0;
    var zoom = 1;
    var fullscreen = false;
    var androidInsetBottom = 0;
    var lastBtnAction = 0;
    var imgBust = Date.now();
    var imgFailCount = 0;
    var isAndroid = platformIs('android');
    var isTv = isTvPlatform();
    var isTizen = platformIs('tizen');
    var noFlexGap = isTizen && !flexGapSupported();

    var html = $(
      '<div class="jellyfin-photo">' +
      '<img class="jellyfin-photo__img" alt="">' +
      '<div class="jellyfin-photo__controls">' +
      '<div class="jellyfin-photo__bar">' +
      '<div class="jellyfin-photo__side"></div>' +
      '<div class="jellyfin-photo__row">' +
      '<div class="jellyfin-photo__btn selector" data-act="rotl">' +
      PHOTO_ROTATE_LEFT_SVG +
      '</div>' +
      '<div class="jellyfin-photo__btn selector" data-act="prev">' +
      PHOTO_ARROW_LEFT_SVG +
      '</div>' +
      '<div class="jellyfin-photo__btn jellyfin-photo__btn--play selector" data-act="play">' +
      PHOTO_PLAY_SVG +
      '</div>' +
      '<div class="jellyfin-photo__btn selector" data-act="next">' +
      PHOTO_ARROW_RIGHT_SVG +
      '</div>' +
      '<div class="jellyfin-photo__btn selector" data-act="rotr">' +
      PHOTO_ROTATE_RIGHT_SVG +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-photo__side jellyfin-photo__side--right">' +
      '<div class="jellyfin-photo__zoomwrap">' +
      '<div class="jellyfin-photo__btn jellyfin-photo__btn--top selector" data-act="zoom">' +
      PHOTO_ZOOM_SVG +
      '</div>' +
      '<div class="jellyfin-photo__zdrop">' +
      '<div class="jellyfin-photo__zbtn jellyfin-photo__zbtn--sm selector" data-act="zoomin">' +
      PHOTO_ZOOM_IN_SVG +
      '</div>' +
      '<div class="jellyfin-photo__zbtn jellyfin-photo__zbtn--sm jellyfin-photo__zbtn--one selector" data-act="zoomreset">1:1</div>' +
      '<div class="jellyfin-photo__zslider">' +
      '<div class="jellyfin-photo__zfill"></div>' +
      '<div class="jellyfin-photo__zthumb"></div>' +
      '<input type="range" orient="vertical" class="jellyfin-photo__zrange" min="0" max="1" step="0.01">' +
      '</div>' +
      '<div class="jellyfin-photo__zbtn jellyfin-photo__zbtn--sm selector" data-act="zoomout">' +
      PHOTO_ZOOM_OUT_SVG +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-photo__btn jellyfin-photo__btn--top selector" data-act="full">' +
      PHOTO_FULLSCREEN_SVG +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-photo__counter"></div>' +
      '</div>' +
      '</div>'
    );
    if (isAndroid) html.addClass('jellyfin-photo--android');
    if (isTv) html.addClass('jellyfin-photo--tv');
    if (isTizen) html.addClass('jellyfin-photo--tizen');
    if (noFlexGap) html.addClass('jellyfin-photo--noflexgap');
    var $img = html.find('.jellyfin-photo__img');
    var $counter = html.find('.jellyfin-photo__counter');
    var $controls = html.find('.jellyfin-photo__controls');
    var $full = html.find('[data-act="full"]');
    var $prev = html.find('[data-act="prev"]');
    var $play = html.find('[data-act="play"]');
    var $next = html.find('[data-act="next"]');
    var $rotl = html.find('[data-act="rotl"]');
    var $rotr = html.find('[data-act="rotr"]');
    var $zoom = html.find('[data-act="zoom"]');
    var $zoomin = html.find('[data-act="zoomin"]');
    var $zoomout = html.find('[data-act="zoomout"]');
    var $zreset = html.find('[data-act="zoomreset"]');
    var $zdrop = html.find('.jellyfin-photo__zdrop');
    var $zslider = html.find('.jellyfin-photo__zslider');
    var $zfill = html.find('.jellyfin-photo__zfill');
    var $zthumb = html.find('.jellyfin-photo__zthumb');
    var $zrange = html.find('.jellyfin-photo__zrange');

    if (!multi) {
      $prev.hide();
      $next.hide();
      $counter.hide();
    }

    var zoomPopupOpen = false;
    var zoomRangeEm = isAndroid ? 7 : isTv ? 9 : 8;
    var focusRows = [];
    function rebuildFocusRows() {
      focusRows = [
        multi ? [$rotl, $prev, $play, $next, $rotr, $zoom, $full] : [$rotl, $play, $rotr, $zoom, $full],
        zoomPopupOpen ? [$zoomin, $zreset, $zoomout] : []
      ];
    }
    rebuildFocusRows();
    var focusRow = -1;
    var focusCol = -1;

    function setFocusEl($el) {
      html.find('.jellyfin-photo__btn.focus, .jellyfin-photo__zbtn.focus').removeClass('focus');
      if (!$el || !$el.length) {
        focusRow = -1;
        focusCol = -1;
        return;
      }
      $el.addClass('focus');
      for (var r = 0; r < focusRows.length; r++) {
        for (var c = 0; c < focusRows[r].length; c++) {
          if (focusRows[r][c] && focusRows[r][c][0] === $el[0]) {
            focusRow = r;
            focusCol = c;
            return;
          }
        }
      }
      focusRow = -1;
      focusCol = -1;
    }

    function focusAt(r, c) {
      if (r < 0 || r >= focusRows.length) {
        setFocusEl(null);
        return;
      }
      var row = focusRows[r];
      if (c < 0) c = 0;
      if (c >= row.length) c = row.length - 1;
      setFocusEl(row[c]);
    }

    function focusPlayBtn() {
      setFocusEl(multi ? $play : $full);
    }

    function focusedAct() {
      var f = html.find('.jellyfin-photo__btn.focus, .jellyfin-photo__zbtn.focus').first();
      return f.length ? String(f.attr('data-act') || '') : '';
    }

    function currentFocusPos() {
      var f = html.find('.jellyfin-photo__btn.focus, .jellyfin-photo__zbtn.focus').first();
      if (!f.length) return null;
      for (var r = 0; r < focusRows.length; r++) {
        for (var c = 0; c < focusRows[r].length; c++) {
          if (focusRows[r][c] && focusRows[r][c][0] === f[0]) {
            return { r: r, c: c };
          }
        }
      }
      return null;
    }

    function currentPhoto() {
      return photos[index] || row || {};
    }

    function imageSrc(row) {
      var base = photoImageUrl(row);
      if (base && base.indexOf('api_key=') !== -1) base += '&cache_bust=' + imgBust;
      return base;
    }

    function preload(at) {
      if (at < 0 || at >= photos.length) return;
      var src = imageSrc(photos[at]);
      if (src) {
        var im = new Image();
        im.src = src;
      }
    }

    function imgBox() {
      var mw = '94%';
      var mh = 'calc(100% - 7em)';
      if (fullscreen) {
        mw = '100%';
        mh = '100%';
      } else if (androidInsetBottom > 0) {
        mh = 'calc(100% - ' + androidInsetBottom + 'px - 7em)';
      }
      return { mw: mw, mh: mh };
    }

    var ZOOM_MIN = 0.5;
    var ZOOM_MAX = 4;
    var ZOOM_STEP = 0.25;

    function sliderFromZoom(z) {
      if (z <= 1) return Math.max(0, Math.min(0.5, z - 0.5));
      return Math.max(0.5, Math.min(1, (z + 2) / 6));
    }

    function zoomFromSlider(s) {
      if (s <= 0.5) return 0.5 + s;
      return 1 + (s - 0.5) * 6;
    }

    function applyZoomUI() {
      var s = sliderFromZoom(zoom);
      if ($zrange.length) $zrange.val(String(Math.round(s * 100) / 100));
      if ($zfill.length) {
        $zfill.css('height', Math.max(0, Math.round(s * zoomRangeEm * 100) / 100) + 'em');
      }
      if ($zthumb.length) {
        $zthumb.css('bottom', Math.max(0, Math.round(s * zoomRangeEm * 100) / 100) + 'em');
      }
    }

    function applyTransform() {
      var odd = (rotation % 2) !== 0;
      var box = imgBox();
      $img.css('max-width', odd ? box.mh : box.mw);
      $img.css('max-height', odd ? box.mw : box.mh);
      $img.css('transform', 'translate(-50%, -50%) rotate(' + (rotation * 90) + 'deg) scale(' + zoom + ')');
      applyZoomUI();
    }

    function rotateBy(dir) {
      rotation = ((rotation + dir) % 4 + 4) % 4;
      applyTransform();
    }

    function zoomBy(delta) {
      var next = Math.round((zoom + delta) * 100) / 100;
      if (next < ZOOM_MIN) next = ZOOM_MIN;
      if (next > ZOOM_MAX) next = ZOOM_MAX;
      zoom = next;
      applyTransform();
    }

    function zoomReset() {
      zoom = 1;
      applyTransform();
    }

    function toggleZoomPopup(forceOpen) {
      var show = typeof forceOpen === 'boolean' ? forceOpen : !zoomPopupOpen;
      if (show === zoomPopupOpen) {
        if (show && isTv) setFocusEl($zreset);
        return;
      }
      zoomPopupOpen = show;
      html.toggleClass('jellyfin-photo--zoomopen', show);
      $zdrop.toggleClass('jellyfin-photo__zdrop--open', show);
      rebuildFocusRows();
      if (show && isTv) {
        setFocusEl($zreset);
      } else if (!show) {
        setFocusEl($zoom);
      }
    }

    function refresh() {
      var photo = currentPhoto();
      imgFailCount = 0;
      var src = imageSrc(photo);
      if (src) $img.attr('src', src);
      else $img.removeAttr('src');
      if (multi) {
        $counter.text((index + 1) + ' / ' + photos.length);
        $prev.css('visibility', '');
        $next.css('visibility', '');
      }
      preload(index + 1);
      preload(index - 1);
      applyTransform();
    }

    function restartSlideshowTimer() {
      if (slideshowTimer) {
        clearTimeout(slideshowTimer);
        slideshowTimer = null;
      }
      if (!slideshowOn || !multi) return;
      slideshowTimer = setTimeout(function () {
        slideshowTimer = null;
        if (slideshowOn) goTo(index + 1);
      }, SLIDESHOW_INTERVAL_MS);
    }

    function goTo(nextIndex) {
      if (!multi) return;
      var n = ((nextIndex % photos.length) + photos.length) % photos.length;
      if (n === index) return;
      index = n;
      rotation = 0;
      zoom = 1;
      refresh();
      restartSlideshowTimer();
    }

    function startSlideshow() {
      if (!multi || slideshowOn) return;
      slideshowOn = true;
      $play.html(PHOTO_PAUSE_SVG);
      $play.addClass('jellyfin-photo__btn--active');
      restartSlideshowTimer();
    }

    function stopSlideshow() {
      slideshowOn = false;
      if (slideshowTimer) {
        clearTimeout(slideshowTimer);
        slideshowTimer = null;
      }
      $play.html(PHOTO_PLAY_SVG);
      $play.removeClass('jellyfin-photo__btn--active');
    }

    function toggleSlideshow() {
      if (slideshowOn) stopSlideshow();
      else startSlideshow();
    }

    function applyAndroidBottomInset() {
      if (!html.hasClass('jellyfin-photo--android')) return;
      var vh = window.innerHeight || 0;
      if (!vh) return;
      var max = 0;
      try {
        var nodes = document.querySelectorAll('body *');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el === html[0]) continue;
          if (html[0] && $.contains(html[0], el)) continue;
          var cs = window.getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
          var r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          if (r.bottom < vh - 2 || r.bottom > vh + 2) continue;
          if (r.top < vh * 0.5) continue;
          var h = vh - r.top;
          if (h > max) max = h;
        }
      } catch (e) { }
      androidInsetBottom = max;
      $controls.css('bottom', max + 'px');
      applyTransform();
    }

    function syncFullscreenUI() {
      html.toggleClass('jellyfin-photo--full', fullscreen);
      $('body').toggleClass('jellyfin-photo-fs', fullscreen);
      $full.toggleClass('jellyfin-photo__btn--active', fullscreen);
      if (fullscreen) {
        $controls.css('bottom', '');
      } else {
        if (html.hasClass('jellyfin-photo--android')) applyAndroidBottomInset();
      }
      applyTransform();
    }

    function toggleFullscreen() {
      var doc = document;
      var el = html[0];
      var hasNative = !!(
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen
      );
      function isFs() {
        return (
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        );
      }
      function exitFs() {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
      function enterFs() {
        var p = null;
        try {
          if (el.requestFullscreen) p = el.requestFullscreen();
          else if (el.webkitRequestFullscreen) p = el.webkitRequestFullscreen();
          else if (el.mozRequestFullScreen) p = el.mozRequestFullScreen();
          else if (el.msRequestFullscreen) p = el.msRequestFullscreen();
        } catch (e) { p = null; }
        return p;
      }
      if (isFs()) {
        exitFs();
        fullscreen = false;
        syncFullscreenUI();
        return;
      }
      if (fullscreen) {
        fullscreen = false;
        syncFullscreenUI();
        return;
      }
      if (hasNative) {
        var p = enterFs();
        if (p && p.catch) {
          p.catch(function () {
            if (!isFs()) {
              fullscreen = true;
              syncFullscreenUI();
            }
          });
        } else if (!p) {
          fullscreen = true;
          syncFullscreenUI();
        }
        return;
      }
      fullscreen = !fullscreen;
      syncFullscreenUI();
    }

    function onFullscreenChange() {
      var doc = document;
      fullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      syncFullscreenUI();
    }

    var lastBtnAction = 0;
    function guardBtn(fn) {
      return function () {
        var now = Date.now();
        if (now - lastBtnAction < 350) return;
        lastBtnAction = now;
        return fn.apply(this, arguments);
      };
    }

    function activate(act) {
      if (act === 'back') self.back();
      else if (act === 'prev') goTo(index - 1);
      else if (act === 'next') goTo(index + 1);
      else if (act === 'play') toggleSlideshow();
      else if (act === 'full') toggleFullscreen();
      else if (act === 'zoom') toggleZoomPopup();
      else if (act === 'rotl') rotateBy(-1);
      else if (act === 'rotr') rotateBy(1);
      else if (act === 'zoomin') zoomBy(ZOOM_STEP);
      else if (act === 'zoomout') zoomBy(-ZOOM_STEP);
      else if (act === 'zoomreset') zoomReset();
    }

    function focusOnZoomBtn() {
      var pos = currentFocusPos();
      if (!pos) return false;
      var el = focusRows[pos.r] && focusRows[pos.r][pos.c];
      return !!(el && el[0] === $zoom[0]);
    }

    function navLeft() {
      var pos = currentFocusPos();
      if (!pos) {
        goTo(index - 1);
        return;
      }
      if (pos.r === 1) {
        if (pos.c > 0) focusAt(1, pos.c - 1);
        return;
      }
      if (pos.c > 0) focusAt(pos.r, pos.c - 1);
    }

    function navRight() {
      var pos = currentFocusPos();
      if (!pos) {
        goTo(index + 1);
        return;
      }
      if (pos.r === 1) {
        if (pos.c < focusRows[1].length - 1) focusAt(1, pos.c + 1);
        return;
      }
      if (pos.c < focusRows[pos.r].length - 1) focusAt(pos.r, pos.c + 1);
    }

    function navUp() {
      var pos = currentFocusPos();
      if (!pos) return;
      if (pos.r === 1) {
        if (pos.c > 0) focusAt(1, pos.c - 1);
        return;
      }
      if (pos.r > 0) {
        focusAt(pos.r - 1, pos.c);
        return;
      }
      if (focusOnZoomBtn()) toggleZoomPopup(true);
      else setFocusEl(null);
    }

    function navDown() {
      var pos = currentFocusPos();
      if (!pos) return;
      if (pos.r === 1) {
        if (pos.c < focusRows[1].length - 1) focusAt(1, pos.c + 1);
        else toggleZoomPopup(false);
        return;
      }
      if (pos.r < focusRows.length - 1) {
        focusAt(pos.r + 1, pos.c);
        return;
      }
      if (focusOnZoomBtn()) toggleZoomPopup(true);
      else setFocusEl(null);
    }

    function doOk() {
      var now = Date.now();
      if (now - lastBtnAction < 350) return;
      lastBtnAction = now;
      var act = focusedAct();
      if (act) {
        activate(act);
        return;
      }
      toggleSlideshow();
    }

    html.find('.jellyfin-photo__btn').on('hover:enter', function () {
      setFocusEl($(this));
    });
    html.find('.jellyfin-photo__btn').on('click', guardBtn(function () {
      var act = $(this).attr('data-act');
      if (act) activate(act);
    }));

    html.find('.jellyfin-photo__zbtn').on('hover:enter', function () {
      setFocusEl($(this));
    });
    html.find('.jellyfin-photo__zbtn').on('click', guardBtn(function () {
      var act = $(this).attr('data-act');
      if (act) activate(act);
    }));
    $zrange.on('input', function () {
      var s = parseFloat($(this).val());
      if (!isNaN(s)) {
        zoom = Math.round(zoomFromSlider(s) * 100) / 100;
        applyTransform();
      }
    });
    $zslider.on('click', function (e) {
      e.stopPropagation();
      var rect = this.getBoundingClientRect();
      if (!rect.height) return;
      var f = 1 - (e.clientY - rect.top) / rect.height;
      zoom = Math.round(zoomFromSlider(Math.max(0, Math.min(1, f))) * 100) / 100;
      applyTransform();
    });
    $zslider.on('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var el = this;
      function applyFromPointer(pe) {
        var rect = el.getBoundingClientRect();
        if (!rect.height) return;
        var f = 1 - (pe.clientY - rect.top) / rect.height;
        zoom = Math.round(zoomFromSlider(Math.max(0, Math.min(1, f))) * 100) / 100;
        applyTransform();
      }
      applyFromPointer(e);
      var pid = e.pointerId;
      if (!pid && pid !== 0) return;
      if (el.setPointerCapture) {
        try { el.setPointerCapture(pid); } catch (err) { }
      }
      var move = function (ev) {
        if (!ev || ev.pointerId !== pid) return;
        applyFromPointer(ev);
      };
      var up = function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    var touchStartX = null;
    var touchStartY = null;
    html.on('touchstart', function (e) {
      if ($(e.target).closest('.jellyfin-photo__btn, .jellyfin-photo__zbtn, .jellyfin-photo__zslider, .jellyfin-photo__zrange').length) {
        touchStartX = null;
        return;
      }
      var t = e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0];
      if (t) {
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      }
    });
    html.on('touchend', function (e) {
      if (touchStartX == null) return;
      var t = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
      if (!t) {
        touchStartX = null;
        return;
      }
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      touchStartX = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) goTo(index + 1);
      else goTo(index - 1);
    });

    $img.on('error', function () {
      if (imgFailCount >= 2) return;
      imgFailCount++;
      var src = photoImageUrl(currentPhoto());
      if (src && src.indexOf('api_key=') !== -1) {
        $img.attr('src', src + '&cache_bust=' + Date.now() + '-' + imgFailCount);
      }
    });

    function onWindowResize() {
      if (html.hasClass('jellyfin-photo--android')) applyAndroidBottomInset();
    }

    this.create = function () {
      refresh();
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      document.addEventListener('mozfullscreenchange', onFullscreenChange);
      document.addEventListener('MSFullscreenChange', onFullscreenChange);
      window.addEventListener('resize', onWindowResize);
      if (isTv) {
        setTimeout(focusPlayBtn, 120);
      }
      if (html.hasClass('jellyfin-photo--android')) {
        setTimeout(applyAndroidBottomInset, 120);
      }
      return html;
    };

    this.start = function () {
      self.background();
      if (isTizen) {
        try {
          window.focus();
          document.body.focus();
        } catch (e) { }
      }
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () { },
        left: navLeft,
        right: navRight,
        up: navUp,
        down: navDown,
        ok: doOk,
        enter: doOk,
        back: self.back,
      });
      Lampa.Controller.toggle('content');
      if (isTv) focusPlayBtn();
    };

    this.background = function () {
      var bg = (row && (row.displayPoster || row.poster)) || '';
      if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
      else Lampa.Background.immediately('');
    };

    this.pause = function () {
      stopSlideshow();
    };
    this.stop = function () {
      stopSlideshow();
    };
    this.render = function () {
      var src = imageSrc(currentPhoto());
      if (src && $img.attr('src') !== src) $img.attr('src', src);
      return html;
    };
    this.destroy = function () {
      stopSlideshow();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
      window.removeEventListener('resize', onWindowResize);
      var doc = document;
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ) {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
      $('body').removeClass('jellyfin-photo-fs');
      clearViewerResumeTarget();
      html.remove();
    };
    this.back = function () {
      var doc = document;
      var fsEl =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      if (fsEl) {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
        return;
      }
      if (zoomPopupOpen) {
        toggleZoomPopup(false);
        return;
      }
      if (fullscreen) {
        toggleFullscreen();
        return;
      }
      Lampa.Activity.backward();
    };
  }

  function platformIs(name) {
    try {
      if (Lampa.Platform && typeof Lampa.Platform.is === 'function') {
        return !!Lampa.Platform.is(name);
      }
    } catch (e) { }
    return false;
  }

  function isTvPlatform() {
    var names = ['webos', 'tizen', 'smarttv', 'lg', 'netcast', 'lgwebos', 'hisense', 'vidaa', 'xbox', 'roku', 'panasonic', 'vizio', 'androidtv', 'googletv'];
    for (var i = 0; i < names.length; i++) {
      if (platformIs(names[i])) return true;
    }
    try {
      var ua = String(navigator.userAgent || '');
      if (/SmartTV|Tizen|WebOS|webOS|NetCast|LG Browser|Viera|BRAVIA|VIDAA|Hisense|Roku|Xbox|Android TV|GoogleTV|SMART-TV/i.test(ua)) return true;
    } catch (e) { }
    return false;
  }

  function flexGapSupported() {
    try {
      var el = document.createElement('div');
      el.style.display = 'flex';
      el.style.gap = '1px';
      document.documentElement.appendChild(el);
      var g = window.getComputedStyle(el).gap;
      document.documentElement.removeChild(el);
      return g === '1px';
    } catch (e) {
      return false;
    }
  }

  function AudioPlayerComponent(object) {
    var self = this;
    var restoredCache = (object && object.tracks && object.tracks.length)
      ? null
      : readAudioCache();
    var tracks = (object && object.tracks && object.tracks.length)
      ? object.tracks
      : (restoredCache && restoredCache.tracks) || [];
    var index = tracks.length
      ? Math.max(0, Math.min(Number((object && object.index != null) ? object.index : (restoredCache && restoredCache.index) || 0) || 0, tracks.length - 1))
      : 0;
    var playing = false;
    var audio = null;
    var audioUrl = '';
    var shuffleOn = false;
    var shuffleOrder = null;
    var shufflePos = 0;
    var REPEAT_MODES = ['off', 'all', 'one'];
    var repeatIdx = 0;
    var SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    var speedIdx = 3;
    var isAndroid = platformIs('android');
    var isTv = isTvPlatform();
    var isTizen = platformIs('tizen');
    var isWeb = !isAndroid && !isTv;
    var noFlexGap = isTizen && !flexGapSupported();
    var vRangeEm = isAndroid ? 7 : isTv ? 9 : 8;

    var html = $(
      '<div class="jellyfin-audio">' +
      '<div class="jellyfin-audio__bg"></div>' +
      '<div class="jellyfin-audio__top">' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--back selector" data-act="back">' +
      PHOTO_ARROW_LEFT_SVG +
      '</div>' +
      '<div class="jellyfin-audio__art"><img alt=""></div>' +
      '<div class="jellyfin-audio__info">' +
      '<div class="jellyfin-audio__album"></div>' +
      '<div class="jellyfin-audio__title"></div>' +
      '<div class="jellyfin-audio__meta"></div>' +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-audio__panel">' +
      '<div class="jellyfin-audio__panel-inner">' +
      '<div class="jellyfin-audio__side">' +
      '<div class="jellyfin-audio__progress">' +
      '<div class="jellyfin-audio__cur">0:00</div>' +
      '<div class="jellyfin-audio__bar">' +
      '<div class="jellyfin-audio__bar-fill"></div>' +
      '<div class="jellyfin-audio__dot"></div>' +
      '</div>' +
      '<div class="jellyfin-audio__dur">0:00</div>' +
      '</div>' +
      '<div class="jellyfin-audio__controls">' +
      '<div class="jellyfin-audio__controls-group jellyfin-audio__controls-left">' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--prev selector" data-act="prev">' +
      PHOTO_ARROW_LEFT_SVG +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--next selector" data-act="next">' +
      PHOTO_ARROW_RIGHT_SVG +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-audio__controls-group jellyfin-audio__controls-center">' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--sm selector" data-act="start">' +
      SEEK_START_SVG +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--sm selector" data-act="back10">' +
      SEEK_BACK_SVG +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--play selector" data-act="play">' +
      PHOTO_PLAY_SVG +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--sm selector" data-act="fwd10">' +
      SEEK_FWD_SVG +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--sm selector" data-act="end">' +
      SEEK_END_SVG +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-audio__controls-group jellyfin-audio__controls-right">' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--pl selector" data-act="pltoggle">' +
      PLAYLIST_SVG +
      '</div>' +
      '<div class="jellyfin-audio__volume">' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--mute selector" data-act="mute">' +
      '<span class="jellyfin-audio__icon">' +
      AUDIO_VOLUME_SVG +
      '</span>' +
      '<div class="jellyfin-audio__vdrop">' +
      '<div class="jellyfin-audio__vfill"></div>' +
      '<input type="range" orient="vertical" class="jellyfin-audio__vrange" min="0" max="1" step="0.01">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="jellyfin-audio__btn jellyfin-audio__btn--settings selector" data-act="settings">' +
      SETTINGS_SVG +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
    if (isAndroid) html.addClass('jellyfin-audio--android');
    if (isTv) html.addClass('jellyfin-audio--tv');
    if (isTizen) html.addClass('jellyfin-audio--tizen');
    if (isWeb) html.addClass('jellyfin-audio--volbar');
    if (noFlexGap) html.addClass('jellyfin-audio--noflexgap');
    var $bg = html.find('.jellyfin-audio__bg');
    var $art = html.find('.jellyfin-audio__art img');
    var $album = html.find('.jellyfin-audio__album');
    var $title = html.find('.jellyfin-audio__title');
    var $meta = html.find('.jellyfin-audio__meta');
    var $fill = html.find('.jellyfin-audio__bar-fill');
    var $dot = html.find('.jellyfin-audio__dot');
    var $cur = html.find('.jellyfin-audio__cur');
    var $dur = html.find('.jellyfin-audio__dur');
    var $bar = html.find('.jellyfin-audio__bar');
    var $prev = html.find('[data-act="prev"]');
    var $play = html.find('[data-act="play"]');
    var $next = html.find('[data-act="next"]');
    var $back10 = html.find('[data-act="back10"]');
    var $fwd10 = html.find('[data-act="fwd10"]');
    var $start = html.find('[data-act="start"]');
    var $end = html.find('[data-act="end"]');
    var $settings = html.find('[data-act="settings"]');
    var $mute = html.find('[data-act="mute"]');
    var $plToggle = html.find('[data-act="pltoggle"]');
    var $back = html.find('[data-act="back"]');
    var $vrange = html.find('.jellyfin-audio__vrange');
    var $vfill = html.find('.jellyfin-audio__vfill');

    function applyAndroidBottomInset() {
      if (!html.hasClass('jellyfin-audio--android')) return;
      var vh = window.innerHeight || 0;
      if (!vh) return;
      var max = 0;
      try {
        var nodes = document.querySelectorAll('body *');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el === html[0]) continue;
          if (html[0] && $.contains(html[0], el)) continue;
          var cs = window.getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
          var r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          if (r.bottom < vh - 2 || r.bottom > vh + 2) continue;
          if (r.top < vh * 0.5) continue;
          var h = vh - r.top;
          if (h > max) max = h;
        }
      } catch (e) { }
      if (max > 0) html.find('.jellyfin-audio__panel').css('padding-bottom', Math.min(vh * 0.4, max) + 'px');
    }

    function onWindowResize() {
      if (html.hasClass('jellyfin-audio--android')) applyAndroidBottomInset();
    }

    function currentTrack() {
      return tracks[index] || null;
    }

    function artistOf(row) {
      var raw = (row && row.raw) || {};
      var names = [];
      var list = raw.ArtistItems || raw.Artists || [];
      list.forEach(function (a) {
        var n = typeof a === 'string' ? a : (a && a.Name) || '';
        if (n && names.indexOf(n) < 0) names.push(n);
      });
      return names.join(', ');
    }

    function trackPoster(row) {
      var src = row.displayPoster || row.poster;
      return src && src !== IMG_PLACEHOLDER ? src : '';
    }

    function fmtTime(sec) {
      sec = Math.max(0, Math.floor(Number(sec) || 0));
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function audioStreamInfo(row) {
      var ms = (row && row.raw && row.raw.MediaSources && row.raw.MediaSources.length)
        ? row.raw.MediaSources[0]
        : {};
      var streams = (ms && ms.MediaStreams) || [];
      var stream = null;
      for (var i = 0; i < streams.length; i++) {
        if (streams[i] && streams[i].Type === 'Audio') {
          stream = streams[i];
          break;
        }
      }
      var info = { format: '', bitrate: '', channels: '', sample: '' };
      if (stream) {
        if (stream.Codec) info.format = String(stream.Codec).toUpperCase();
        if (stream.BitRate) info.bitrate = Math.max(1, Math.round(stream.BitRate / 1000)) + ' kbps';
        if (stream.Channels) {
          var ch = Number(stream.Channels);
          if (ch >= 6) info.channels = '5.1';
          else if (ch >= 2) info.channels = '2.0';
          else info.channels = ch + ' ch';
        }
        if (stream.SampleRate) {
          var sr = Number(stream.SampleRate);
          info.sample = (sr >= 1000 ? Math.round((sr / 1000) * 10) / 10 : sr) + ' kHz';
        }
      }
      return info;
    }

    function bufferAhead() {
      if (!audio) return 0;
      try {
        var b = audio.buffered;
        if (!b || !b.length) return 0;
        return Math.max(0, b.end(b.length - 1) - (audio.currentTime || 0));
      } catch (e) {
        return 0;
      }
    }

    var lastMetaUpdateAt = 0;
    function updateMeta() {
      var now = Date.now();
      if (audio && now - lastMetaUpdateAt < 1000) return;
      lastMetaUpdateAt = now;
      var row = currentTrack();
      if (!row || !$meta) return;
      var parts = [];
      var info = audioStreamInfo(row);
      if (info.format) parts.push(info.format);
      if (info.bitrate) parts.push(info.bitrate);
      if (info.sample) parts.push(info.sample);
      if (info.channels) parts.push(info.channels);
      var buf = bufferAhead();
      if (buf >= 1) {
        parts.push(
          Lampa.Lang.translate('jellyfin_buffer') +
          ' ' +
          Math.floor(buf) +
          ' ' +
          Lampa.Lang.translate('jellyfin_sec')
        );
      }
      $meta.text(parts.join(' · '));
    }

    function showPlaylistPopup() {
      var ctl = enabledControllerName('content');
      var items = tracks.map(function (row, i) {
        var rt = (row.raw && row.raw.RunTimeTicks) ? Math.round(row.raw.RunTimeTicks / 10000000) : 0;
        return {
          title: row.title || '',
          subtitle: fmtTime(rt),
          selected: i === index,
          jellyfinIndex: i,
        };
      });
      Lampa.Select.show({
        title: Lampa.Lang.translate('jellyfin_playlist') + ' (' + tracks.length + ')',
        items: items,
        onSelect: function (sel) {
          if (!sel) return;
          var i = Number(sel.jellyfinIndex);
          if (!isNaN(i) && i >= 0 && i < tracks.length) playTrack(i, true);
          deferControllerToggle(ctl);
        },
        onBack: function () {
          deferControllerToggle(ctl);
        },
      });

      if (window.innerWidth <= 480) {
        var sb = Lampa.Select.render().find('.selectbox__body');
        if (sb.length) {
          var smax = parseFloat(sb.css('max-height'));
          if (smax && sb.height() >= smax - 1) sb.css('height', smax + 'px');
        }
      }
    }

    function renderNowPlaying() {
      var row = currentTrack();
      if (!row) return;
      var artist = artistOf(row);
      var album = (row.raw && row.raw.Album) || '';
      $album.text(artist ? artist + ' — ' + album : album);
      $title.text(row.title || '');
      updateMeta();
      var src = trackPoster(row);
      if (src) {
        $art.attr('src', src);
        $bg.css('background-image', 'url("' + src.replace(/"/g, '') + '")');
      } else {
        $art.removeAttr('src');
        $bg.css('background-image', '');
      }
      self.background();
    }

    function setPlayingUI(p) {
      playing = p;
      if (p) {
        $play.html(PHOTO_PAUSE_SVG);
        $play.addClass('jellyfin-audio__btn--active');
      } else {
        $play.html(PHOTO_PLAY_SVG);
        $play.removeClass('jellyfin-audio__btn--active');
      }
    }

    function loadTrack(i, autoplay) {
      if (i < 0 || i >= tracks.length) return;
      cancelPendingSeek();
      index = i;
      renderNowPlaying();
      var row = tracks[i];
      resolveUserId()
        .then(function (userId) {
          var url = audioPlayerUrl(row, userId);
          if (!url) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
            return;
          }
          audioUrl = url;
          audio.src = url;
          applySpeed();
          if (autoplay !== false) {
            audio.play().catch(function () { });
          }
        });
    }

    function playTrack(i, autoplay) {
      if (i < 0 || i >= tracks.length) return;
      if (shuffleOn) {
        shuffleOrder = buildShuffleOrderFor(i);
        shufflePos = 0;
      }
      loadTrack(i, autoplay);
    }

    function togglePlay() {
      if (!tracks.length) return;
      if (!audio.src) {
        playTrack(index, true);
        return;
      }
      if (audio.paused) audio.play().catch(function () { });
      else audio.pause();
    }

    function nextTrack(auto) {
      if (!tracks.length) return;
      var n = -1;
      if (shuffleOn && shuffleOrder && shuffleOrder.length) {
        if (shufflePos + 1 < shuffleOrder.length) {
          shufflePos++;
          n = shuffleOrder[shufflePos];
        } else if (repeatMode() === 'all') {
          shuffleOrder = buildShuffleOrderFor(index);
          shufflePos = 0;
          n = shuffleOrder[0];
        } else {
          if (auto) {
            self.pause();
            setPlayingUI(false);
            return;
          }
          shuffleOrder = buildShuffleOrderFor(index);
          shufflePos = 0;
          n = shuffleOrder[0];
        }
      } else {
        n = index + 1;
        if (n >= tracks.length) {
          if (repeatMode() === 'all' || !auto) n = 0;
          else {
            self.pause();
            setPlayingUI(false);
            return;
          }
        }
      }
      loadTrack(n, true);
    }

    function prevTrack() {
      if (!tracks.length) return;
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        updateProgress();
        return;
      }
      var n;
      if (shuffleOn && shuffleOrder && shuffleOrder.length) {
        if (shufflePos > 0) {
          shufflePos--;
          n = shuffleOrder[shufflePos];
        } else {
          shufflePos = shuffleOrder.length - 1;
          n = shuffleOrder[shufflePos];
        }
      } else {
        n = index - 1;
        if (n < 0) n = tracks.length - 1;
      }
      loadTrack(n, true);
    }

    function buildShuffleOrderFor(start) {
      var arr = [];
      for (var i = 0; i < tracks.length; i++) arr.push(i);
      for (var j = arr.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var t = arr[j];
        arr[j] = arr[k];
        arr[k] = t;
      }
      var si = arr.indexOf(start);
      if (si > -1) {
        arr.splice(si, 1);
        arr.unshift(start);
      }
      return arr;
    }

    function toggleShuffle() {
      shuffleOn = !shuffleOn;
      if (shuffleOn) {
        shuffleOrder = buildShuffleOrderFor(index);
        shufflePos = 0;
      } else {
        shuffleOrder = null;
        shufflePos = 0;
      }
    }

    function repeatMode() {
      return REPEAT_MODES[repeatIdx];
    }

    function cycleRepeat() {
      repeatIdx = (repeatIdx + 1) % REPEAT_MODES.length;
    }

    function speedLabel(s) {
      if (s === 1) return Lampa.Lang.translate('jellyfin_speed_default');
      var v = Math.round(s * 100) / 100;
      return v.toFixed(2).replace(/\.00$/, '');
    }

    function applySpeed() {
      if (isTizen) return;
      if (!audio) return;
      try {
        audio.playbackRate = SPEEDS[speedIdx];
      } catch (e) { }
    }

    function setSpeedByIndex(i) {
      if (i < 0 || i >= SPEEDS.length) return;
      speedIdx = i;
      applySpeed();
    }

    function repeatLabel(m) {
      if (m === 'one') return Lampa.Lang.translate('jellyfin_repeat_one');
      if (m === 'all') return Lampa.Lang.translate('jellyfin_repeat_all');
      return Lampa.Lang.translate('jellyfin_repeat_off');
    }

    function showSpeedPopup() {
      var items = SPEEDS.map(function (s) {
        return {
          title: speedLabel(s),
          value: s,
          selected: s === SPEEDS[speedIdx],
        };
      });
      Lampa.Select.show({
        title: Lampa.Lang.translate('jellyfin_speed'),
        items: items,
        nohide: true,
        onSelect: function (sel) {
          if (!sel) return;
          setSpeedByIndex(SPEEDS.indexOf(Number(sel.value)));
          showSettingsPopup();
        },
        onBack: showSettingsPopup,
      });
    }

    function showSettingsPopup() {
      var ctl = enabledControllerName('content');
      var items = [];
      if (!isTizen) items.push({ title: Lampa.Lang.translate('jellyfin_speed'), subtitle: speedLabel(SPEEDS[speedIdx]), act: 'speed' });
      items.push({ title: Lampa.Lang.translate('jellyfin_shuffle'), subtitle: shuffleOn ? Lampa.Lang.translate('jellyfin_on') : Lampa.Lang.translate('jellyfin_off'), act: 'shuffle' });
      items.push({ title: Lampa.Lang.translate('jellyfin_repeat'), subtitle: repeatLabel(repeatMode()), act: 'repeat' });
      Lampa.Select.show({
        title: Lampa.Lang.translate('jellyfin_settings'),
        items: items,
        nohide: true,
        onSelect: function (sel) {
          if (!sel) return;
          var act = sel.act;
          if (act === 'speed') showSpeedPopup();
          else if (act === 'shuffle') {
            toggleShuffle();
            showSettingsPopup();
          } else if (act === 'repeat') {
            cycleRepeat();
            showSettingsPopup();
          }
        },
        onBack: function () {
          deferControllerToggle(ctl);
        },
      });
    }

    function seekBy(sec) {
      if (!audio || !audio.duration) return;
      var t = audio.currentTime + sec;
      if (t < 0) t = 0;
      if (t > audio.duration) t = audio.duration;
      audio.currentTime = t;
      updateProgress();
    }

    function seekToStart() {
      if (!audio || !audio.duration) return;
      audio.currentTime = 0;
      updateProgress();
    }

    function seekToEnd() {
      if (!audio || !audio.duration) return;
      audio.currentTime = audio.duration;
      updateProgress();
    }

    function togglePlaylist() {
      showPlaylistPopup();
    }

    function closePlayer() {
      self.back();
    }

    function enableFullscreen() {
      $('body').addClass('jellyfin-audio-fs');
    }

    function disableFullscreen() {
      $('body').removeClass('jellyfin-audio-fs');
    }

    function nativeFsActive() {
      var doc = document;
      return !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
    }

    function nativeFsExit() {
      var doc = document;
      if (!nativeFsActive()) return;
      try {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      } catch (e) {}
    }

    function mountToBody() {
      if (isTv) return;
      setTimeout(function () {
        if (!html || !html[0] || !html[0].parentNode) return;
        if (nativeFsActive()) return;
        if (html[0].parentNode === document.body) return;
        $(document.body).append(html);
      }, 0);
    }

    function updateProgress() {
      if (!audio || !audio.duration) return;
      if (pendingSeek >= 0) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      $fill.css('width', pct + '%');
      $dot.css('left', 'calc(' + pct + '% - .45em)');
      $cur.text(fmtTime(audio.currentTime));
      $dur.text(fmtTime(audio.duration));
      updateMeta();
    }

    function seekToPct(pct) {
      if (!audio || !audio.duration) return;
      audio.currentTime = (pct / 100) * audio.duration;
      updateProgress();
    }

    function volumeValue() {
      if (!audio) return 1;
      return audio.muted ? 0 : audio.volume;
    }

    function applyVolumeUI() {
      var v = volumeValue();
      if ($vrange.length) $vrange.val(String(v));
      if ($vfill.length) {
        $vfill.css('height', Math.max(0, Math.round(v * vRangeEm * 100) / 100) + 'em');
      }
      var $icon = $mute.find('.jellyfin-audio__icon');
      if (audio && audio.muted) {
        $icon.html(AUDIO_VOLUME_OFF_SVG);
        $mute.addClass('jellyfin-audio__btn--muted');
      } else {
        $icon.html(AUDIO_VOLUME_SVG);
        $mute.removeClass('jellyfin-audio__btn--muted');
      }
    }

    function setVolume(v) {
      if (!audio) return;
      v = Math.max(0, Math.min(1, v));
      audio.muted = false;
      audio.volume = v;
      applyVolumeUI();
    }

    function toggleMute() {
      if (!audio) return;
      if (audio.muted) {
        audio.muted = false;
      } else {
        audio.muted = true;
      }
      applyVolumeUI();
    }

    audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1;
    audio.addEventListener('play', function () {
      setPlayingUI(true);
    });
    audio.addEventListener('pause', function () {
      setPlayingUI(false);
    });
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('progress', updateProgress);
    audio.addEventListener('waiting', updateMeta);
    audio.addEventListener('canplay', updateMeta);
    audio.addEventListener('volumechange', applyVolumeUI);
    audio.addEventListener('ended', function () {
      if (repeatMode() === 'one') {
        audio.currentTime = 0;
        audio.play().catch(function () { });
        return;
      }
      nextTrack(true);
    });
    audio.addEventListener('error', function () {
      Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      setPlayingUI(false);
    });

    var lastBtnAction = 0;
    function guardBtn(fn) {
      return function () {
        var now = Date.now();
        if (now - lastBtnAction < 350) return;
        lastBtnAction = now;
        return fn.apply(this, arguments);
      };
    }

    var pendingSeek = -1;
    var pendingSeekTimer = null;

    function schedulePendingSeek() {
      clearTimeout(pendingSeekTimer);
      pendingSeekTimer = setTimeout(function () {
        commitSeek();
      }, 4000);
    }

    function pendingSeekMove(sec) {
      if (!audio || !audio.duration) return;
      var t = (pendingSeek >= 0 ? pendingSeek : audio.currentTime) + sec;
      if (t < 0) t = 0;
      if (t > audio.duration) t = audio.duration;
      pendingSeek = t;
      schedulePendingSeek();
      renderPendingSeek();
    }

    function renderPendingSeek() {
      if (pendingSeek < 0 || !audio || !audio.duration) return;
      var pct = (pendingSeek / audio.duration) * 100;
      $fill.css('width', pct + '%');
      $dot.css('left', 'calc(' + pct + '% - .45em)');
      $cur.text(fmtTime(pendingSeek));
    }

    function commitSeek() {
      clearTimeout(pendingSeekTimer);
      pendingSeekTimer = null;
      if (pendingSeek < 0) return;
      var t = pendingSeek;
      pendingSeek = -1;
      if (audio && audio.duration) {
        if (t < 0) t = 0;
        if (t > audio.duration) t = audio.duration;
        audio.currentTime = t;
      }
      updateProgress();
    }

    function cancelPendingSeek() {
      clearTimeout(pendingSeekTimer);
      pendingSeekTimer = null;
      pendingSeek = -1;
    }

    function focusedIsBar() {
      return !!(isTizen && $bar.length && html.find('.jellyfin-audio__bar.focus').length);
    }

    var focusRows = [
      [$back]
    ];
    if (isTizen) focusRows.push([$bar]);
    focusRows.push([$prev, $next, $start, $back10, $play, $fwd10, $end, $plToggle, $mute, $settings]);
    var focusRow = -1;
    var focusCol = -1;

    function setFocusEl($el) {
      html.find('.jellyfin-audio__btn.focus, .jellyfin-audio__bar.focus').removeClass('focus');
      if (!$el || !$el.length) {
        focusRow = -1;
        focusCol = -1;
        return;
      }
      $el.addClass('focus');
      for (var r = 0; r < focusRows.length; r++) {
        for (var c = 0; c < focusRows[r].length; c++) {
          if (focusRows[r][c] && focusRows[r][c][0] === $el[0]) {
            focusRow = r;
            focusCol = c;
            return;
          }
        }
      }
      focusRow = -1;
      focusCol = -1;
    }

    function focusAt(r, c) {
      if (r < 0 || r >= focusRows.length) {
        setFocusEl(null);
        return;
      }
      var row = focusRows[r];
      if (c < 0) c = 0;
      if (c >= row.length) c = row.length - 1;
      setFocusEl(row[c]);
    }

    function focusPlayBtn() {
      if (tracks.length) setFocusEl($play);
    }

    function focusedAct() {
      var f = html.find('.jellyfin-audio__btn.focus').first();
      return f.length ? String(f.attr('data-act') || '') : '';
    }

    function activate(act) {
      if (act === 'prev') prevTrack();
      else if (act === 'next') nextTrack(false);
      else if (act === 'play') togglePlay();
      else if (act === 'mute') toggleMute();
      else if (act === 'start') seekToStart();
      else if (act === 'back10') seekBy(-10);
      else if (act === 'fwd10') seekBy(10);
      else if (act === 'end') seekToEnd();
      else if (act === 'settings') showSettingsPopup();
      else if (act === 'back' || act === 'close') closePlayer();
      else if (act === 'pltoggle') togglePlaylist();
    }

    function currentFocusPos() {
      var f = html.find('.jellyfin-audio__btn.focus, .jellyfin-audio__bar.focus').first();
      if (!f.length) return null;
      for (var r = 0; r < focusRows.length; r++) {
        for (var c = 0; c < focusRows[r].length; c++) {
          if (focusRows[r][c] && focusRows[r][c][0] === f[0]) {
            return { r: r, c: c };
          }
        }
      }
      return null;
    }

    function navLeft() {
      var pos = currentFocusPos();
      if (!pos) {
        prevTrack();
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $bar[0]) {
        pendingSeekMove(-10);
        return;
      }
      if (pos.c > 0) focusAt(pos.r, pos.c - 1);
    }

    function navRight() {
      var pos = currentFocusPos();
      if (!pos) {
        nextTrack(false);
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $bar[0]) {
        pendingSeekMove(10);
        return;
      }
      if (pos.c < focusRows[pos.r].length - 1) focusAt(pos.r, pos.c + 1);
    }

    function navUp() {
      var pos = currentFocusPos();
      if (!pos) {
        if (!tracks.length) return;
        if (isTv) focusAt(0, 0);
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $bar[0]) {
        commitSeek();
        focusAt(0, 0);
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $mute[0]) {
        setVolume(volumeValue() + 0.1);
        return;
      }
      if (pos.r > 0) focusAt(pos.r - 1, pos.c);
      else setFocusEl(null);
    }

    function navDown() {
      var pos = currentFocusPos();
      if (!pos) {
        if (!tracks.length) return;
        if (isTv) focusPlayBtn();
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $bar[0]) {
        commitSeek();
        if (pos.r < focusRows.length - 1) focusAt(pos.r + 1, 0);
        return;
      }
      if (focusRows[pos.r][pos.c][0] === $mute[0]) {
        setVolume(volumeValue() - 0.1);
        return;
      }
      if (pos.r < focusRows.length - 1) focusAt(pos.r + 1, pos.c);
      else setFocusEl(null);
    }

    function doOk() {
      var now = Date.now();
      if (now - lastBtnAction < 350) return;
      lastBtnAction = now;
      if (focusedIsBar()) {
        commitSeek();
        return;
      }
      var act = focusedAct();
      if (act) {
        activate(act);
        return;
      }
      togglePlay();
    }

    html.find('.jellyfin-audio__btn').on('hover:enter', function () {
      setFocusEl($(this));
    });
    html.find('.jellyfin-audio__btn').on('click', guardBtn(function () {
      var act = $(this).attr('data-act');
      if (act) activate(act);
    }));

    $('.jellyfin-audio__bar', html).on('click', function (e) {
      var rect = this.getBoundingClientRect();
      var pct = rect.width ? ((e.clientX - rect.left) / rect.width) * 100 : 0;
      seekToPct(Math.max(0, Math.min(100, pct)));
    });

    $vrange.on('input', function () {
      var v = parseFloat($(this).val());
      if (!isNaN(v)) setVolume(v);
    });
    $('.jellyfin-audio__vdrop', html).on('click', function (e) {
      e.stopPropagation();
      if (!audio) return;
      var rect = this.getBoundingClientRect();
      if (!rect.height) return;
      var f = 1 - (e.clientY - rect.top) / rect.height;
      setVolume(Math.max(0, Math.min(1, f)));
    });

    function wheelVolume(e) {
      if (!audio || e.originalEvent.deltaY === 0) return;
      var cur = audio.volume;
      if (cur == null) cur = 1;
      var step = 0.05;
      var next = cur + (e.originalEvent.deltaY < 0 ? step : -step);
      setVolume(Math.max(0, Math.min(1, next)));
    }
    $('.jellyfin-audio__btn--mute', html).on('wheel', function (e) {
      var vdropEl = $('.jellyfin-audio__vdrop', html)[0];
      if (!vdropEl || getComputedStyle(vdropEl).display === 'none') return;
      e.preventDefault();
      wheelVolume(e);
    });
    $('.jellyfin-audio__vdrop', html).on('wheel', function (e) {
      e.preventDefault();
      wheelVolume(e);
    });

    this.create = function () {
      if (!tracks.length) {
        setTimeout(function () {
          Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_empty') });
          self.back();
        }, 0);
        return html;
      }
      enableFullscreen();
      updateMeta();
      applyVolumeUI();
      window.addEventListener('resize', onWindowResize);
      if (html.hasClass('jellyfin-audio--android')) {
        setTimeout(applyAndroidBottomInset, 120);
      }
      if (isTv) {
        setTimeout(focusPlayBtn, 120);
      }
      return html;
    };

    this.start = function () {
      mountToBody();
      self.background();
      applyVolumeUI();
      if (isTizen) {
        try {
          window.focus();
          document.body.focus();
        } catch (e) { }
      }
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () { },
        left: navLeft,
        right: navRight,
        up: navUp,
        down: navDown,
        ok: doOk,
        enter: doOk,
        back: self.back,
      });
      Lampa.Controller.toggle('content');
      if (isTv) focusPlayBtn();
      playTrack(index, false);
    };

    this.background = function () {
      var row = currentTrack();
      var bg = trackPoster(row);
      if (bg) Lampa.Background.change(bg);
      else Lampa.Background.immediately('');
    };

    this.pause = function () {
      if (audio && !audio.paused) audio.pause();
    };
    this.stop = function () {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audioUrl = '';
      }
      setPlayingUI(false);
    };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      nativeFsExit();
      disableFullscreen();
      clearAudioCache();
      clearViewerResumeTarget();
      cancelPendingSeek();
      audioReturnTarget = null;
      window.removeEventListener('resize', onWindowResize);
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audioUrl = '';
      }
      html.remove();
    };
    this.back = function () {
      nativeFsExit();
      disableFullscreen();
      clearAudioCache();
      self.stop();
      if (html && html[0] && html[0].parentNode) html.remove();
      Lampa.Activity.backward();
      setTimeout(function () {
        var act = Lampa.Activity.active();
        if (act && String(act.component || '') === AUDIO_PLAYER_COMPONENT) {
          if (audioReturnTarget) Lampa.Activity.replace(audioReturnTarget, true);
        }
        audioReturnTarget = null;
      }, 0);
    };
  }

  function JellyfinDetailComponent(object) {
    var self = this;
    var row = (object && object.row) || {};
    var itemId = row.id;
    var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
    var body = $('<div class="jellyfin-detail"></div>');
    var html = $('<div class="jellyfin-module"></div>');
    var last = null;
    var loading = false;
    var hasMore = true;
    var startIndex = 0;
    var cardsById = {};
    var $start, $descr, $grid;

    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = cardsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      slot.$card.trigger('jf:update', [e.row]);
    }

    Lampa.Listener.follow('jellyfin:row-updated', onRowUpdated);

    scroll.append(body);
    html.append(scroll.render());

    bindScrollLayerVisible(scroll);

    scroll.onWheel = function (step) {
      if (!Lampa.Controller.own(self)) self.start();
      if (Navigator && Navigator.move) Navigator.move(step > 0 ? 'down' : 'up');
    };

    scroll.onEnd = function () {
      if (loading || !hasMore) return;
      loadMore();
    };

    function cardCtx() {
      return {
        owner: self,
        tapToPlay: false,
        homeMedia: false,
        cardsById: cardsById,
        onTouch: function (el) {
          last = el;
        },
        onFocus: function (el, $card, rw) {
          last = el;
          scroll.update($card, false);
          var bg = rw.displayPoster || rw.poster;
          if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
        },
      };
    }

    function renderDetail(item) {
      if (!item || !$start || !$descr) return;
      var title = item.Name || row.title || '';
      var rating = item.CommunityRating ? parseFloat(item.CommunityRating).toFixed(1) : '';
      var genres = (item.Genres || []).slice(0, 4).join(', ');
      var overview = item.Overview || '';
      var year = item.ProductionYear ? String(item.ProductionYear) : '';
      var runtime = '';
      if (item.RunTimeTicks) {
        runtime = Lampa.Utils.secondsToTime(Math.round(item.RunTimeTicks / 10000000), true);
      }
      var img = itemImageUrl(item.Id || itemId, { maxWidth: 400 });
      $start.find('.full--poster').attr('src', img || row.poster || '');
      $start.find('.full-start-new__title').text(title);
      $start.find('.rate--tmdb > div').eq(0).text(rating);
      $start.find('.rate--tmdb').toggleClass('hide', !rating);
      var head = [];
      if (year) head.push(year);
      $start
        .find('.full-start-new__head')
        .toggleClass('hide', !head.length)
        .html(head.join(', '));
      var info = [];
      if (runtime) info.push('<span>' + runtime + '</span>');
      if (genres) info.push('<span>' + genres + '</span>');
      $start.find('.full-start-new__details').html(
        info.join('<span class="full-start-new__split">·</span>')
      );
      $descr.find('.full-descr__text').text(overview);
      $descr.toggleClass('hide', !overview);
    }

    function buildContentCards(list, append) {
      if (!$grid) return;
      if (!append) $grid.empty();
      list.forEach(function (r) {
        $grid.append(makeJellyfinCard(r, cardCtx()));
      });
    }

    function loadContents() {
      if (!itemId) return Promise.resolve({ rows: [], next: 0, hasMore: false });
      return fetchChildren(itemId, '', startIndex);
    }

    function loadInitial() {
      loading = true;
      self.activity.loader(true);
      var detailP = itemId
        ? resolveUserId().then(function (userId) {
            return jfHttp(jellyfinDetailUrl(itemId, userId));
          })
        : Promise.resolve(null);
      detailP
        .then(function (item) {
          renderDetail(item);
          return loadContents();
        })
        .then(function (result) {
          buildContentCards(result.rows, false);
          startIndex = result.next;
          hasMore = result.hasMore;
        })
        .catch(function () {
          if ($descr) $descr.find('.full-descr__text').text(Lampa.Lang.translate('jellyfin_error'));
        })
        .then(function () {
          loading = false;
          if (self.activity) self.activity.loader(false);
          if (self.activity) self.activity.toggle();
          scheduleReflowFocus(scroll, self, last, { animate: true });
        });
    }

    function loadMore() {
      loading = true;
      loadContents()
        .then(function (result) {
          buildContentCards(result.rows, true);
          startIndex = result.next;
          hasMore = result.hasMore;
        })
        .catch(function () { })
        .then(function () {
          loading = false;
        });
    }

    this.create = function () {
      try {
        var isSeries = row.type === 'Series' || row.type === 'Episode';
        var raw = row.raw || {};
        var title = row.title || raw.Name || '';
        var poster = row.poster || '';
        var playable = isPlayableRowType(row.type);

        $start = Lampa.Template.get('full_start_new', {
          title: title,
          tagline: '',
          rating: '',
        });
        if (isSeries) {
          $start
            .find('.full-start-new__poster')
            .addClass('card--tv')
            .append('<div class="card__type">TV</div>');
        }
        $start.find('.full--poster').on('load', function () {
          $start.find('.full-start-new__poster').addClass('loaded');
        });
        $start.find('.full--poster').attr('src', poster);
        $start.find('.full-start-new__reactions').remove();
        $start.find('.button--book, .button--reaction, .button--subscribe, .button--options').remove();
        $start.find('.buttons--container').remove();
        $start.find('.full--tagline').remove();

        var $jfBtn = $(
          '<div class="full-start__button selector button--jellyfin-detail">' +
          '<svg width="20" height="20" viewBox="0 0 24 24">' +
          '<path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
          '<span></span></div>'
        );
        $jfBtn.find('span').text(Lampa.Lang.translate('jellyfin_watch_server'));
        $start.find('.full-start-new__buttons').append($jfBtn);

        if (playable) {
          var tmdb = row.tmdb || tmdbFromItem(raw);
          $start.find('.button--play').on('hover:enter', function () {
            if (tmdb) pushCard(tmdb);
            else playMediaRow(row);
          });
          $jfBtn.on('hover:enter', function () {
            playMediaRow(row);
          });
        } else {
          $start.find('.button--play, .button--jellyfin-detail').remove();
        }

        $descr = Lampa.Template.get('full_descr', {
          text: raw.Overview || '',
          relise: raw.ProductionYear ? String(raw.ProductionYear) : '',
          budget: '',
          countries: '',
        });
        $descr.find('.full--budget').remove();
        $descr.find('.full--countries').remove();
        $descr.find('.full-descr__info').first().toggleClass('hide', !raw.ProductionYear);
        $descr.find('.full-descr__tags').remove();
        $descr.find('.full-descr__text').removeClass('selector');

        $grid = $(
          '<div class="category-full mapping--grid cols--6 jellyfin-grid jellyfin-detail__grid"></div>'
        );
        var $section = $('<div class="jellyfin-detail__section"></div>').text(
          Lampa.Lang.translate('jellyfin_box_contents')
        );

        body.empty().append($start).append($descr).append($section).append($grid);
      } catch (e) {
        body.empty().append(
          $('<div class="jellyfin-detail__title"></div>').text(row.title || '')
        );
      }
      scroll.minus();
      try {
        loadInitial();
      } catch (e) { }
      return html;
    };

    this.start = function () {
      self.background();
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          scroll.restorePosition();
          Lampa.Controller.collectionSet(scroll.render(true));
          Lampa.Controller.collectionFocus(last || false, scroll.render(true));
          if (last) scroll.update($(last), false);
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (Navigator.canmove('down')) Navigator.move('down');
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      var bg = (row && (row.displayPoster || row.poster)) || '';
      if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
      else Lampa.Background.immediately('');
    };
    this.pause = function () { };
    this.stop = function () { };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      Lampa.Listener.remove('jellyfin:row-updated', onRowUpdated);
      cardsById = {};
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function openMediaCard(row) {
    var tmdb = row.tmdb;
    if (tmdb) {
      pushCard(tmdb);
      return;
    }
    if (row.type === 'Episode' && row.raw.SeriesId) {
      jfHttp(
        '/Items/' +
        encodeURIComponent(row.raw.SeriesId) +
        '?Fields=Overview,Genres,CommunityRating,ProductionYear,PremiereDate,OriginalTitle,ImageTags,RunTimeTicks,Seasons'
      )
        .then(function (series) {
          var fromSeries = tmdbFromItem(series);
          if (fromSeries) {
            pushCard(fromSeries);
            return;
          }
          openJellyfinCard({
            id: series.Id,
            raw: series,
            title: series.Name || '',
            poster: posterUrl(series),
            type: 'Series',
            year: series.ProductionYear,
          });
        })
        .catch(function () {
          openJellyfinCard(row);
        });
      return;
    }
    openJellyfinCard(row);
  }

  function showItemMenu(row) {
    prepareRowForExternalQuality(row)
      .then(function (ready) {
        showItemMenuResolved(ready);
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  function showItemMenuResolved(row) {
    var ctl = enabledControllerName();
    var items = buildPlayMenuItems(row);

    if (row.tmdb || row.type === 'Episode' || row.type === 'Series') {
      items.push({ title: Lampa.Lang.translate('jellyfin_open_card'), action: 'card' });
    }
    if (row.type === 'Series') {
      items.push({ title: Lampa.Lang.translate('jellyfin_episodes'), action: 'episodes' });
    }
    if (row.type !== 'Photo') {
      items.push({
        title: Lampa.Lang.translate(row.watched ? 'jellyfin_mark_unwatched' : 'jellyfin_mark_watched'),
        action: row.watched ? 'unwatched' : 'watched',
      });
    }

    Lampa.Select.show({
      title: row.title,
      items: items,
      onBack: function () {
        restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel) return;
        if (sel.action === 'play') {
          launchPlayerFromSelect(ctl, function () {
            playMediaRow(row);
          });
          return;
        }
        if (sel.action === 'play_quality') {
          launchPlayerFromSelect(ctl, function () {
            playMediaRowQuality(row, sel.qualityTarget);
          });
          return;
        }
        if (sel.action === 'episodes') {
          launchPlayerFromSelect(ctl, function () {
            openSeriesEpisodes(row);
          });
          return;
        }
        restoreController(ctl);
        if (sel.action === 'card') openMediaCard(row);
        else if (sel.action === 'watched' || sel.action === 'unwatched') {
          var markWatched = sel.action === 'watched';
          setItemWatched(row, markWatched)
            .then(function () {
              notifyRowWatchedChange(row, markWatched);
            })
            .catch(function () {
              Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
            });
        }
      },
    });
  }

  function injectCardChrome($card, row, opts) {
    opts = opts || {};
    var $view = $card.find('.card__view');
    if (!$view.length) return;

    $view.find('.jellyfin-card-chrome,.jellyfin-card-shade').remove();
    $view.append('<div class="jellyfin-card-shade" aria-hidden="true"></div>');

    var $chrome = $('<div class="jellyfin-card-chrome" aria-hidden="true"></div>');
    if (row.raw && row.raw.Type === 'Episode') {
      $chrome.append(
        '<div class="jellyfin-badge jellyfin-badge-episode">' +
        episodeCodeShort(row.raw) +
        '</div>'
      );
    }
    if (row.quality) {
      $chrome.append('<div class="jellyfin-badge jellyfin-badge-quality">' + row.quality + '</div>');
    }
    if (row.watched || row.playedPct >= 100) {
      var watchedClass = 'jellyfin-badge jellyfin-badge-watched';
      if ($chrome.find('.jellyfin-badge-episode').length) watchedClass += ' jellyfin-badge-watched--episode';
      $chrome.append('<div class="' + watchedClass + '">✓</div>');
    }
    if (row.playedPct > 0 && row.playedPct < 100) {
      $chrome.append(
        '<div class="jellyfin-card-progress"><span style="width:' +
        Math.min(100, Math.round(row.playedPct)) +
        '%"></span></div>'
      );
    }
    $view.append($chrome);
  }

  function updateCardPoster($card, row) {
    var src = row.displayPoster || row.poster;
    if (src && src !== IMG_PLACEHOLDER) $card.find('.card__img').attr('src', src);
  }

  function PanelComponent(object) {
    var self = this;
    var category = (object && object.category) || 'Movie';
    var library = (object && object.library) || null;
    var libraryId = (object && object.libraryId) || (library && library.Id) || '';
    var parentId = (object && object.parentId) || '';
    var folderPath = (object && object.path) || '';
    var homeMedia = !!(object && object.homeMedia);
    var musicMedia = !!(object && object.musicMedia);
    var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
    var body = $('<div class="category-full mapping--grid cols--6 jellyfin-grid"></div>');
    var html = $('<div class="jellyfin-module"></div>');
    var last = null;
    var rows = [];
    var loading = false;
    var hasMore = true;
    var startIndex = 0;
    var tapToPlay = storageToggle('TapPlay', false);
    var cardsById = {};

    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = cardsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      slot.$card.trigger('jf:update', [e.row]);
    }

    Lampa.Listener.follow('jellyfin:row-updated', onRowUpdated);

    scroll.append(body);
    html.append(scroll.render());

    bindScrollLayerVisible(scroll);

    scroll.onWheel = function (step) {
      if (!Lampa.Controller.own(self)) self.start();
      if (Navigator && Navigator.move) Navigator.move(step > 0 ? 'down' : 'up');
    };

    scroll.onEnd = function () {
      if (loading || !hasMore) return;
      loadMore();
    };

    function headTitle() {
      if (folderPath) {
        var parts = folderPath.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : folderPath;
      }
      if (library) return library.Name || Lampa.Lang.translate('jellyfin_mylib');
      if (category === 'Series') return Lampa.Lang.translate('jellyfin_series');
      if (category === 'Resume') return Lampa.Lang.translate('jellyfin_resume');
      if (category === 'Latest') return Lampa.Lang.translate('jellyfin_latest');
      if (category === 'NextUp') return Lampa.Lang.translate('jellyfin_nextup');
      return Lampa.Lang.translate('jellyfin_movies');
    }

    function fetchPage(start) {
      if (parentId) {
        return fetchChildren(parentId, folderPath, start);
      }
      if (libraryId) {
        var lib = library || { Id: libraryId };
        return fetchLibraryItems(lib, start);
      }
      return fetchItems(category, start);
    }

    function cardCtx() {
      var seriesLine = category === 'NextUp' || category === 'Resume';
      return {
        owner: self,
        tapToPlay: tapToPlay,
        playOnEnter: seriesLine,
        seriesDisplay: seriesLine,
        homeMedia: homeMedia,
        musicMedia: musicMedia,
        cardsById: cardsById,
        onTouch: function (el) {
          last = el;
        },
        onFocus: function (el, $card, row) {
          last = el;
          scroll.update($card, false);
          var bg = row.displayPoster || row.poster;
          if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
        },
      };
    }

    function buildGrid(list, append) {
      if (!append) {
        body.empty();
        cardsById = {};
      }
      body.removeClass('jellyfin-catalog--state');

      if (!list.length && !append) {
        renderEmpty();
        return;
      }

      list.forEach(function (row) {
        body.append(makeJellyfinCard(row, cardCtx()));
      });

      scheduleReflowFocus(scroll, self, last, { layerOnly: !!append });
    }

    function renderEmpty(opts) {
      body.empty().addClass('jellyfin-catalog--state');
      opts = opts || {};
      var $box = $('<div class="jellyfin-state"></div>');
      $box.append(
        '<div class="jellyfin-state__title">' +
        $('<div>').text(opts.title || Lampa.Lang.translate('jellyfin_empty')).html() +
        '</div>'
      );
      $box.append(
        '<div class="jellyfin-state__descr">' +
        $('<div>').text(opts.descr || Lampa.Lang.translate('jellyfin_empty_descr')).html() +
        '</div>'
      );
      var $retry = $(
        '<div class="simple-button selector">' + Lampa.Lang.translate('jellyfin_retry') + '</div>'
      );
      $retry.on('hover:enter', reload);
      $retry.on('hover:focus', function () {
        last = this;
        scroll.update($retry, true);
      });
      $box.append($retry);
      body.append($box);
      last = $retry[0];
      scheduleReflowFocus(scroll, self, last, { animate: true });
    }

    function reload() {
      var opts = {
        url: jellyfinNavUrl([
          'jellyfin',
          parentId ? 'folder' : libraryId ? 'library' : 'category',
          parentId || libraryId || jellyfinCategoryKey(category),
        ]),
        title: headTitle(),
        component: PANEL_COMPONENT,
        category: category,
        page: 1,
      };
      if (parentId) {
        opts.parentId = parentId;
        opts.path = folderPath;
        opts.homeMedia = true;
        opts.musicMedia = musicMedia;
      } else if (libraryId) {
        opts.libraryId = libraryId;
        opts.library = library || { Id: libraryId };
        opts.homeMedia = homeMedia;
        opts.musicMedia = musicMedia;
      }
      Lampa.Activity.replace(opts);
    }

    function loadInitial() {
      loading = true;
      self.activity.loader(true);
      fetchPage(0)
        .then(function (result) {
          rows = result.rows;
          startIndex = result.next;
          hasMore = result.hasMore;
          buildGrid(rows, false);
        })
        .catch(function () {
          renderEmpty({
            title: Lampa.Lang.translate('jellyfin_error'),
            descr: Lampa.Lang.translate('jellyfin_settings_hint'),
          });
        })
        .then(function () {
          loading = false;
          self.activity.loader(false);
          self.activity.toggle();
        });
    }

    function loadMore() {
      loading = true;
      fetchPage(startIndex)
        .then(function (result) {
          rows = rows.concat(result.rows);
          startIndex = result.next;
          hasMore = result.hasMore;
          buildGrid(result.rows, true);
        })
        .catch(function () { })
        .then(function () {
          loading = false;
        });
    }

    this.create = function () {
      scroll.minus();
      loadInitial();
      return html;
    };

    this.start = function () {
      self.background();
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          scroll.restorePosition();
          Lampa.Controller.collectionSet(scroll.render(true));
          Lampa.Controller.collectionFocus(last || false, scroll.render(true));
          if (last) scroll.update($(last), false);
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (Navigator.canmove('down')) Navigator.move('down');
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      Lampa.Background.immediately('');
    };
    this.pause = function () { };
    this.stop = function () { };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      Lampa.Listener.remove('jellyfin:row-updated', onRowUpdated);
      cardsById = {};
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function openCategory(category) {
    var title = Lampa.Lang.translate('jellyfin_movies');
    if (category === 'Series') title = Lampa.Lang.translate('jellyfin_series');
    else if (category === 'Resume') title = Lampa.Lang.translate('jellyfin_resume');
    else if (category === 'Latest') title = Lampa.Lang.translate('jellyfin_latest');
    else if (category === 'NextUp') title = Lampa.Lang.translate('jellyfin_nextup');

    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'category', jellyfinCategoryKey(category)]),
      title: title,
      component: PANEL_COMPONENT,
      category: category,
      page: 1,
    });
  }

  function openHub() {
    Lampa.Activity.push({
      url: jellyfinNavUrl(['jellyfin', 'home']),
      title: Lampa.Lang.translate('jellyfin_title'),
      component: HUB_COMPONENT,
      page: 1,
    });
  }

  function listenFullCard() {
      Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite' || !e.object) return;

        var isJellyfinCard = !!(
          e.object.jellyfinRow ||
          e.object.source === 'jellyfin' ||
          (e.object.card && e.object.card.source === 'jellyfin')
        );
        if (isJellyfinCard && e.object.activity && typeof e.object.activity.render === 'function') {
          try {
            e.object.activity.render().find('.full-start-new__reactions, .button--reaction').remove();
          } catch (err) {}
        }

        if (!storageToggle('FullButton', true)) return;

        if (e.object.jellyfinRow) {
          mountJellyfinCardButton(e.object.jellyfinRow);
          return;
        }

      var method = String(e.object.method || '');
      var id = String(e.object.id || '');
      if (!method || !id) return;

      function mountFullCardButton(label, onEnter) {
        var $btn = $(
          '<div class="full-start__button selector button--jellyfin" data-subtitle="Jellyfin">' +
          FULLSTART_BTN_ICON +
          '<span></span></div>'
        );
        $btn.find('span').text(label);
        $btn.on('hover:enter', onEnter);
        return $btn;
      }

      function buildFullCardMenuItems(ready) {
        var items = [];
        if (!usesLampaNativePlayer() && !externalQualityPickerEnabled() && ready.type !== 'Series') {
          var targets = guessExternalQualityTargets(ready);
          if (targets.length >= 2) {
            targets.forEach(function (target) {
              items.push({
                title: qualityMenuLabel(target),
                subtitle: externalPlayerSubtitle(),
                action: 'quality',
                qualityTarget: target,
              });
            });
            return items;
          }
        }
        var label = Lampa.Lang.translate('jellyfin_play_from_library');
        if (ready.playedPct > 0 && ready.playedPct < 100) {
          label += ' (' + Math.round(ready.playedPct) + '%)';
        }
        items.push({ title: label, action: 'play' });
        if (ready.type !== 'Photo') {
          items.push({
            title: Lampa.Lang.translate(ready.watched ? 'jellyfin_mark_unwatched' : 'jellyfin_mark_watched'),
            action: ready.watched ? 'unwatched' : 'watched',
          });
        }
        return items;
      }

      function showFullCardMenu(ready, items) {
        var ctl = enabledControllerName();
        Lampa.Select.show({
          title: Lampa.Lang.translate('jellyfin_title'),
          items: items,
          onBack: function () {
            restoreController(ctl);
          },
          onSelect: function (sel) {
            if (!sel) return;
            if (sel.action === 'play') {
              launchPlayerFromSelect(ctl, function () {
                ensurePlaybackVariants(ready)
                  .then(function (r) {
                    if (r.type === 'Series') {
                      openSeriesEpisodes(r);
                      return;
                    }
                    playMediaRowDirect(r);
                  })
                  .catch(function () {
                    Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
                  });
              });
              return;
            }
            if (sel.action === 'quality') {
              launchPlayerFromSelect(ctl, function () {
                playMediaRowQuality(ready, sel.qualityTarget);
              });
              return;
            }
            if (sel.action === 'watched' || sel.action === 'unwatched') {
              var markWatched = sel.action === 'watched';
              setItemWatched(ready, markWatched)
                .then(function () {
                  notifyRowWatchedChange(ready, markWatched);
                })
                .catch(function () {
                  Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
                });
            }
          },
        });
      }

      function mountButton(row) {
        if (!row || !e.object.activity || typeof e.object.activity.render !== 'function') return;
        var $root = e.object.activity.render();
        if ($root.find('.button--jellyfin').length) return;

        var $container = $root.find('.buttons--container');
        var $buttons = $root.find('.full-start-new__buttons');
        var $anchor = $root.find('.view--torrent').first();

        function prependBtn($btn) {
          if ($container.length) $container.prepend($btn);
          else if ($buttons.length) $buttons.prepend($btn);
          else if ($anchor.length) $anchor.before($btn);
          else $root.find('.full-start__buttons').first().prepend($btn);
        }

        function pinButton($container, $btn) {
          if (!$container || !$container.length) return;
          var $first = $container.children().first();
          if ($first.length && $first[0] !== $btn[0]) $container.prepend($btn);
        }

        function watchButton($container, $btn) {
          if (!$container || !$container.length) return;
          if (typeof MutationObserver === 'undefined') return;
          var observer = new MutationObserver(function () {
            pinButton($container, $btn);
          });
          observer.observe($container[0], { childList: true });
        }

        function renderButtons(ready) {
          if ($root.find('.button--jellyfin').length) return;

          var $btn = mountFullCardButton(Lampa.Lang.translate('jellyfin_title'), function () {
            showFullCardMenu(ready, buildFullCardMenuItems(ready));
          });
          prependBtn($btn);
          if ($container.length) watchButton($container, $btn);
          else if ($buttons.length) watchButton($buttons, $btn);
          else if ($anchor.length) watchButton($anchor, $btn);
          else watchButton($root.find('.full-start__buttons').first(), $btn);
        }

        prepareRowForExternalQuality(row).then(renderButtons).catch(function () { });
      }

      function mountJellyfinCardButton(row) {
        if (!row || !e.object.activity || typeof e.object.activity.render !== 'function') return;
        var $root = e.object.activity.render();
        if ($root.find('.button--jellyfin').length) return;

        var $btn = mountFullCardButton(Lampa.Lang.translate('jellyfin_title'), function () {
          prepareRowForExternalQuality(row)
            .then(function (ready) {
              showFullCardMenu(ready, buildFullCardMenuItems(ready));
            })
            .catch(function () {
              Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
            });
        });

        var $container = $root.find('.buttons--container');
        if (!$container || !$container.length) {
          var $buttons = $root.find('.full-start-new__buttons');
          $container = $('<div class="buttons--container"></div>');
          if ($buttons.length) $buttons.prepend($container);
          else $root.find('.full-start__buttons').first().prepend($container);
        }
        $container.prepend($btn);
      }

      var cached = findLibraryRow(method, id);
      if (cached) {
        mountButton(cached);
        return;
      }

      refreshLibraryIndex(false).then(function () {
        mountButton(findLibraryRow(method, id));
      });
    });
  }

  function injectHeadIcon() {
    var $icon = Lampa.Head.addIcon(HEAD_ICON_SVG);
    $icon.addClass('jellyfin-head-icon selector');
    $icon.on('hover:enter', openHub);
    return $icon;
  }

  function syncHeadButton() {
    var show = storageToggle('HeadButton', true);
    if (show) {
      if (!$headIconEl) $headIconEl = injectHeadIcon();
    } else if ($headIconEl) {
      $headIconEl.remove();
      $headIconEl = null;
    }
  }

  function registerMenuButtons() {
    var $btn = Lampa.Menu.addButton(MANIFEST.icon, Lampa.Lang.translate('jellyfin_title'), openHub);
    return $btn;
  }

  function syncMenuButton() {
    var show = storageToggle('MenuButton', true);
    if (show) {
      if (!$menuBtnEl) $menuBtnEl = registerMenuButtons();
    } else if ($menuBtnEl) {
      $menuBtnEl.remove();
      $menuBtnEl = null;
    }
  }

  function registerStyles() {
    Lampa.Template.add(
      'jellyfin_folder',
      '<div class="bookmarks-folder card selector layer--visible layer--render jellyfin-folder">' +
      '<div class="bookmarks-folder__inner card__view">' +
      '<div class="bookmarks-folder__layer">' +
      '<div class="bookmarks-folder__head">' +
      '<div class="bookmarks-folder__title"></div>' +
      '<div class="bookmarks-folder__num"></div>' +
      '</div>' +
      '<div class="bookmarks-folder__body"></div>' +
      '</div></div></div>'
    );

    Lampa.Template.add(
      'jellyfin_episode',
      '<div class="jellyfin-episode">' +
      '<div class="jellyfin-episode__poster">' +
      '<img class="jellyfin-episode__img" alt="" loading="lazy" decoding="async">' +
      '<div class="jellyfin-episode__num"></div>' +
      '</div>' +
      '<div class="jellyfin-episode__main">' +
      '<div class="jellyfin-episode__name"></div>' +
      '<div class="jellyfin-episode__meta"></div>' +
      '</div>' +
      '<div class="jellyfin-episode__state"></div>' +
      '<div class="jellyfin-episode__progress"><span></span></div>' +
      '</div>'
    );

    Lampa.Template.add(
      'jellyfin_library',
      '<div class="bookmarks-folder card selector layer--visible layer--render jellyfin-library">' +
      '<div class="bookmarks-folder__inner card__view">' +
      '<div class="bookmarks-folder__layer">' +
      '<div class="jellyfin-library__media">' +
      '<img class="jellyfin-library__img" alt="">' +
      '<div class="jellyfin-library__shade"></div>' +
      '<div class="jellyfin-library__badge"></div>' +
      '</div>' +
      '<div class="jellyfin-library__title"></div>' +
      '</div></div></div>'
    );

    Lampa.Template.add(
      'jellyfin_style',
      '<style>' +
      '.jellyfin-hub .items-line--jf-stats{min-height:0!important;padding-bottom:1em}' +
      '.jellyfin-hub .items-line{padding-bottom:1em}' +
      '.jellyfin-hub .items-line--type-cards{min-height:0}' +
      '.jellyfin-hub .items-line--jf-stats .items-line__body{margin-top:0}' +
      '.jellyfin-hub .items-line--jf-stats .register__name{max-width:none}' +
      '.jellyfin-hub .items-line--jf-no-title .items-line__head{display:none}' +
      '.jellyfin-hub .items-line__head{position:relative}' +
      '.jellyfin-hub .items-line__title{padding-right:7em}' +
      '.jellyfin-hub .jellyfin-line-nav{position:absolute;right:1.5em;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:.5em;z-index:5;pointer-events:auto}' +
      '.jellyfin-hub .jellyfin-line-nav__btn{width:2.6em;height:2.6em;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.1);border-radius:50%;cursor:pointer;transition:background .15s,opacity .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none}' +
      '.jellyfin-hub .jellyfin-line-nav__btn svg{width:1.1em;height:1.1em}' +
      '.jellyfin-hub .jellyfin-line-nav__btn.focus{background:rgba(255,255,255,.3)}' +
      '.jellyfin-hub .jellyfin-line-nav__btn--disabled{opacity:.28;pointer-events:none}' +
      '.jellyfin-hub-empty{margin-top:2em}' +
      '.jellyfin-hub .register--line{flex:0 0 auto;position:relative}' +
      '.jellyfin-hub .jellyfin-card--hub-line .card__view{margin-bottom:0}' +
      '.jellyfin-hub .jellyfin-card--hub-line .card__title{' +
      'position:absolute;left:.55em;right:.55em;bottom:1.65em;z-index:3;margin:0;color:#fff;' +
      'font-size:1.05em;max-height:2.4em;-webkit-line-clamp:2;line-clamp:2;' +
      'text-shadow:0 1px 3px rgba(0,0,0,.85)}' +
      '.jellyfin-hub .jellyfin-card--hub-line .card__age{' +
      'position:absolute;left:.55em;bottom:.45em;z-index:3;margin:0;opacity:.9;font-size:.85em}' +
      '.jellyfin-hub .bookmarks-folder{width:11.5em;flex:0 0 auto}' +
      '.jellyfin-hub .bookmarks-folder__layer{background-color:#3e3e3e;border-radius:1em}' +
      '.jellyfin-hub .bookmarks-folder__body{position:relative;overflow:hidden;border-radius:0 0 1em 1em}' +
      '.jellyfin-hub .bookmarks-folder__body .card__img{position:absolute;left:0;width:100%;object-fit:cover;border-radius:.5em}' +
      '.jellyfin-hub .bookmarks-folder__body .i-0{height:100%;top:0;z-index:1}' +
      '.jellyfin-hub .bookmarks-folder__body .i-1{height:80%;top:20%;z-index:2}' +
      '.jellyfin-hub .bookmarks-folder__body .i-2{height:60%;top:40%;z-index:3}' +
      '.jellyfin-hub .bookmarks-folder__head{padding:.85em 1em;line-height:1.25}' +
      '.jellyfin-hub .bookmarks-folder__title{font-weight:300;font-size:1.1em}' +
      '.jellyfin-hub .bookmarks-folder__num{font-weight:700;font-size:1.15em;margin-top:.15em}' +
      '.jellyfin-hub .card.jellyfin-card .card__title{line-height:1.25;max-height:2.5em;overflow:hidden}' +
      '.jellyfin-card.card,.jellyfin-module .jellyfin-card.card{position:relative}' +
      '.jellyfin-card .card__view{overflow:hidden;position:relative;border-radius:.5em}' +
      '.jellyfin-card .card__img{border-radius:inherit}' +
      '.jellyfin-hub .bookmarks-folder.card{position:relative}' +
      '.jellyfin-hub .bookmarks-folder .card__view{overflow:hidden;position:relative;border-radius:1em}' +
      '.jellyfin-hub .card.jellyfin-card.focus::after,' +
      '.jellyfin-module .card.jellyfin-card.focus::after,' +
      '.jellyfin-hub .items-cards .card.jellyfin-card.selector.focus::after,' +
      '.jellyfin-module .items-cards .card.jellyfin-card.selector.focus::after,' +
      '.jellyfin-hub .card.jellyfin-card.focus .card__view::after,' +
      '.jellyfin-module .card.jellyfin-card.focus .card__view::after,' +
      '.jellyfin-hub .bookmarks-folder.focus::after,' +
      '.jellyfin-hub .bookmarks-folder.focus .card__view::after{' +
      'display:none!important;content:none!important}' +
      '.jellyfin-hub .card.jellyfin-card.focus .card__view,' +
      '.jellyfin-module .card.jellyfin-card.focus .card__view{' +
      'box-shadow:0 0 0 .22em #fff;border-radius:.5em}' +
      '.jellyfin-hub .register.selector.focus::after{' +
      'content:"";position:absolute;display:block;pointer-events:none;z-index:-1;' +
      'top:-.5em;left:-.5em;right:-.5em;bottom:-.5em;border:.3em solid #fff;border-radius:1.4em;box-shadow:none}' +
      '.jellyfin-hub .bookmarks-folder.focus .card__view{' +
      'box-shadow:0 0 0 .22em #fff;border-radius:1em}' +
      '.jellyfin-hub .jellyfin-more-card .card__view,' +
      '.jellyfin-module .jellyfin-more-card .card__view{' +
      'position:relative;overflow:hidden;background:#3e3e3e;' +
      'transition:background .15s,box-shadow .15s}' +
      '.jellyfin-hub .jellyfin-more-card .card__img,' +
      '.jellyfin-module .jellyfin-more-card .card__img{' +
      'opacity:0}' +
      '.jellyfin-hub .jellyfin-more-card__label,' +
      '.jellyfin-module .jellyfin-more-card__label{' +
      'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);' +
      'text-align:center;line-height:1.3;' +
      'color:rgba(255,255,255,.88);font-size:1.05em;font-weight:800;' +
      'letter-spacing:.16em;text-transform:uppercase;' +
      'text-shadow:0 2px 6px rgba(0,0,0,.4)}' +
      '.jellyfin-hub .jellyfin-more-card.focus .card__view,' +
      '.jellyfin-module .jellyfin-more-card.focus .card__view{' +
      'background:#4d4d4d;' +
      'box-shadow:0 0 0 .22em #fff,0 6px 20px rgba(0,0,0,.35)}' +
      '.jellyfin-card-shade{pointer-events:none;position:absolute;left:0;right:0;bottom:0;height:42%;z-index:2;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)}' +
      '.jellyfin-card-chrome{pointer-events:none;position:absolute;left:0;top:0;right:0;bottom:0;z-index:4}' +
      '.jellyfin-badge{position:absolute;padding:.28em .55em;font-size:.62em;border-radius:.7em;font-weight:800;line-height:1.1;backdrop-filter:blur(8px);box-shadow:0 3px 8px rgba(0,0,0,.25)}' +
      '.jellyfin-badge-episode{right:.4em;top:.4em;background:rgba(0,0,0,.72);color:#fff}' +
      '.jellyfin-badge-quality{left:.4em;top:.4em;background:rgba(0,122,255,.92);color:#fff}' +
      '.jellyfin-badge-watched{right:.4em;top:.4em;background:rgba(52,199,89,.92);color:#fff}' +
      '.jellyfin-badge-watched--episode{top:2.1em}' +
      '.jellyfin-card-progress{position:absolute;left:0;right:0;bottom:0;height:.28em;background:rgba(255,255,255,.18);z-index:5}' +
      '.jellyfin-card-progress>span{display:block;height:100%;background:rgba(0,122,255,.95)}' +
      '.jellyfin-state{padding:2em 1.2em;text-align:center;max-width:36em;margin:0 auto}' +
      '.jellyfin-state__title{font-size:1.1em;font-weight:700;margin-bottom:.6em}' +
      '.jellyfin-state__descr{opacity:.75;margin-bottom:1.2em;line-height:1.45}' +
      '.jellyfin-episodes__filter{position:relative;max-width:72em;margin:0 auto;padding:.6em 1em 0}' +
      '.jellyfin-season-chip{display:inline-flex;align-items:center;gap:.6em;flex-direction:row}' +
      '.jellyfin-season-chip > div{opacity:.7;font-size:.95em}' +
      '.jellyfin-episodes-list__rows{max-width:72em;margin:0 auto;padding:.3em 1em 2em}' +
      '.jellyfin-episode{position:relative;display:flex;align-items:center;gap:1.1em;padding:.7em .9em .85em;margin-bottom:.4em;border-radius:.8em;background:rgba(255,255,255,.05);cursor:pointer;overflow:hidden}' +
      '.jellyfin-episode.focus{background:rgba(255,255,255,.16);box-shadow:0 0 0 .18em #fff}' +
      '.jellyfin-episode__poster{position:relative;flex:0 0 auto;width:16em;height:9em;border-radius:.55em;overflow:hidden;background:rgba(0,0,0,.35)}' +
      '.jellyfin-episode__img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.jellyfin-episode__num{position:absolute;left:.5em;top:.5em;padding:.25em .65em;font-size:.72em;font-weight:800;line-height:1;border-radius:.5em;background:rgba(0,0,0,.68);color:#fff;z-index:2}' +
      '.jellyfin-episode__main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:.4em}' +
      '.jellyfin-episode__name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-size:1.02em;font-weight:600}' +
      '.jellyfin-episode__meta{font-size:.83em;color:rgba(255,255,255,.55)}' +
      '.jellyfin-episode__state{flex:0 0 auto;font-size:.85em;color:rgba(255,255,255,.55)}' +
      '.jellyfin-episode__state--watched{color:rgba(52,199,89,.95)}' +
      '.jellyfin-episode__progress{position:absolute;left:0;right:0;bottom:0;height:.26em;background:rgba(255,255,255,.14)}' +
      '.jellyfin-episode__progress > span{display:block;height:100%;background:rgba(0,122,255,.95)}' +
      '.jellyfin-episode--watched .jellyfin-episode__progress > span{background:rgba(52,199,89,.95)}' +
      '.jellyfin-player-playlist{display:flex;flex-direction:column}' +
      '.jellyfin-episodes-list__rows .jellyfin-episode,.jellyfin-player-playlist .jellyfin-episode{align-items:stretch}' +
      '.jellyfin-episodes-list__rows .jellyfin-episode__main,.jellyfin-player-playlist .jellyfin-episode__main{justify-content:flex-start}' +
      '.jellyfin-episodes-list__rows .jellyfin-episode__meta,.jellyfin-player-playlist .jellyfin-episode__meta{margin-top:auto}' +
      '.jellyfin-player-playlist .jellyfin-episodes-list__rows{max-width:62em;width:100%;margin:0;padding:.6em 1em 2em}' +
      '@media (min-width:481px){' +
      'body .jellyfin-playlist-modal{display:flex;justify-content:flex-end;padding:.7em 0 .7em 1em}' +
      'body .jellyfin-playlist-modal .modal__content{max-width:58em;width:100%;margin:0!important;display:flex;flex-direction:column}' +
      'body .jellyfin-playlist-modal .modal__body{flex:1 1 auto;min-height:0}' +
      'body .jellyfin-playlist-modal .modal__head{margin-bottom:1.2em}' +
      '}' +
      '@media (max-width:480px){' +
      '.jellyfin-player-playlist .jellyfin-episode__poster{width:7.5em;height:4.3em}' +
      '.jellyfin-player-playlist .jellyfin-episode{gap:.6em;padding:.5em .6em .6em}' +
      '.jellyfin-episode__ring{width:2.6em;height:2.6em}' +
      '.jellyfin-episode__ring-val{font-size:.8em}' +
      '}' +
      '.jellyfin-episode--current .jellyfin-episode__state{cursor:default}' +
      '.jellyfin-episode--current .jellyfin-episode__state:active{transform:none}' +
      '.jellyfin-episode--current{background:rgba(0,122,255,.22)}' +
      '.jellyfin-episode--current::before{content:"";position:absolute;left:0;top:0;bottom:0;width:.32em;background:rgba(0,122,255,.95);z-index:3}' +
      '.jellyfin-episode--current .jellyfin-episode__num{background:rgba(0,122,255,.95)}' +
      '.jellyfin-episode--current.focus{background:rgba(0,122,255,.32)}' +
      '.jellyfin-episode__descr{font-size:.83em;color:rgba(255,255,255,.45);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.jellyfin-episode__descr.hide,.jellyfin-episode__descr:empty{display:none}' +
      '.jellyfin-episode__state{flex:0 0 auto;display:flex;align-items:center;padding:.1em;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s}' +
      '.jellyfin-episode__state:active{transform:scale(.9)}' +
      '.jellyfin-episode__ring{position:relative;display:block;width:5.2em;height:5.2em;pointer-events:none}' +
      '.jellyfin-episode__ring svg{display:block;width:100%;height:100%}' +
      '.jellyfin-episode__ring-val{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:1.5em;font-weight:700;line-height:1;color:rgba(255,255,255,.85);pointer-events:none}' +
      '.jellyfin-episode.jellyfin-ring-focus .jellyfin-episode__ring{border-radius:50%;box-shadow:0 0 0 .18em #fff}' +
      '.button--jellyfin{display:inline-flex;align-items:center;gap:.35em;order:-1}' +
      '.button--jellyfin .jellyfin-fullstart__icon{display:block;width:1.75em;height:1.75em;flex-shrink:0}' +
      '.torrent-dso-qbittorrent-icon.jellyfin-head-icon,.jellyfin-head-icon{display:flex;align-items:center;justify-content:center}' +
      '.jellyfin-head-icon svg{width:1.35em;height:1.35em}' +
      '.jellyfin-hub .jellyfin-library{width:16em;flex:0 0 auto;position:relative}' +
      '.jellyfin-hub .jellyfin-library .card__view{overflow:hidden;position:relative;border-radius:0;padding-bottom:75%}' +
      '.jellyfin-hub .jellyfin-library__layer{background-color:#3e3e3e;border-radius:1em;overflow:hidden;position:relative}' +
      '.jellyfin-hub .jellyfin-library__media{position:relative;height:9em;overflow:hidden}' +
      '.jellyfin-hub .jellyfin-library .bookmarks-folder__layer{border-radius:0;background-color:transparent}' +
      '.jellyfin-hub .jellyfin-library__img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.jellyfin-hub .jellyfin-library__shade{position:absolute;left:0;right:0;bottom:0;height:55%;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.65) 100%)}' +
      '.jellyfin-hub .jellyfin-library__badge{position:absolute;left:.6em;top:.6em;z-index:2;padding:.2em .6em;font-size:.62em;border-radius:.7em;font-weight:800;background:rgba(0,0,0,.6);color:#fff;backdrop-filter:blur(6px)}' +
      '.jellyfin-hub .jellyfin-library__title{padding:.75em .9em .85em;font-weight:600;font-size:1.05em;line-height:1.25;white-space:normal}' +
      '.jellyfin-hub .jellyfin-library.focus .card__view{box-shadow:0 0 0 .22em #fff;border-radius:0}' +
      '.jellyfin-hub .jellyfin-library.focus::after,' +
      '.jellyfin-hub .jellyfin-library.focus .card__view::after{display:none!important;content:none!important}' +
      '.jellyfin-photo{position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999}' +
      '.jellyfin-photo__counter{margin-top:.5em;color:rgba(255,255,255,.7);font-size:.9em;text-shadow:0 1px 3px rgba(0,0,0,.85);pointer-events:none;line-height:1}' +
      '.jellyfin-photo__bar{display:flex;align-items:center;justify-content:space-between;width:100%;gap:1.6em}' +
      '.jellyfin-photo__side{flex:1 1 0;min-width:0}' +
      '.jellyfin-photo__side--right{display:flex;justify-content:flex-end;gap:1.6em}' +
      '.jellyfin-photo__img{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:94%;max-height:calc(100% - 7em);object-fit:contain;display:block}' +
      '.jellyfin-photo__controls{position:absolute;bottom:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:1em;padding:.8em .6em 1.2em;background:linear-gradient(transparent,rgba(0,0,0,.55))}' +
      '.jellyfin-photo__row{display:flex;align-items:center;justify-content:center;gap:1.6em}' +
      '.jellyfin-photo__btn{width:3.6em;height:3.6em;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.15);border-radius:50%;cursor:pointer;transition:background .15s,transform .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex:0 0 auto}' +
      '.jellyfin-photo__btn:hover{background:rgba(255,255,255,.3)}' +
      '.jellyfin-photo__btn svg{width:1.8em;height:1.8em}' +
      '.jellyfin-photo__btn--sm{width:3em;height:3em}' +
      '.jellyfin-photo__btn--sm svg{width:1.5em;height:1.5em}' +
      '.jellyfin-photo__btn--top{width:3em;height:3em;background:rgba(255,255,255,.12)}' +
      '.jellyfin-photo__btn--top svg{width:1.5em;height:1.5em}' +
      '.jellyfin-photo__btn--reset{font-size:.85em;font-weight:700;width:auto;min-width:2.8em;padding:0 .4em}' +
      '.jellyfin-photo__btn--play{width:4.2em;height:4.2em;background:rgba(255,255,255,.2)}' +
      '.jellyfin-photo__btn--play:hover{background:rgba(255,255,255,.35)}' +
      '.jellyfin-photo__btn--play svg{width:2em;height:2em}' +
      '.jellyfin-photo__btn--active{background:rgba(105,240,174,.35) !important}' +
      '.jellyfin-photo__btn.focus,.jellyfin-photo__btn:focus{box-shadow:0 0 0 .24em #fff}' +
      '.jellyfin-photo--full .jellyfin-photo__img{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}' +
      '.jellyfin-photo--full .jellyfin-photo__controls{padding:.5em .6em .8em}' +
      '.jellyfin-photo--android .jellyfin-photo__controls{gap:.23em;padding:.2em .17em .35em}' +
      '.jellyfin-photo--android .jellyfin-photo__bar{gap:.53em}' +
      '.jellyfin-photo--android .jellyfin-photo__row{gap:.3em}' +
      '.jellyfin-photo--android .jellyfin-photo__side--right{gap:.3em}' +
      '.jellyfin-photo--android .jellyfin-photo__btn{width:3.1em;height:3.1em}' +
      '.jellyfin-photo--android .jellyfin-photo__btn svg{width:1.5em;height:1.5em}' +
      '.jellyfin-photo--android .jellyfin-photo__btn--play{width:3.6em;height:3.6em}' +
      '.jellyfin-photo--android .jellyfin-photo__btn--play svg{width:1.8em;height:1.8em}' +
      '.jellyfin-photo--tv .jellyfin-photo__counter{font-size:1.1em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn{width:4.2em;height:4.2em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn svg{width:2.1em;height:2.1em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--sm{width:3.6em;height:3.6em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--sm svg{width:1.8em;height:1.8em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--top{width:3.6em;height:3.6em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--top svg{width:1.8em;height:1.8em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--play{width:5em;height:5em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--play svg{width:2.4em;height:2.4em}' +
      '.jellyfin-photo--tv .jellyfin-photo__btn--reset{font-size:1em;min-width:3.4em}' +
      '.jellyfin-photo--tv .jellyfin-photo__controls{gap:1.2em;padding:1em .8em 1.4em}' +
      '.jellyfin-photo--tv .jellyfin-photo__row{gap:2em}' +
      '.jellyfin-photo--tv .jellyfin-photo__side--right{gap:2em}' +
      '.jellyfin-photo__zoomwrap{position:relative}' +
      '.jellyfin-photo__zdrop{display:none;position:absolute;left:50%;bottom:calc(100% + .4em);transform:translateX(-50%);flex-direction:column;align-items:center;gap:.5em;padding:.45em .5em;border-radius:.7em;background:rgba(0,0,0,.8);backdrop-filter:blur(1em);z-index:5}' +
      '.jellyfin-photo__zdrop--open{display:flex}' +
      '.jellyfin-photo__zbtn{width:2.8em;height:2.8em;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.16);border-radius:50%;cursor:pointer;transition:background .15s,transform .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex:0 0 auto}' +
      '.jellyfin-photo__zbtn:hover{background:rgba(255,255,255,.32)}' +
      '.jellyfin-photo__zbtn svg{width:1.4em;height:1.4em}' +
      '.jellyfin-photo__zbtn--one{font-size:.8em;font-weight:700;width:auto;min-width:2.8em;padding:0 .5em;border-radius:.6em}' +
      '.jellyfin-photo__zslider{position:relative;width:1.1em;height:8em;cursor:pointer;touch-action:none}' +
      '.jellyfin-photo__zslider::before{content:"";position:absolute;left:50%;top:0;bottom:0;transform:translateX(-50%);width:.5em;background:rgba(255,255,255,.25);border-radius:.25em}' +
      '.jellyfin-photo__zfill{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:.5em;height:0;background:rgba(255,255,255,.85);border-radius:.25em;pointer-events:none}' +
      '.jellyfin-photo__zthumb{position:absolute;left:50%;bottom:0;transform:translate(-50%,50%);width:1.1em;height:1.1em;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.5);pointer-events:none;z-index:3}' +
      '.jellyfin-photo__zrange{-webkit-appearance:none;appearance:none;opacity:0;pointer-events:none;width:.5em;height:8em;margin:0;position:relative;z-index:2}' +
      '.jellyfin-photo__zbtn.focus,.jellyfin-photo__zbtn:focus{box-shadow:0 0 0 .24em #fff}' +
      '.jellyfin-photo--android .jellyfin-photo__zdrop{gap:.13em}' +
      '.jellyfin-photo--android .jellyfin-photo__zslider,.jellyfin-photo--android .jellyfin-photo__zrange{height:7em}' +
      '.jellyfin-photo--tv .jellyfin-photo__zdrop{gap:.6em}' +
      '.jellyfin-photo--tv .jellyfin-photo__zbtn{width:3.2em;height:3.2em}' +
      '.jellyfin-photo--tv .jellyfin-photo__zbtn svg{width:1.6em;height:1.6em}' +
      '.jellyfin-photo--tv .jellyfin-photo__zbtn--one{min-width:3.2em}' +
      '.jellyfin-photo--tv .jellyfin-photo__zslider,.jellyfin-photo--tv .jellyfin-photo__zrange{height:9em}' +
      '.jellyfin-photo--tizen .jellyfin-photo__zdrop{width:3.4em;padding:.55em .7em;margin-bottom:.6em;box-sizing:border-box;border:.12em solid rgba(255,255,255,.35);border-radius:.7em;background:rgba(20,20,25,.95);box-shadow:0 .4em 1.2em rgba(0,0,0,.55);backdrop-filter:none}' +
      '.jellyfin-photo--tizen .jellyfin-photo__zbtn,.jellyfin-photo--tizen .jellyfin-photo__zbtn--one,.jellyfin-photo--tizen .jellyfin-photo__zslider{margin:.18em 0}' +
      '.jellyfin-photo--noflexgap .jellyfin-photo__zdrop{gap:0}' +
      '.jellyfin-photo--noflexgap .jellyfin-photo__zbtn,.jellyfin-photo--noflexgap .jellyfin-photo__zbtn--one,.jellyfin-photo--noflexgap .jellyfin-photo__zslider{margin:.18em 0}' +
      'body.jellyfin-photo-fs .head,body.jellyfin-photo-fs .player-panel,body.jellyfin-photo-fs .navigation-bar,body.jellyfin-photo-fs .player-info{display:none!important}' +
      'body.jellyfin-photo-fs .jellyfin-photo{z-index:2147483000}' +
      '.jellyfin-audio{position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:50;overflow:hidden;-webkit-user-select:none;user-select:none}' +
      '.jellyfin-audio__bg{position:absolute;top:0;left:0;width:100%;height:100%;background-size:cover;background-position:center;filter:blur(28px) brightness(.45) saturate(1.2);transform:scale(1.2);pointer-events:none}' +
      '.jellyfin-audio__top{position:absolute;top:0;left:0;right:0;z-index:6;display:flex;align-items:center;gap:1.1em;padding:calc(env(safe-area-inset-top,0px) + 1.1em) 1.3em 1.5em;background:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0))}' +
      '.jellyfin-audio__info{min-width:0;display:flex;flex-direction:column;padding-top:.2em}' +
      '.jellyfin-audio__album{font-size:.9em;line-height:1.35;color:rgba(255,255,255,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,.6)}' +
      '.jellyfin-audio__title{font-size:1.45em;font-weight:700;line-height:1.3;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 4px rgba(0,0,0,.7)}' +
      '.jellyfin-audio__meta{margin-top:.35em;font-size:.85em;line-height:1.3;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.6)}' +
      '.jellyfin-audio__panel{position:absolute;left:0;right:0;bottom:0;z-index:6;padding:1.5em 1.5em calc(env(safe-area-inset-bottom,0px) + 1.4em);background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.88))}' +
      '.jellyfin-audio__panel-inner{display:flex;align-items:center;gap:1.6em;max-width:96em;margin:0 auto}' +
      '.jellyfin-audio__art{flex:0 0 auto;width:5em;height:5em;border-radius:.8em;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.55);background:rgba(255,255,255,.06)}' +
      '.jellyfin-audio__art img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.jellyfin-audio__side{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:.75em}' +
      '.jellyfin-audio__progress{display:flex;align-items:center;gap:1em}' +
      '.jellyfin-audio__cur,.jellyfin-audio__dur{flex:0 0 auto;min-width:3.4em;font-size:.85em;color:rgba(255,255,255,.75)}' +
      '.jellyfin-audio__dur{text-align:right}' +
      '.jellyfin-audio__bar{position:relative;flex:1 1 auto;height:1.5em;cursor:pointer}' +
      '.jellyfin-audio__bar::before{content:"";position:absolute;left:0;right:0;top:50%;height:.32em;background:rgba(255,255,255,.25);border-radius:.25em;transform:translateY(-50%)}' +
      '.jellyfin-audio__bar-fill{position:absolute;left:0;top:50%;height:.32em;width:0;background:#fff;border-radius:.25em;transform:translateY(-50%)}' +
      '.jellyfin-audio__dot{position:absolute;top:50%;width:.8em;height:.8em;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.5);transform:translateY(-50%)}' +
      '.jellyfin-audio__controls{display:flex;align-items:center;justify-content:space-between;gap:1.2em;flex-wrap:wrap}' +
      '.jellyfin-audio__controls-group{display:flex;align-items:center;gap:.85em;min-width:0;flex:1 1 0}' +
      '.jellyfin-audio__controls-left{justify-content:flex-start}' +
      '.jellyfin-audio__controls-center{justify-content:center}' +
      '.jellyfin-audio__controls-right{justify-content:flex-end}' +
      '.jellyfin-audio__volume{position:relative;display:flex;align-items:center}' +
      '.jellyfin-audio__btn{width:2.9em;height:2.9em;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(255,255,255,.16);border-radius:50%;cursor:pointer;transition:background .15s,transform .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex:0 0 auto}' +
      '.jellyfin-audio__btn:hover{background:rgba(255,255,255,.32)}' +
      '.jellyfin-audio__btn svg{width:1.4em;height:1.4em}' +
      '.jellyfin-audio__btn--back{width:3em;height:3em;background:rgba(0,0,0,.45)}' +
      '.jellyfin-audio__btn--back svg{width:1.6em;height:1.6em}' +
      '.jellyfin-audio__btn--play{width:4.1em;height:4.1em;background:#fff;color:#111}' +
      '.jellyfin-audio__btn--play:hover{background:#eee}' +
      '.jellyfin-audio__btn--play svg{width:2em;height:2em}' +
      '.jellyfin-audio__btn--prev svg,.jellyfin-audio__btn--next svg{width:1.7em;height:1.7em}' +
      '.jellyfin-audio__btn--sm{width:2.6em;height:2.6em}' +
      '.jellyfin-audio__btn--sm svg{width:1.25em;height:1.25em}' +
      '.jellyfin-audio__btn--pl{background:rgba(0,122,255,.35)}' +
      '.jellyfin-audio__btn--pl:hover{background:rgba(0,122,255,.5)}' +
      '.jellyfin-audio__btn--settings{background:rgba(255,255,255,.24)}' +
      '.jellyfin-audio__btn--settings:hover{background:rgba(255,255,255,.4)}' +
      '.jellyfin-audio__btn.active,.jellyfin-audio__btn--active{background:rgba(105,240,174,.4) !important}' +
      '.jellyfin-audio__btn--play.jellyfin-audio__btn--active{background:#fff !important;color:#111}' +
      '.jellyfin-audio__btn--muted{background:rgba(255,80,80,.45)}' +
      '.jellyfin-audio__btn.focus,.jellyfin-audio__btn:focus{box-shadow:0 0 0 .24em #fff}' +
      '.jellyfin-audio__btn--mute{position:relative}' +
      '.jellyfin-audio__vdrop{display:none;position:absolute;left:50%;bottom:100%;transform:translateX(-50%);padding:.4em;border-radius:.5em;background:rgba(0,0,0,.75);backdrop-filter:blur(1em)}' +
      '.jellyfin-audio__btn--mute:hover .jellyfin-audio__vdrop,.jellyfin-audio__btn--mute.focus .jellyfin-audio__vdrop{display:block}' +
      '.jellyfin-audio__vrange{-webkit-appearance:slider-vertical;appearance:slider-vertical;width:.5em;height:8em;margin:0;cursor:pointer;background:transparent;z-index:2;position:relative}' +
      '.jellyfin-audio__vfill{position:absolute;left:50%;bottom:.4em;transform:translateX(-50%);width:.5em;height:0;background:rgba(255,255,255,.85);border-radius:.25em;pointer-events:none}' +
      '.jellyfin-audio--tv .jellyfin-audio__top{padding-top:calc(env(safe-area-inset-top,0px) + 1.5em)}' +
      '.jellyfin-audio--tv .jellyfin-audio__album{font-size:1em}' +
      '.jellyfin-audio--tv .jellyfin-audio__title{font-size:1.8em}' +
      '.jellyfin-audio--tv .jellyfin-audio__meta{font-size:1em}' +
      '.jellyfin-audio--tv .jellyfin-audio__panel{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 2em)}' +
      '.jellyfin-audio--tv .jellyfin-audio__panel-inner{gap:2em}' +
      '.jellyfin-audio--tv .jellyfin-audio__art{width:6em;height:6em}' +
      '.jellyfin-audio--tv .jellyfin-audio__controls{gap:1em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn{width:3.4em;height:3.4em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn svg{width:1.7em;height:1.7em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn--play{width:4.8em;height:4.8em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn--play svg{width:2.3em;height:2.3em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn--prev svg,.jellyfin-audio--tv .jellyfin-audio__btn--next svg{width:2em;height:2em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn--sm{width:3em;height:3em}' +
      '.jellyfin-audio--tv .jellyfin-audio__btn--sm svg{width:1.45em;height:1.45em}' +
      '.jellyfin-audio--tv .jellyfin-audio__vrange{height:9em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__top{padding:1.5em 1.3em 1.5em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__panel{padding:1.5em 1.5em 2em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__title{font-size:2em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__album{font-size:1.05em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__meta{font-size:1.1em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__art{width:6.6em;height:6.6em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn{width:3.8em;height:3.8em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn svg{width:1.9em;height:1.9em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--play{width:5.4em;height:5.4em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--play svg{width:2.6em;height:2.6em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--prev svg,.jellyfin-audio--tizen .jellyfin-audio__btn--next svg{width:2.2em;height:2.2em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--sm{width:3.4em;height:3.4em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--sm svg{width:1.7em;height:1.7em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--back{width:3.4em;height:3.4em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn--back svg{width:1.8em;height:1.8em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__vrange{-webkit-appearance:none;appearance:none;opacity:0;pointer-events:none}' +
      '.jellyfin-audio--tizen .jellyfin-audio__vfill{width:.55em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__bg{filter:brightness(.4) saturate(1.1);transform:scale(1.05)}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn,.jellyfin-audio--tizen .jellyfin-audio__btn--play{transition:none}' +
      '.jellyfin-audio--tizen .jellyfin-audio__btn.focus,.jellyfin-audio--tizen .jellyfin-audio__btn:focus{box-shadow:0 0 0 .3em #fff,0 0 0 .62em rgba(255,255,255,.45)}' +
      '.jellyfin-audio--tizen .jellyfin-audio__panel{padding:1.6em 2em calc(env(safe-area-inset-bottom,0px) + 1.8em)}' +
      '.jellyfin-audio--tizen .jellyfin-audio__panel-inner{max-width:110em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__side{justify-content:flex-end;gap:1.6em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__progress{width:100%;gap:1.2em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__cur,.jellyfin-audio--tizen .jellyfin-audio__dur{font-size:1em;min-width:4.2em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__bar{height:2.2em;flex:1 1 100%}' +
      '.jellyfin-audio--tizen .jellyfin-audio__bar::before,.jellyfin-audio--tizen .jellyfin-audio__bar-fill{height:.5em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__dot{width:1.1em;height:1.1em}' +
      '.jellyfin-audio--tizen .jellyfin-audio__bar.focus::before{background:rgba(255,255,255,.55)}' +
      '.jellyfin-audio--tizen .jellyfin-audio__bar.focus .jellyfin-audio__dot{box-shadow:0 0 0 .28em #fff}' +
      '.jellyfin-audio--tizen .jellyfin-audio__vdrop{width:3.4em;height:10.34em;padding:.55em .7em;margin-bottom:.6em;box-sizing:border-box;border:.12em solid rgba(255,255,255,.35);border-radius:.7em;background:rgba(20,20,25,.95);box-shadow:0 .4em 1.2em rgba(0,0,0,.55);backdrop-filter:none}' +
      '.jellyfin-audio--tizen .jellyfin-audio__vrange{display:block;margin:0 auto}' +
      '.jellyfin-audio--tizen .jellyfin-audio__vfill{bottom:.67em;width:.6em;border-radius:.3em}' +
      '.jellyfin-audio--volbar .jellyfin-audio__vdrop{width:3.4em;height:9.34em;padding:.55em .7em;margin-bottom:.7em;box-sizing:border-box;border:.12em solid rgba(255,255,255,.35);border-radius:.7em;background:rgba(20,20,25,.95);box-shadow:0 .4em 1.2em rgba(0,0,0,.55);backdrop-filter:none;cursor:pointer}' +
      '.jellyfin-audio--volbar .jellyfin-audio__vdrop:hover,.jellyfin-audio--volbar .jellyfin-audio__btn--mute:hover .jellyfin-audio__vdrop{display:block}' +
      '.jellyfin-audio--volbar .jellyfin-audio__btn--mute::after{content:"";position:absolute;left:50%;bottom:100%;transform:translateX(-50%);width:4.6em;height:.7em}' +
      '.jellyfin-audio--volbar .jellyfin-audio__vrange{-webkit-appearance:none;appearance:none;opacity:0;pointer-events:none}' +
      '.jellyfin-audio--volbar .jellyfin-audio__vfill{bottom:.67em;width:.6em;border-radius:.3em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__top .jellyfin-audio__art,.jellyfin-audio--noflexgap .jellyfin-audio__top .jellyfin-audio__info{margin-left:1.1em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__side .jellyfin-audio__controls{margin-top:.75em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__progress .jellyfin-audio__bar{margin:0 .5em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__controls-center{margin-left:.5em;margin-right:.5em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__controls-group .jellyfin-audio__btn,.jellyfin-audio--noflexgap .jellyfin-audio__controls-group .jellyfin-audio__volume{margin-right:.85em}' +
      '.jellyfin-audio--noflexgap .jellyfin-audio__controls-group .jellyfin-audio__btn:last-child,.jellyfin-audio--noflexgap .jellyfin-audio__controls-group .jellyfin-audio__volume:last-child{margin-right:0}' +
      '.jellyfin-audio--android .jellyfin-audio__top{padding-top:calc(env(safe-area-inset-top,0px) + .9em)}' +
      '.jellyfin-audio--android .jellyfin-audio__title{font-size:1.2em}' +
      '.jellyfin-audio--android .jellyfin-audio__panel{padding:1.2em 1em calc(env(safe-area-inset-bottom,0px) + 1em)}' +
      '.jellyfin-audio--android .jellyfin-audio__panel-inner{flex-wrap:wrap;gap:1em}' +
      '.jellyfin-audio--android .jellyfin-audio__art{width:4.5em;height:4.5em}' +
      '.jellyfin-audio--android .jellyfin-audio__controls{gap:.7em}' +
      '.jellyfin-audio--android .jellyfin-audio__vrange{height:7em}' +
      '@media (max-width:640px){.jellyfin-audio__panel-inner{flex-wrap:wrap;gap:1em}.jellyfin-audio__art{width:4.5em;height:4.5em}.jellyfin-audio__side{flex:1 1 100%}.jellyfin-audio__controls{justify-content:center;gap:.9em}.jellyfin-audio__controls-center{flex:1 1 100%;order:-1;justify-content:center}.jellyfin-audio__controls-left{justify-content:center}.jellyfin-audio__controls-right{justify-content:center}.jellyfin-audio__vrange{height:7em}.jellyfin-audio__album,.jellyfin-audio__title,.jellyfin-audio__meta{white-space:normal}.jellyfin-audio--android .jellyfin-audio__controls{justify-content:space-between}.jellyfin-audio--android .jellyfin-audio__controls-left{justify-content:flex-start}.jellyfin-audio--android .jellyfin-audio__controls-right{justify-content:flex-end}}' +
      'body.jellyfin-audio-fs .head,body.jellyfin-audio-fs .player-panel,body.jellyfin-audio-fs .navigation-bar,body.jellyfin-audio-fs .player-info{display:none!important}' +
      '.jellyfin-detail{padding:0 0 1em}' +
      '.jellyfin-detail .full-descr{padding-top:1.2em}' +
      '.jellyfin-detail__title{padding:2em 1.4em;font-size:1.5em;font-weight:700;text-align:center}' +
      '.jellyfin-detail__section{padding:1em 1.4em .4em;font-weight:700;font-size:1.1em}' +
      '.jellyfin-detail__grid{margin:.5em 1.4em 1.5em}' +
      'body.jellyfin-movie-playing .player-panel__prev,body.jellyfin-movie-playing .player-panel__next{display:none!important}' +
      'body.jellyfin-playing .player-panel__pip{display:none!important}' +
      'body.jellyfin-episode-prev-disabled .player-panel__prev,body.jellyfin-episode-next-disabled .player-panel__next{opacity:.3;pointer-events:none}' +
      '</style>'
    );
  }

  function addSettings() {
    Lampa.SettingsApi.addComponent({
      component: SETTINGS_COMPONENT,
      name: Lampa.Lang.translate('jellyfin_settings_name'),
      icon: MANIFEST.icon,
    });

    addApiSettings();
    addDisplaySettings();
    addCategoriesSettings();
    addHlsSettings();
  }

  function addHlsSettings() {
    function registerHlsParams(component) {
      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'Transcode' },
        field: { name: Lampa.Lang.translate('jellyfin_set_transcode') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { name: STORAGE_PREFIX + 'StreamHint', type: 'static' },
        field: { name: Lampa.Lang.translate('jellyfin_set_stream_hint') },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: {
          name: STORAGE_PREFIX + 'TranscodeFormat',
          type: 'select',
          values: {
            auto: Lampa.Lang.translate('jellyfin_format_auto'),
            'hls-ts': Lampa.Lang.translate('jellyfin_format_hls_ts'),
            'hls-fmp4': Lampa.Lang.translate('jellyfin_format_hls_fmp4'),
            webm: Lampa.Lang.translate('jellyfin_format_webm'),
          },
          default: 'auto',
        },
        field: { name: Lampa.Lang.translate('jellyfin_set_format') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: {
          name: STORAGE_PREFIX + 'MaxAudioChannels',
          type: 'select',
          values: {
            '2': Lampa.Lang.translate('jellyfin_audio_channels_2'),
            '6': Lampa.Lang.translate('jellyfin_audio_channels_6'),
          },
          default: '6',
        },
        field: { name: Lampa.Lang.translate('jellyfin_set_max_audio_channels') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'TracksSubs' },
        field: { name: Lampa.Lang.translate('jellyfin_set_tracks_subs') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'ExternalQuality' },
        field: { name: Lampa.Lang.translate('jellyfin_set_ext_quality') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { name: STORAGE_PREFIX + 'ExtQualityHint', type: 'static' },
        field: { name: Lampa.Lang.translate('jellyfin_set_ext_quality_hint') },
      });
    }

    if (typeof Lampa.Settings.create === 'function') {
      Lampa.Template.add('settings_' + HLS_COMPONENT, '<div></div>');

      registerHlsParams(HLS_COMPONENT);

      Lampa.SettingsApi.addParam({
        component: SETTINGS_COMPONENT,
        param: { type: 'button', name: STORAGE_PREFIX + 'Hls' },
        field: { name: Lampa.Lang.translate('jellyfin_set_hls_btn') },
        onChange: function () {
          Lampa.Settings.create(HLS_COMPONENT, {
            onBack: function () {
              Lampa.Settings.create(SETTINGS_COMPONENT);
            },
          });
        },
      });
      return;
    }

    registerHlsParams(SETTINGS_COMPONENT);
  }

  function addDisplaySettings() {
    function registerButtonsParams(component) {
      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'FullButton' },
        field: { name: Lampa.Lang.translate('jellyfin_set_full_button') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'HeadButton' },
        field: { name: Lampa.Lang.translate('jellyfin_set_head_btn') },
        onChange: function () {
          syncHeadButton();
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'MenuButton' },
        field: { name: Lampa.Lang.translate('jellyfin_set_menu_btn') },
        onChange: function () {
          syncMenuButton();
          Lampa.Settings.update();
        },
      });
    }

    function registerDisplayParams(component) {
      if (typeof Lampa.Settings.create === 'function') {
        Lampa.Template.add('settings_' + BUTTONS_COMPONENT, '<div></div>');

        registerButtonsParams(BUTTONS_COMPONENT);

        Lampa.SettingsApi.addParam({
          component: component,
          param: { type: 'button', name: STORAGE_PREFIX + 'Buttons' },
          field: { name: Lampa.Lang.translate('jellyfin_set_buttons_btn') },
          onChange: function () {
            Lampa.Settings.create(BUTTONS_COMPONENT, {
              onBack: function () {
                Lampa.Settings.create(component);
              },
            });
          },
        });
      } else {
        registerButtonsParams(component);
      }

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'Dedupe' },
        field: { name: Lampa.Lang.translate('jellyfin_set_dedupe') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'HideFolders' },
        field: { name: Lampa.Lang.translate('jellyfin_set_hide_folders') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'TmdbPosters' },
        field: { name: Lampa.Lang.translate('jellyfin_set_tmdb_posters') },
        onChange: function () {
          clearTmdbMetaCache();
          Lampa.Settings.update();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'trigger', default: false, name: STORAGE_PREFIX + 'TapPlay' },
        field: { name: Lampa.Lang.translate('jellyfin_set_tap_play') },
        onChange: function () {
          Lampa.Settings.update();
        },
      });
    }

    if (typeof Lampa.Settings.create === 'function') {
      Lampa.Template.add('settings_' + DISPLAY_COMPONENT, '<div></div>');

      registerDisplayParams(DISPLAY_COMPONENT);

      Lampa.SettingsApi.addParam({
        component: SETTINGS_COMPONENT,
        param: { type: 'button', name: STORAGE_PREFIX + 'Display' },
        field: { name: Lampa.Lang.translate('jellyfin_set_display_btn') },
        onChange: function () {
          Lampa.Settings.create(DISPLAY_COMPONENT, {
            onBack: function () {
              Lampa.Settings.create(SETTINGS_COMPONENT);
            },
          });
        },
      });
      return;
    }

    registerDisplayParams(SETTINGS_COMPONENT);
  }

  function addApiSettings() {
    function registerApiParams(component) {
      Lampa.SettingsApi.addParam({
        component: component,
        param: { name: STORAGE_PREFIX + 'Url',
          type: 'input',
          default: DEFAULT_URL,
          values: '',
        },
        field: { name: Lampa.Lang.translate('jellyfin_url') },
        onChange: function () {
          invalidateUserCache();
          prefetchAutoUser();
          Lampa.Settings.update();
          syncUserInfoField();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: {
          name: STORAGE_PREFIX + 'Key',
          type: 'input',
          default: DEFAULT_API_KEY,
          values: '',
        },
        field: { name: Lampa.Lang.translate('jellyfin_key') },
        onChange: function () {
          invalidateUserCache();
          prefetchAutoUser();
          Lampa.Settings.update();
          syncUserInfoField();
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { name: STORAGE_PREFIX + 'UserInfo', type: 'static' },
        field: {
          name: Lampa.Lang.translate('jellyfin_user'),
          description: currentUserLabel(),
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'button', name: STORAGE_PREFIX + 'PickUser' },
        field: { name: Lampa.Lang.translate('jellyfin_user_pick') },
        onChange: function () {
          pickUserFromList(function () {
            Lampa.Settings.update();
          });
        },
      });

      Lampa.SettingsApi.addParam({
        component: component,
        param: { type: 'button', name: STORAGE_PREFIX + 'Test' },
        field: { name: Lampa.Lang.translate('jellyfin_test') },
        onChange: function () {
          resolveUserId()
            .then(function () {
              return refreshLibraryIndex(true);
            })
            .then(function () {
              Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_auth_ok') });
            })
            .catch(function () {
              Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_auth_fail') });
            });
        },
      });
    }

    if (typeof Lampa.Settings.create === 'function') {
      Lampa.Template.add('settings_' + API_COMPONENT, '<div></div>');

      Lampa.SettingsApi.addParam({
        component: API_COMPONENT,
        param: { name: STORAGE_PREFIX + 'ApiHint', type: 'static' },
        field: { name: Lampa.Lang.translate('jellyfin_set_api_hint') },
      });

      registerApiParams(API_COMPONENT);

      Lampa.SettingsApi.addParam({
        component: SETTINGS_COMPONENT,
        param: { type: 'button', name: STORAGE_PREFIX + 'Api' },
        field: { name: Lampa.Lang.translate('jellyfin_set_api_btn') },
        onChange: function () {
          Lampa.Settings.create(API_COMPONENT, {
            onBack: function () {
              Lampa.Settings.create(SETTINGS_COMPONENT);
            },
          });
        },
      });
      return;
    }

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { name: STORAGE_PREFIX + 'ApiHint', type: 'static' },
      field: { name: Lampa.Lang.translate('jellyfin_set_api_hint') },
    });

    registerApiParams(SETTINGS_COMPONENT);
  }

  function addCategoriesSettings() {
    var categoryLabels = {
      movies: 'jellyfin_ct_movies',
      tvshows: 'jellyfin_ct_tvshows',
      music: 'jellyfin_ct_music',
      books: 'jellyfin_ct_books',
      homevideos: 'jellyfin_ct_homevideos',
      musicvideos: 'jellyfin_ct_musicvideos',
      mixed: 'jellyfin_ct_mixed',
    };

    function registerToggle(component, key) {
      Lampa.SettingsApi.addParam({
        component: component,
        param: {
          type: 'trigger',
          default: true,
          name: STORAGE_PREFIX + LIBRARY_CATEGORY_PARAM[key],
        },
        field: { name: Lampa.Lang.translate(categoryLabels[key] || 'jellyfin_ct_default') },
        onChange: function () {
          invalidateUserDataCaches();
          Lampa.Settings.update();
        },
      });
    }

    if (typeof Lampa.Settings.create === 'function') {
      Lampa.Template.add('settings_' + CATEGORIES_COMPONENT, '<div></div>');

      Lampa.SettingsApi.addParam({
        component: CATEGORIES_COMPONENT,
        param: { name: STORAGE_PREFIX + 'CategoriesHint', type: 'static' },
        field: { name: Lampa.Lang.translate('jellyfin_set_categories_hint') },
      });

      Object.keys(LIBRARY_CATEGORY_PARAM).forEach(function (key) {
        registerToggle(CATEGORIES_COMPONENT, key);
      });

      Lampa.SettingsApi.addParam({
        component: SETTINGS_COMPONENT,
        param: { type: 'button', name: STORAGE_PREFIX + 'Categories' },
        field: { name: Lampa.Lang.translate('jellyfin_set_categories_btn') },
        onChange: function () {
          Lampa.Settings.create(CATEGORIES_COMPONENT, {
            onBack: function () {
              Lampa.Settings.create(SETTINGS_COMPONENT);
            },
          });
        },
      });
      return;
    }

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { name: STORAGE_PREFIX + 'CategoriesHint', type: 'static' },
      field: { name: Lampa.Lang.translate('jellyfin_set_categories_hint') },
    });

    Object.keys(LIBRARY_CATEGORY_PARAM).forEach(function (key) {
      registerToggle(SETTINGS_COMPONENT, key);
    });
  }

  function patchQualityToText() {
    try {
      if (!Lampa.Utils || typeof Lampa.Utils.qualityToText !== 'function') return;
      if (Lampa.Utils.qualityToText.__jellyfinPatched) return;
      var orig = Lampa.Utils.qualityToText;
      Lampa.Utils.qualityToText = function (q) {
        if (q === '360p' || q === '480p') return q;
        return orig(q);
      };
      Lampa.Utils.qualityToText.__jellyfinPatched = true;
    } catch (e) { }
  }
  var TRANSIENT_HLS_ERRORS = {
    bufferStalledError: 1,
    bufferNudgeOnStall: 1,
    fragLoadError: 1,
    bufferFullError: 1,
  };
  function patchPlayerInfoErrorFilter() {
    try {
      if (!Lampa.PlayerInfo || typeof Lampa.PlayerInfo.set !== 'function') return;
      if (Lampa.PlayerInfo.set.__jellyfinFiltered) return;
      var orig = Lampa.PlayerInfo.set;
      Lampa.PlayerInfo.set = function (need, value) {
        try {
          if (need === 'error' && typeof value === 'string' && /fatal\s*\[\s*false\s*\]/.test(value)) {
            for (var key in TRANSIENT_HLS_ERRORS) {
              if (value.indexOf(key) >= 0) return undefined;
            }
          }
        } catch (e) { }
        return orig.apply(this, arguments);
      };
      Lampa.PlayerInfo.set.__jellyfinFiltered = true;
    } catch (e) { }
  }
  function installQualitySwitchHandler() {
    try {
      if (Lampa.PlayerPanel && Lampa.PlayerPanel.listener) {
        Lampa.PlayerPanel.listener.follow('quality', function (e) {
          try {
            var keep = '';
            var m = /[?&]PlaySessionId=([^&]+)/i.exec(String((e && e.url) || ''));
            if (m && m[1]) keep = decodeURIComponent(m[1]);
            stopActiveTranscode(keep);
          } catch (err) { }
          if (autoQuality && autoQuality.internalSend) {
            autoQuality.internalSend = false;
            return;
          }
          try {
            if (e && e.name && e.name === autoQualityKey()) return;
            if (autoQuality && autoQuality.on && !autoQuality.switching) {
              autoQualityStop();
              autoQuality.manualLock = true;
            }
            if (autoQuality) autoQuality.switching = false;
          } catch (err) { }
        });
      }
    } catch (err) { }
  }
  function stopPlaylistLiveTimer() {
    if (playlistLiveTimer) {
      clearInterval(playlistLiveTimer);
      playlistLiveTimer = null;
    }
  }

  function updatePlaylistLiveProgress() {
    try {
      if (!$('.jellyfin-player-playlist').length) return;
      var w = readPlaydata();
      var id = currentPlayItemId || (w && (w.jellyfinId || (w.item && w.item.jellyfinId))) || '';
      if (!id && currentPlayRow && currentPlayRow.raw && currentPlayRow.raw.Id) {
        id = currentPlayRow.raw.Id;
      }
      if (!id) return;
      var live = playlistLiveRows[String(id)];
      if (!live || !live.item || !live.item._display) {
        if (lastLivePlaylistId) lastLivePlaylistId = null;
        return;
      }
      if (lastLivePlaylistId && String(lastLivePlaylistId) !== String(id)) {
        var prevLive = playlistLiveRows[String(lastLivePlaylistId)];
        if (prevLive && prevLive.$row) {
          prevLive.$row.removeClass('jellyfin-episode--current');
        }
      }
      if (live.$row && !live.$row.hasClass('jellyfin-episode--current')) {
        $('.jellyfin-player-playlist .jellyfin-episode--current').removeClass('jellyfin-episode--current');
        live.$row.addClass('jellyfin-episode--current');
      }
      lastLivePlaylistId = String(id);
      if (!w || !w.timeline) return;
      var pct = Number(w.timeline.percent) || 0;
      var t = Number(w.timeline.time) || 0;
      var dur = Number(w.timeline.duration) || 0;
      if (dur > 0 && t > 0 && t >= dur - 15) pct = 100;
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;
      var played = pct >= 90;
      var d = live.item._display;
      var need = played !== !!d.watched || Math.round(pct) !== Math.round(Number(d.pct) || 0);
      if (need) {
        d.pct = pct;
        d.watched = played;
        updatePlaylistRowDom(live.$row, live.item);
      }
    } catch (e) { }
  }

  function renderPlaylistRing(d) {
    var pct = Number(d.pct) || 0;
    var watched = !!(d.watched || pct >= 100);
    var radius = 10;
    var circ = 2 * Math.PI * radius;
    var filled = watched ? circ : (Math.min(100, Math.max(0, pct)) / 100) * circ;
    var stroke = watched
      ? 'rgba(52,199,89,.95)'
      : pct > 0
        ? 'rgba(0,122,255,.95)'
        : 'rgba(255,255,255,.28)';
    var val = Math.round(pct);
    return $(
      '<div class="jellyfin-episode__ring">' +
      '<svg viewBox="0 0 24 24" width="46" height="46">' +
      '<circle class="jellyfin-episode__ring-track" cx="12" cy="12" r="' + radius +
      '" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="3"/>' +
      '<circle class="jellyfin-episode__ring-fill" cx="12" cy="12" r="' + radius +
      '" fill="none" stroke="' + stroke + '" stroke-width="3" stroke-linecap="round" ' +
      'stroke-dasharray="' + circ.toFixed(2) + '" stroke-dashoffset="' + (circ - filled).toFixed(2) +
      '" transform="rotate(-90 12 12)"/>' +
      '</svg>' +
      '<span class="jellyfin-episode__ring-val">' + val + '</span>' +
      '</div>'
    );
  }

  function togglePlaylistRowWatched(item, $row) {
    var d = item._display || {};
    var id = d.id || (item && item.jellyfinId);
    if (!id) return;
    var nowWatched = !!(d.watched || d.pct >= 100);
    var target = !nowWatched;
    setItemWatched({ id: id }, target)
      .then(function () {
        d.watched = target;
        d.pct = target ? 100 : 0;
        try {
          writeLocalProgress(id, d.pct, 0, target);
          syncExternalTimeline({ raw: { Id: id } }, 0, 0);
        } catch (e) { }
        updatePlaylistRowDom($row, item);
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('jellyfin_error') });
      });
  }

  function bindPlaylistRingClick($state, item, $row) {
    var tapX = null;
    var tapY = null;
    var touchToggledAt = 0;
    ['mousedown', 'mouseup', 'touchstart', 'touchend', 'click'].forEach(function (ev) {
      $state.on(ev, function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (ev !== 'touchstart' && e && e.preventDefault) e.preventDefault();
      });
    });
    $state.on('touchstart', function (e) {
      var t = e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0];
      tapX = t ? t.clientX : null;
      tapY = t ? t.clientY : null;
    });
    $state.on('touchend', function (e) {
      var moved = true;
      if (tapX != null) {
        var t = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
        if (t) moved = Math.abs(t.clientX - tapX) > 10 || Math.abs(t.clientY - tapY) > 10;
      }
      tapX = null;
      tapY = null;
      if (moved) return;
      touchToggledAt = Date.now();
      if ($row.hasClass('jellyfin-episode--current')) return;
      togglePlaylistRowWatched(item, $row);
    });
    $state.on('click', function () {
      if (Date.now() - touchToggledAt < 500) return;
      if ($row.hasClass('jellyfin-episode--current')) return;
      togglePlaylistRowWatched(item, $row);
    });
  }

  function setPlaylistRingFocus($row, on) {
    playlistRingFocused = !!on;
    if (!$row || !$row.length) return;
    $row.toggleClass('jellyfin-ring-focus', !!on);
  }

  function handlePlaylistKeydown(e) {
    if (!isTvPlatform()) return;
    if (!$('.modal.jellyfin-playlist-modal').length) return;
    var key = e.keyCode || e.which;
    var $row = playlistFocusedRow && playlistFocusedRow.length ? playlistFocusedRow : null;
    if (key === 39) {
      if (!playlistRingFocused && $row) {
        setPlaylistRingFocus($row, true);
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
      }
      return;
    }
    if (key === 37) {
      if (playlistRingFocused) {
        setPlaylistRingFocus($row, false);
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
      }
      return;
    }
    if (playlistRingFocused && (key === 38 || key === 40)) {
      setPlaylistRingFocus($row, false);
      return;
    }
  }

  function attachPlaylistKeyHandler() {
    if (!isTvPlatform()) return;
    if (playlistKeyHandlerAttached) return;
    playlistKeyHandlerAttached = true;
    document.addEventListener('keydown', handlePlaylistKeydown, true);
  }

  function detachPlaylistKeyHandler() {
    if (!playlistKeyHandlerAttached) return;
    playlistKeyHandlerAttached = false;
    document.removeEventListener('keydown', handlePlaylistKeydown, true);
    playlistFocusedRow = null;
    playlistRingFocused = false;
  }

  function updatePlaylistRowDom($row, item) {
    var d = item._display || {};
    if (d.cover) {
      $row.find('.jellyfin-episode__img').attr('src', d.cover);
    }
    $row.find('.jellyfin-episode__num').text(d.code || '');
    $row.find('.jellyfin-episode__name').text(d.name || item.title || d.code || '');
    var $descr = $row.find('.jellyfin-episode__descr');
    if (!$descr.length) {
      $descr = $('<div class="jellyfin-episode__descr"></div>');
      $row.find('.jellyfin-episode__name').after($descr);
    }
    var ov = d.overview || '';
    if (ov.length > 160) ov = ov.slice(0, 157) + '...';
    $descr.text(ov).toggleClass('hide', !ov);
    var meta = [];
    if (d.quality) meta.push(d.quality);
    if (d.runtimeMin) {
      meta.push(d.runtimeMin + ' ' + Lampa.Lang.translate('jellyfin_min'));
    }
    $row.find('.jellyfin-episode__meta').text(meta.join(' · '));
    var pct = Number(d.pct) || 0;
    var watched = !!(d.watched || pct >= 100);
    var $state = $row.find('.jellyfin-episode__state');
    $state.empty().append(renderPlaylistRing(d));
    $row
      .find('.jellyfin-episode__progress > span')
      .css('width', Math.min(100, Math.max(0, pct)) + '%');
    $row.toggleClass('jellyfin-episode--watched', watched);
  }

  var episodeRowCacheNode = null;
  function episodeRowDom() {
    try {
      if (!episodeRowCacheNode) episodeRowCacheNode = Lampa.Template.get('jellyfin_episode', {}, false)[0];
      return $(episodeRowCacheNode.cloneNode(true));
    } catch (e) {
      return Lampa.Template.get('jellyfin_episode', {});
    }
  }

  function makePlayerPlaylistRowDom(item) {
    var $row = episodeRowDom();
    $row.addClass('selector');
    $row.on('hover:focus', function () {
      playlistFocusedRow = $row;
      if (playlistRingFocused) setPlaylistRingFocus($row, true);
    });
    bindPlaylistRingClick($row.find('.jellyfin-episode__state'), item, $row);
    updatePlaylistRowDom($row, item);
    return $row;
  }

  function refreshPlaylistItemDisplay(item) {
    try {
      if (!item || !item._display) return;
      var id = item.jellyfinId || item._display.id;
      if (!id) return;
      var local = readLocalProgress(id);
      if (!local) return;
      if (local.played) {
        item._display.watched = true;
        item._display.pct = 100;
      } else {
        item._display.watched = false;
        item._display.pct = Math.min(100, Number(local.pct) || 0);
      }
    } catch (e) { }
  }

  function showJellyfinPlayerPlaylist(items) {
    try {
      Lampa.PlayerPlaylist.active();
    } catch (e) { }
    var ctl = enabledControllerName('player');
    var w0 = readPlaydata();
    var currentId = String(
      currentPlayItemId ||
      (w0 && (w0.jellyfinId || (w0.item && w0.item.jellyfinId))) ||
      ''
    );
    var needSelect = null;
    var $rows = $(
      '<div class="jellyfin-episodes-list__rows jellyfin-player-playlist__rows"></div>'
    );
    var $list = $('<div class="jellyfin-player-playlist"></div>').append($rows);
    playlistLiveRows = {};
    items.forEach(function (item, idx) {
      refreshPlaylistItemDisplay(item);
      var $row = makePlayerPlaylistRowDom(item);
      $row.attr('data-index', idx);
      if (item && item._display && item._display.id) {
        playlistLiveRows[item._display.id] = { item: item, $row: $row };
      }
      var isCurrent = !!(item && item.selected);
      if (
        !isCurrent &&
        item &&
        item.jellyfinId &&
        currentId &&
        String(item.jellyfinId) === currentId
      ) {
        isCurrent = true;
      }
      if (isCurrent) {
        $row.addClass('jellyfin-episode--current');
        if (!needSelect) needSelect = $row[0];
      }
      $rows.append($row);
    });
    if (!needSelect) needSelect = $rows.children().first()[0];
    Lampa.Modal.open({
      title: Lampa.Lang.translate('player_playlist'),
      html: $list,
      size: 'medium',
      jellyfinRight: true,
      scroll: { mask: true },
      select: needSelect,
      onSelect: function ($target) {
        var $t = $target && $target.jquery ? $target : $($target || []);
        var $ringRow = $t.closest('.jellyfin-episode');
        if (
          $ringRow.length &&
          ($ringRow.hasClass('jellyfin-ring-focus') ||
            $t.closest('.jellyfin-episode__state').length)
        ) {
          var ringIdx = Number($ringRow.attr('data-index')) || 0;
          var ringItem = items[ringIdx];
          if (ringItem) {
            togglePlaylistRowWatched(ringItem, $ringRow);
          }
          return;
        }
        var index = Number(($target && $target.attr && $target.attr('data-index')) || 0);
        var it = items[index];
        if (!it) return;
        detachPlaylistKeyHandler();
        playlistLiveRows = {};
        stopPlaylistLiveTimer();
        try {
          Lampa.Modal.close();
        } catch (e) { }
        restoreControllerNow(ctl);
        try {
          prepareEpisodeSwitch(it);
        } catch (e) { }
        try {
          Lampa.PlayerPlaylist.listener.send('select', {
            playlist: items,
            item: it,
            position: index,
          });
        } catch (e) { }
      },
      onBack: function () {
        detachPlaylistKeyHandler();
        playlistLiveRows = {};
        stopPlaylistLiveTimer();
        try {
          Lampa.Modal.close();
        } catch (e) { }
        restoreControllerNow(ctl);
      },
    });
    try {
      var $m = $('.modal').last();
      if ($m && $m.length) $m.addClass('jellyfin-playlist-modal');
    } catch (e) { }
    attachPlaylistKeyHandler();
    if (!playlistLiveTimer) {
      playlistLiveTimer = setInterval(updatePlaylistLiveProgress, 1000);
    }
  }

  function installJellyfinPlaylist() {
    try {
      if (!Lampa.PlayerPlaylist || typeof Lampa.PlayerPlaylist.show !== 'function') return;
      if (Lampa.PlayerPlaylist.__jellyfinPatched) return;
      if (Lampa.PlayerPlaylist.listener) {
        Lampa.PlayerPlaylist.listener.follow('set', updatePlayerEpisodeButtons);
      }
      if (typeof Lampa.PlayerPlaylist.prev === 'function' && !Lampa.PlayerPlaylist.__jellyfinEpPrevPatched) {
        Lampa.PlayerPlaylist.__jellyfinEpPrevPatched = true;
        var origPrev = Lampa.PlayerPlaylist.prev;
        Lampa.PlayerPlaylist.prev = function () {
          if (episodePrevButtonDisabled) return;
          try {
            resetCurrentEpisodeProgress();
          } catch (e) { }
          try {
            var ppl = Lampa.PlayerPlaylist.get() || [];
            var pp = currentEpisodePosition(ppl);
            if (pp !== null && pp !== undefined && ppl[pp - 1]) {
              prepareEpisodeSwitch(ppl[pp - 1]);
            }
          } catch (e) { }
          return origPrev.apply(this, arguments);
        };
      }
      if (typeof Lampa.PlayerPlaylist.next === 'function' && !Lampa.PlayerPlaylist.__jellyfinEpNextPatched) {
        Lampa.PlayerPlaylist.__jellyfinEpNextPatched = true;
        var origNext = Lampa.PlayerPlaylist.next;
        Lampa.PlayerPlaylist.next = function () {
          if (episodeNextButtonDisabled) return;
          try {
            markCurrentEpisodeCompleted();
          } catch (e) { }
          try {
            var npl = Lampa.PlayerPlaylist.get() || [];
            var np = currentEpisodePosition(npl);
            if (np !== null && np !== undefined && npl[np + 1]) {
              prepareEpisodeSwitch(npl[np + 1]);
            }
          } catch (e) { }
          return origNext.apply(this, arguments);
        };
      }
      if (
        Lampa.Modal &&
        Lampa.Modal.listener &&
        typeof Lampa.Modal.listener.on === 'function' &&
        !Lampa.Modal.__jellyfinRightPatched
      ) {
        Lampa.Modal.listener.on('fullshow', function (e) {
          if (e && e.active && e.active.jellyfinRight && e.html) {
            e.html.addClass('jellyfin-playlist-modal');
          }
        });
        Lampa.Modal.listener.on('close', function () {
          detachPlaylistKeyHandler();
          playlistLiveRows = {};
          lastLivePlaylistId = null;
          stopPlaylistLiveTimer();
        });
        Lampa.Modal.__jellyfinRightPatched = true;
      }
      var origShow = Lampa.PlayerPlaylist.show;
      Lampa.PlayerPlaylist.show = function () {
        try {
          var items = Lampa.PlayerPlaylist.get();
          if (
            items &&
            items.length &&
            items.some(function (it) {
              return it && it._display;
            })
          ) {
            if (Lampa.Modal && typeof Lampa.Modal.open === 'function') {
              showJellyfinPlayerPlaylist(items);
              return;
            }
          }
        } catch (e) { }
        origShow();
      };
      Lampa.PlayerPlaylist.__jellyfinPatched = true;
    } catch (e) { }
  }

  function disablePlayerDownPlaylist() {
    try {
      if (!Lampa.Controller || !Lampa.Controller.listener) return;
      if (Lampa.Controller.__jellyfinDownPatched) return;
      Lampa.Controller.listener.follow('toggle', function (e) {
        if (!e || e.name !== 'player_panel') return;
        try {
          var en = Lampa.Controller.enabled();
          if (
            en &&
            en.controller &&
            typeof en.controller.down === 'function' &&
            !en.controller.__jellyfinDownPatched
          ) {
            en.controller.__jellyfinDownPatched = true;
            en.controller.down = function () {
              try {
                if (
                  Lampa.Footer &&
                  typeof Lampa.Footer.available === 'function' &&
                  Lampa.Footer.available()
                ) {
                  Lampa.Controller.toggle('player_footer');
                }
              } catch (err) { }
            };
          }
        } catch (err) { }
      });
      Lampa.Controller.__jellyfinDownPatched = true;
    } catch (e) { }
  }

  function init() {
    if (window.lampa_settings && window.lampa_settings.read_only) return;

    addLang();
    patchQualityToText();
    registerStyles();
    $('body').append(Lampa.Template.get('jellyfin_style', {}, true));

    Lampa.Component.add(PANEL_COMPONENT, PanelComponent);
    Lampa.Component.add(HUB_COMPONENT, HubComponent);
    Lampa.Component.add(PHOTO_VIEWER_COMPONENT, PhotoViewerComponent);
    Lampa.Component.add(DETAIL_COMPONENT, JellyfinDetailComponent);
    Lampa.Component.add(AUDIO_PLAYER_COMPONENT, AudioPlayerComponent);
    Lampa.Component.add(EPISODES_COMPONENT, EpisodesComponent);
    Lampa.Manifest.plugins = MANIFEST;
    addSettings();
    syncMenuButton();
    syncHeadButton();
    wrapApiFull();
    patchPlayerInfoErrorFilter();
    patchActivityPushState();
    setupBackAfterRefresh();
    setupRouteRestore();
    listenFullCard();

    if (!jellyfinResumeHandled) {
      resumeJellyfinActivity();
    }
    try {
      Lampa.Listener.follow('activity', function (e) {
        if (!e) return;
        if (e.type === 'start' || e.type === 'create' || e.type === 'init') {
          saveJellyfinActivity(e.object);
          if (!isJellyfinActivity(e.object)) clearWatchTarget();
          if (e.type === 'start') trackRouteActivity(e.object);
        }
      });
    } catch (err) {}

    if (Lampa.Player && Lampa.Player.listener) {
      Lampa.Player.listener.follow('destroy', handlePlayerDestroy);
      Lampa.Player.listener.follow('end', handlePlayerDestroy);
      Lampa.Player.listener.follow('finish', handlePlayerDestroy);
      Lampa.Player.listener.follow('ready', function (e) {
        var item = (e && (e.item || e.data)) || e || {};
        if (item && item.jellyfinId) {
          lastCompletedRowId = null;
          lastProgressResetRowId = null;
          if (lastProgressResetTimer) {
            clearTimeout(lastProgressResetTimer);
            lastProgressResetTimer = null;
          }
          currentPlayItemId = item.jellyfinId;
          var readyRow = findPlaybackRow(item.jellyfinId);
          if (readyRow) {
            currentPlayRow = readyRow;
            currentTimelineHash = timelineHashFor(readyRow) || currentTimelineHash;
          }
          try {
            document.body.classList.add('jellyfin-playing');
          } catch (err) { }
        }
        if (item && item.jellyfinQualityAuto) {
          if (item.jellyfinId && item.jellyfinId !== autoQuality.itemId) {
            autoQuality.itemId = item.jellyfinId;
            autoQuality.manualLock = false;
          }
          if (!autoQuality.on && !autoQuality.manualLock) {
            autoQualityStart(
              item.jellyfinQualityAuto.map || {},
              item.jellyfinQualityAuto.startKey || '',
              item.jellyfinQualityAuto.nativeKey || ''
            );
          }
        }
      });
    }

    installQualitySwitchHandler();
    installJellyfinPlaylist();
    disablePlayerDownPlaylist();

    if (Lampa.Timeline && Lampa.Timeline.listener) {
      Lampa.Timeline.listener.follow('update', function (e) {
        if (!e || !e.data) return;
        if (String(e.data.hash || '') !== String(currentTimelineHash || '')) return;
        if (String(e.data.hash || '') === String(syncingTimelineHash || '')) return;
        if (!currentPlayRow) return;
        var road = e.data.road || {};
        cachePlaybackState(
          currentPlayRow.raw.Id,
          String(currentPlayRow.type || currentPlayRow.raw.Type || ''),
          road.percent,
          road.time,
          road.duration
        );
        reportPlaybackProgress(
          currentPlayRow,
          road.percent,
          road.time,
          road.duration
        );
      });
    }

    if (document.addEventListener) {
      document.addEventListener('seeked', handleVideoSeeked, true);
      document.addEventListener('ended', handleVideoEnded, true);
    }

    try {
      var onAppHidden = function () {
        syncFlushPlaybackProgress();
      };
      window.addEventListener('pagehide', onAppHidden);
      window.addEventListener('beforeunload', onAppHidden);
      window.addEventListener('unload', onAppHidden);
      if (document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') {
            syncFlushPlaybackProgress();
          } else if (document.visibilityState === 'visible') {
            if (externalPlay && externalPlay.rowId) syncFlushPlaybackProgress();
          }
        });
        document.addEventListener('webkitvisibilitychange', function () {
          if (document.webkitVisibilityState === 'hidden') {
            syncFlushPlaybackProgress();
          } else if (document.webkitVisibilityState === 'visible') {
            if (externalPlay && externalPlay.rowId) syncFlushPlaybackProgress();
          }
        });
        document.addEventListener('freeze', onAppHidden);
      }
    } catch (e) { }

    prefetchAutoUser();
    refreshLibraryIndex(false).catch(function () { });
  }

  if (window.appready) init();
  else
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') init();
    });
})();
