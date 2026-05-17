// 网站配置
var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 通用请求函数（无 AbortController，兼容老环境）
function req(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    for (var key in headers) {
        xhr.setRequestHeader(key, headers[key]);
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                callback(null, xhr.responseText);
            } else {
                callback(new Error('HTTP ' + xhr.status));
            }
        }
    };
    xhr.onerror = function() {
        callback(new Error('Network error'));
    };
    xhr.send();
}

// 同步请求包装器（TVBox 环境通常支持同步）
function reqSync(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    for (var key in headers) {
        xhr.setRequestHeader(key, headers[key]);
    }
    xhr.send();
    if (xhr.status === 200) {
        return xhr.responseText;
    } else {
        throw new Error('HTTP ' + xhr.status);
    }
}

// 提取视频列表（根据真实 HTML 结构）
function getList(html) {
    var videos = [];
    // 匹配视频块：<a class="module-poster-item module-item" href="/dt/数字.html" title="标题">
    var reg = /<a[^>]+class="module-poster-item module-item"[^>]+href="\/dt\/(\d+)\.html"[^>]+title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;
    while (match = reg.exec(html)) {
        var id = match[1];
        var title = match[2];
        var block = match[3];
        // 提取图片
        var pic = '';
        var picMatch = /data-original="([^"]+)"/.exec(block);
        if (picMatch) pic = picMatch[1];
        // 提取备注（集数）
        var note = '';
        var noteMatch = /<div class="module-item-note">([^<]+)<\/div>/.exec(block);
        if (noteMatch) note = noteMatch[1];
        videos.push({
            vod_id: id,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: note
        });
    }
    // 如果一条都没匹配到，返回调试信息（便于排查）
    if (videos.length === 0) {
        videos.push({
            vod_id: 'debug',
            vod_name: '调试：未解析到数据，请检查HTML结构',
            vod_pic: '',
            vod_remarks: ''
        });
    }
    return videos;
}

// 从播放页提取 m3u8 地址（同步）
function getM3u8FromPlayPage(playUrl) {
    try {
        var html = reqSync(playUrl);
        // 匹配 var player_aaaa = {"url":"https://...m3u8", ...}
        var reg = /"url":"([^"]+\.m3u8)"/;
        var match = reg.exec(html);
        if (match) {
            return match[1].replace(/\\\//g, '/');
        }
        // 备用：直接匹配 m3u8 链接
        var m3u8Match = html.match(/https?:\/\/[^"'\s>]+\.m3u8/);
        if (m3u8Match) return m3u8Match[0];
        return '';
    } catch(e) {
        return '';
    }
}

// 从详情页提取播放列表（多源多集）
function extractPlaylist(html, vodId) {
    var sources = [];
    // 匹配所有播放源标签（例如：优质、红牛）
    var sourceReg = /<div class="module-tab-item tab-item"[^>]*data-dropdown-value="([^"]+)">[\s\S]*?<span>([^<]+)<\/span>/g;
    var sourceMatch;
    var sourceList = [];
    while (sourceMatch = sourceReg.exec(html)) {
        sourceList.push({ key: sourceMatch[1], name: sourceMatch[2] });
    }
    if (sourceList.length === 0) {
        // 默认一个源
        sourceList.push({ key: 'default', name: '播放' });
    }
    // 提取所有集数链接（格式：/play/447434-1-1.html）
    var epReg = /onclick="location\.replace\('\/play\/(\d+-\d+-\d+)\.html'\)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
    var epMatch;
    var episodesBySource = {};
    while (epMatch = epReg.exec(html)) {
        var playId = epMatch[1];      // 如 "447434-1-1"
        var epName = epMatch[2];      // 如 "第01集"
        var parts = playId.split('-');
        var sourceIdx = parseInt(parts[1], 10); // 源索引：优质=1，红牛=2
        if (!episodesBySource[sourceIdx]) episodesBySource[sourceIdx] = [];
        episodesBySource[sourceIdx].push(epName + '$' + playId);
    }
    // 按源索引顺序组装
    for (var i = 1; i <= sourceList.length; i++) {
        if (episodesBySource[i] && episodesBySource[i].length > 0) {
            var sourceName = sourceList[i-1].name;
            sources.push({
                name: sourceName,
                url: episodesBySource[i].join('#')
            });
        }
    }
    // 如果还是没有集数，尝试直接获取单集（立即播放）
    if (sources.length === 0) {
        var directPlay = html.match(/location\.replace\('\/play\/([^']+)\.html'\)/);
        if (directPlay) {
            sources.push({
                name: '播放',
                url: '播放$' + directPlay[1]
            });
        }
    }
    var playFrom = sources.map(function(s) { return s.name; }).join('$$$');
    var playUrl = sources.map(function(s) { return s.url; }).join('$$$');
    return { playFrom: playFrom, playUrl: playUrl };
}

// ======================== TVBox 接口函数（必须全局） ========================
function init(cfg) { return; }

function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '2', type_name: '电影' },
            { type_id: '1', type_name: '剧集' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺' }
        ],
        filters: {}
    });
}

function homeVod() {
    var html = reqSync(host);
    var list = getList(html);
    return JSON.stringify({ list: list });
}

function category(tid, pg) {
    var page = pg || 1;
    var url = host + '/cp/' + tid + (page > 1 ? '/page/' + page + '.html' : '.html');
    var html = reqSync(url);
    var list = getList(html);
    return JSON.stringify({ list: list, page: page });
}

function detail(id) {
    var url = host + '/dt/' + id + '.html';
    var html = reqSync(url);
    // 提取名称
    var name = '';
    var nameMatch = html.match(/<h1>([^<]+)<\/h1>/);
    if (nameMatch) name = nameMatch[1];
    // 提取图片
    var pic = '';
    var picMatch = html.match(/data-original="([^"]+\.jpg)"/);
    if (picMatch) pic = picMatch[1];
    // 提取简介
    var content = '';
    var contentMatch = html.match(/<meta name="description" content="([^"]+)"/);
    if (contentMatch) content = contentMatch[1];
    // 提取播放列表
    var playlist = extractPlaylist(html, id);
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_content: content,
            vod_play_from: playlist.playFrom,
            vod_play_url: playlist.playUrl
        }]
    });
}

function play(flag, id, flags) {
    // 如果 id 已经是完整的 m3u8 链接（外部解析器传入）
    if (id.indexOf('http') === 0 && id.indexOf('.m3u8') !== -1) {
        return JSON.stringify({ parse: 0, url: id, header: headers });
    }
    // 否则构造播放页 URL
    var playPageUrl = host + '/play/' + id + '.html';
    var m3u8 = getM3u8FromPlayPage(playPageUrl);
    if (m3u8) {
        return JSON.stringify({ parse: 0, url: m3u8, header: headers });
    }
    // 如果提取不到 m3u8，交给外部解析器
    return JSON.stringify({ parse: 1, url: playPageUrl, header: headers });
}

function search(wd, quick, pg) {
    var page = pg || 1;
    var searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (page > 1) searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html/page/' + page + '.html';
    var html = reqSync(searchUrl);
    var list = getList(html);
    return JSON.stringify({ list: list });
}
