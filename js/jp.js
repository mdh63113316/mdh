// 热播影视网 TVBox 爬虫 - 专为 acsux.cn 优化
// 兼容安卓4设备，基于苹果CMS mxtheme 模板

var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 5.0; SM-G900P) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 请求封装（同步）
function fetchUrl(url) {
    var result = request(url, { headers: headers, method: 'GET' });
    return result ? result.content : '';
}

// --- 修正视频列表解析函数 ---
// 现在直接匹配网站的实际结构：<a class="module-poster-item module-item" href="链接">
function getList(html) {
    var videos = [];
    // 关键修正：匹配 .module-items 容器下的每一个 .module-poster-item
    var items = html.match(/<a[^>]*class="module-poster-item module-item"[^>]*href="\/dt\/(\d+)\.html"[^>]*>[\s\S]*?<\/a>/gi);
    if (!items) return videos;

    for (var i = 0; i < items.length && i < 40; i++) {
        var it = items[i];
        // 提取详情页链接中的ID
        var idMatch = it.match(/href="\/dt\/(\d+)\.html/);
        if (!idMatch) continue;
        var vod_id = idMatch[1];

        // 提取标题
        var nameMatch = it.match(/title="([^"]+)"/);
        var vod_name = nameMatch ? nameMatch[1] : '';

        // 提取封面图
        var picMatch = it.match(/data-original="([^"]+)"/);
        var vod_pic = picMatch ? picMatch[1] : '';
        if (vod_pic && !/^https?:\/\//i.test(vod_pic)) vod_pic = host + vod_pic;

        // 提取备注（集数/状态）
        var remarkMatch = it.match(/<div class="module-item-note">([^<]+)<\/div>/);
        var vod_remarks = remarkMatch ? remarkMatch[1] : '';

        if (vod_id && vod_name) {
            videos.push({
                "vod_id": vod_id,
                "vod_name": vod_name,
                "vod_pic": vod_pic,
                "vod_remarks": vod_remarks
            });
        }
    }
    return videos;
}

function init() { return JSON.stringify({}); }

function home() {
    var classes = [
        {"type_id": "1", "type_name": "电影"},
        {"type_id": "2", "type_name": "电视剧"},
        {"type_id": "3", "type_name": "综艺"},
        {"type_id": "4", "type_name": "动漫"},
        {"type_id": "5", "type_name": "纪录片"}
    ];
    return JSON.stringify({ "class": classes, "filters": {} });
}

function homeVod() {
    var html = fetchUrl(host);
    var list = getList(html);
    return JSON.stringify({ "list": list });
}

function category(tid, pg, filter, extend) {
    var page = pg || 1;
    var targetId = (extend && extend.class) ? extend.class : tid;
    // 分类页 URL 格式: /channel/{tid}.html
    var url = host + "/channel/" + targetId + ".html";
    if (page > 1) {
        url = host + "/channel/" + targetId + "-" + page + ".html";
    }
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({ "list": list, "page": page });
}

function detail(id) {
    var url = host + "/dt/" + id + ".html";
    var html = fetchUrl(url);

    // 提取标题
    var nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    var vod_name = nameMatch ? nameMatch[1] : '';

    // 提取封面
    var picMatch = html.match(/data-original="([^"]+)"/);
    var vod_pic = picMatch ? picMatch[1] : '';

    // 提取简介
    var contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    var vod_content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '') : '';

    // --- 修正播放列表解析：匹配网站实际的播放列表结构 ---
    var playFrom = [];
    var playUrlPart = [];

    // 1. 获取所有播放线路
    var playTabItems = html.match(/<div class="module-tab-item"[^>]*>[\s\S]*?<span>(.*?)<\/span>[\s\S]*?<\/div>/gi);
    if (playTabItems) {
        for (var i = 0; i < playTabItems.length; i++) {
            var spanMatch = playTabItems[i].match(/<span>(.*?)<\/span>/);
            if (spanMatch) playFrom.push(spanMatch[1]);
        }
    }
    if (playFrom.length === 0) playFrom.push("默认线路");

    // 2. 获取每个线路下的播放列表
    var playListBlocks = html.match(/<div[^>]*class="module-play-list-content"[^>]*>[\s\S]*?<\/div>/gi);
    if (playListBlocks) {
        for (var j = 0; j < playListBlocks.length && j < playFrom.length; j++) {
            var block = playListBlocks[j];
            var eps = [];
            // 匹配每个剧集链接
            var links = block.match(/<a[^>]*href="\/play\/(\d+)\.html"[^>]*>[\s\S]*?<span>(.*?)<\/span>[\s\S]*?<\/a>/gi);
            if (links) {
                for (var k = links.length - 1; k >= 0; k--) {
                    var link = links[k];
                    var urlMatch = link.match(/href="\/play\/(\d+)\.html"/);
                    var nameMatch = link.match(/<span>(.*?)<\/span>/);
                    if (urlMatch) {
                        var name = nameMatch ? nameMatch[1] : (k+1);
                        eps.push(name + '$' + urlMatch[1]);
                    }
                }
                playUrlPart.push(eps.join('#'));
            } else {
                playUrlPart.push('');
            }
        }
    }

    var vod_play_from = playFrom.join('$$$');
    var vod_play_url = playUrlPart.join('$$$');

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: vod_name,
            vod_pic: vod_pic,
            vod_content: vod_content,
            vod_play_from: vod_play_from,
            vod_play_url: vod_play_url
        }]
    });
}

function search(wd, pg) {
    var page = pg || 1;
    var url = host + "/search/" + encodeURIComponent(wd) + "-------------.html";
    if (page > 1) url = host + "/search/" + encodeURIComponent(wd) + "-------------" + page + "-------------/" + page;
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({ "list": list });
}

function play(flag, id) {
    var url = host + "/play/" + id + ".html";
    var html = fetchUrl(url);
    // 提取 m3u8 地址
    var m3u8 = html.match(/url:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
               html.match(/"url":"([^"]+\.m3u8[^"]*)"/i);
    if (m3u8) {
        var realUrl = m3u8[1].replace(/\\/g, '');
        return JSON.stringify({ parse: 0, url: realUrl, header: headers });
    }
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

return {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
