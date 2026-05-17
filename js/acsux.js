// 网站基础配置
var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
};

/**
 * 网络请求（带超时和重试）
 */
async function req(url, options = {}, timeout = 8000, retry = 2) {
    for (var i = 0; i <= retry; i++) {
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(() => controller.abort(), timeout);
            var res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var content = await res.text();
            return { content: content, statusCode: res.status };
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

/**
 * 从首页/分类页/搜索页的HTML中提取视频列表
 * 根据真实结构：<a class="module-poster-item module-item" href="/dt/数字.html" title="标题">
 */
function getList(html) {
    var videos = [];
    // 匹配视频项
    var reg = /<a[^>]+class="module-poster-item module-item"[^>]+href="\/dt\/(\d+)\.html"[^>]+title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;
    while ((match = reg.exec(html))) {
        var id = match[1];
        var title = match[2];
        var block = match[3];
        // 图片
        var pic = '';
        var picMatch = /data-original="([^"]+)"/.exec(block);
        if (picMatch) pic = picMatch[1];
        // 备注（集数）
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
    return videos;
}

/**
 * 从播放页面（/play/xxx.html）中提取真实的m3u8地址
 * 播放页中会有 <script>var player_aaaa={"url":"https://...m3u8",...}</script>
 */
function getM3u8FromPlayPage(html) {
    var reg = /var player_aaaa\s*=\s*({[\s\S]*?});/;
    var match = reg.exec(html);
    if (match) {
        try {
            var data = eval('(' + match[1] + ')');
            if (data.url && data.url.includes('.m3u8')) {
                return data.url;
            }
        } catch(e) {}
    }
    // 备用：直接搜索 m3u8 链接
    var m3u8Match = html.match(/https?:\/\/[^"'\s>]+\.m3u8/);
    if (m3u8Match) return m3u8Match[0];
    return '';
}

/**
 * 从详情页HTML中提取所有播放源和集数列表
 * 返回 { playFrom: "源1$$$源2", playUrl: "源1的集数字符串#...#$$$源2的集数字符串" }
 */
function extractPlayList(html, vodId) {
    var sources = [];
    // 匹配每个播放源区块：<div class="module-tab-item tab-item" data-dropdown-value="优质"><span>优质</span><small>7</small></div>
    var sourceReg = /<div class="module-tab-item tab-item"[^>]*data-dropdown-value="([^"]+)">[\s\S]*?<span>([^<]+)<\/span>/g;
    var sourceMatch;
    var sourceNames = [];
    while ((sourceMatch = sourceReg.exec(html))) {
        var sourceKey = sourceMatch[1];   // 如 "优质" 或 "红牛"
        var sourceName = sourceMatch[2];  // 同上
        sourceNames.push({ key: sourceKey, name: sourceName });
    }
    // 如果没有找到源，尝试从播放列表面板中提取
    if (sourceNames.length === 0) {
        // 默认有一个源叫“播放”
        sourceNames.push({ key: 'default', name: '播放' });
    }
    // 对于每个源，找到对应的集数列表
    for (var si = 0; si < sourceNames.length; si++) {
        var src = sourceNames[si];
        var episodes = [];
        // 集数链接格式：onclick="location.replace('/play/447434-1-1.html')"
        // 源索引：优质对应1，红牛对应2（从HTML看，优质源的集数链接中有 -1-，红牛有 -2-）
        // 我们需要匹配所有集数链接，但只保留属于当前源的
        var epReg = /onclick="location\.replace\('\/play\/(\d+-\d+-\d+)\.html'\)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
        var epMatch;
        while ((epMatch = epReg.exec(html))) {
            var playId = epMatch[1];      // 例如 "447434-1-1"
            var epName = epMatch[2];      // 例如 "第01集"
            // 判断该集属于哪个源：playId 格式为 vodId-sourceIndex-epIndex
            var parts = playId.split('-');
            if (parts.length >= 2) {
                var sourceIdx = parseInt(parts[1], 10);
                // 源索引：优质对应1，红牛对应2（按出现顺序）
                if (sourceIdx === si + 1) {
                    episodes.push(epName + '$' + playId);
                }
            } else {
                // 容错：如果无法区分，都加到第一个源
                if (si === 0) episodes.push(epName + '$' + playId);
            }
        }
        if (episodes.length > 0) {
            sources.push({
                name: src.name,
                url: episodes.join('#')
            });
        }
    }
    // 如果还是没有提取到任何集数，尝试直接获取单集（从立即播放按钮）
    if (sources.length === 0) {
        var directPlay = html.match(/location\.replace\('\/play\/([^']+)\.html'\)/);
        if (directPlay) {
            sources.push({
                name: '播放',
                url: '播放$' + directPlay[1]
            });
        }
    }
    var playFrom = sources.map(s => s.name).join('$$$');
    var playUrl = sources.map(s => s.url).join('$$$');
    return { playFrom: playFrom, playUrl: playUrl };
}

// ======================== TVBox 标准接口 ========================
async function init(cfg) { return; }

async function home(filter) {
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

async function homeVod() {
    var resp = await req(host, { headers: headers });
    var list = getList(resp.content);
    return JSON.stringify({ list: list });
}

async function category(tid, pg) {
    var page = pg || 1;
    var url = host + '/cp/' + tid + (page > 1 ? '/page/' + page + '.html' : '.html');
    var resp = await req(url, { headers: headers });
    var list = getList(resp.content);
    return JSON.stringify({ list: list, page: page });
}

async function detail(id) {
    var url = host + '/dt/' + id + '.html';
    var resp = await req(url, { headers: headers });
    var html = resp.content;
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
    var playlist = extractPlayList(html, id);
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: name,
            vod_pic: pic.startsWith('http') ? pic : (pic ? host + pic : ''),
            vod_content: content,
            vod_play_from: playlist.playFrom,
            vod_play_url: playlist.playUrl
        }]
    });
}

async function play(flag, id, flags) {
    // id 格式可能是 "447434-1-1" 或直接 m3u8 链接
    if (id && id.startsWith('http')) {
        return JSON.stringify({ parse: 0, url: id, header: headers });
    }
    // 否则当作播放页面ID处理
    var playUrl = host + '/play/' + id + '.html';
    var resp = await req(playUrl, { headers: headers });
    var m3u8 = getM3u8FromPlayPage(resp.content);
    if (m3u8) {
        return JSON.stringify({ parse: 0, url: m3u8, header: headers });
    }
    // 如果没找到，返回播放页地址交给外部解析器
    return JSON.stringify({ parse: 1, url: playUrl, header: headers });
}

async function search(wd, quick, pg) {
    var page = pg || 1;
    var searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (page > 1) searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html/page/' + page + '.html';
    var resp = await req(searchUrl, { headers: headers });
    var list = getList(resp.content);
    return JSON.stringify({ list: list });
}
