// 网站配置
var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
};

/**
 * 请求函数（带超时和重试）
 */
async function req(url, options = {}, timeout = 8000, retry = 2) {
    for (var i = 0; i <= retry; i++) {
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(() => controller.abort(), timeout);
            var res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            var content = await res.text();
            return { content: content, statusCode: res.status };
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

/**
 * 从首页/分类页/搜索页的 HTML 中提取视频列表
 * 根据你提供的真实结构编写
 */
function getList(html) {
    var videos = [];
    // 匹配 <a class="module-poster-item module-item" href="/dt/数字.html" title="标题">
    var reg = /<a[^>]+class="module-poster-item module-item"[^>]+href="\/dt\/(\d+)\.html"[^>]+title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;
    while ((match = reg.exec(html))) {
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
    // 如果没匹配到（可能是搜索页结构略有不同），尝试备用匹配
    if (videos.length === 0) {
        var altReg = /<a[^>]+href="\/dt\/(\d+)\.html"[^>]*>[\s\S]*?<img[^>]+alt="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
        while ((match = altReg.exec(html))) {
            videos.push({
                vod_id: match[1],
                vod_name: match[2],
                vod_pic: '',
                vod_remarks: ''
            });
        }
    }
    return videos;
}

/**
 * 从详情页 HTML 中提取 m3u8 播放地址
 * 根据你提供的 player_aaaa 对象编写
 */
function getPlayUrl(html) {
    // 匹配 var player_aaaa = {"flag":"play", ..., "url":"https://...m3u8", ...}
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
    // 根据你提供的分类页 URL 示例：/cp/1.html (剧集), /cp/2.html (电影)
    // 分页格式：/cp/1/page/2.html
    var url = host + '/cp/' + tid + (page > 1 ? '/page/' + page + '.html' : '.html');
    var resp = await req(url, { headers: headers });
    var list = getList(resp.content);
    return JSON.stringify({ list: list, page: page });
}

async function detail(id) {
    var url = host + '/dt/' + id + '.html';
    var resp = await req(url, { headers: headers });
    var html = resp.content;
    // 提取视频名称
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
    // 提取播放地址（直接获取 m3u8）
    var playUrl = getPlayUrl(html);
    var playFrom = '直链';
    var playUrlStr = '';
    if (playUrl) {
        playUrlStr = '播放$' + playUrl;
    } else {
        // 如果没有直接 m3u8，则尝试获取播放页面地址（但该站一般直接有 m3u8）
        playUrlStr = '';
    }
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: name,
            vod_pic: pic.startsWith('http') ? pic : (pic ? host + pic : ''),
            vod_content: content,
            vod_play_from: playFrom,
            vod_play_url: playUrlStr
        }]
    });
}

async function play(flag, id, flags) {
    // 这里 id 实际上已经是 m3u8 链接（因为 detail 里直接给了）
    if (id && id.startsWith('http')) {
        return JSON.stringify({ parse: 0, url: id, header: headers });
    }
    // 如果 id 不是链接，则当作播放页 ID 处理
    var url = host + '/play/' + id;
    var resp = await req(url, { headers: headers });
    var playUrl = getPlayUrl(resp.content);
    if (playUrl) {
        return JSON.stringify({ parse: 0, url: playUrl, header: headers });
    }
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

async function search(wd, quick, pg) {
    var page = pg || 1;
    // 搜索 URL 格式：/search/关键词-------------.html
    var searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (page > 1) searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html/page/' + page + '.html';
    var resp = await req(searchUrl, { headers: headers });
    var list = getList(resp.content);
    return JSON.stringify({ list: list });
}
