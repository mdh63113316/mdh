// 通用苹果CMS V10 TVBox 爬虫
// 适用于大多数苹果 CMS 架构的影视站
// 使用方法：修改下方 host 变量为目标网站地址即可

var host = 'https://www.9meiju.com';   // 这里换成你想要采集的网站地址（不要带末尾斜杠）
var headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 5.0; SM-G900P) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 请求封装（同步）
function fetchUrl(url) {
    var result = request(url, { headers: headers, method: 'GET' });
    return result ? result.content : '';
}

// 解析视频列表（适用于苹果CMS标准模板）
function getList(html) {
    var videos = [];
    // 匹配视频卡片（支持 .module-item 和 .fed-list-item）
    var items = html.match(/<div[^>]*class="[^"]*(?:module-item|fed-list-item)[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (!items || items.length === 0) {
        // 备用匹配：直接找 a 标签包裹的卡片
        items = html.match(/<a[^>]*class="[^"]*module-poster[^"]*"[^>]*>[\s\S]*?<\/a>/gi);
    }
    if (!items) return videos;

    for (var i = 0; i < items.length && i < 40; i++) {
        var it = items[i];
        // 提取详情页链接和ID
        var idMatch = it.match(/href="\/(?:vod|detail|show)\/(\d+)\.html/) ||
                      it.match(/href="\/(?:index\.php\/)?vod\/detail\/id\/(\d+)\.html/) ||
                      it.match(/\/detail\/(\d+)/);
        if (!idMatch) continue;
        var vod_id = idMatch[1];

        // 提取标题
        var nameMatch = it.match(/title="([^"]+)"/) ||
                        it.match(/alt="([^"]+)"/) ||
                        it.match(/<strong>([^<]+)<\/strong>/);
        var vod_name = nameMatch ? nameMatch[1] : '';

        // 提取封面图
        var picMatch = it.match(/data-original="([^"]+)"/) ||
                       it.match(/src="([^"]+)"/);
        var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';

        // 提取备注（集数/状态）
        var remarkMatch = it.match(/module-item-note">([^<]+)<\/div>/) ||
                          it.match(/remarks">([^<]+)<\/span>/);
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
    // 苹果CMS常用分类URL格式：/vodtype/1/ 或 /vod/show/id/1/page/2.html
    var url = host + "/vodtype/" + targetId + (page > 1 ? "/page/" + page + "/" : "");
    var html = fetchUrl(url);
    // 如果上面返回空，尝试另一种格式
    if (!html || html.length < 100) {
        url = host + "/vod/show/id/" + targetId + (page > 1 ? "/page/" + page + ".html" : "");
        html = fetchUrl(url);
    }
    var list = getList(html);
    return JSON.stringify({ "list": list, "page": page });
}

function detail(id) {
    var url = host + "/voddetail/" + id + ".html";
    var html = fetchUrl(url);
    if (!html || html.length === 0) {
        url = host + "/index.php/vod/detail/id/" + id + ".html";
        html = fetchUrl(url);
    }

    // 标题
    var nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    var vod_name = nameMatch ? nameMatch[1] : '';

    // 封面
    var picMatch = html.match(/data-original="([^"]+)"/);
    var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';

    // 简介
    var contentMatch = html.match(/<div[^>]*class="[^"]*video-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    var vod_content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '') : '';

    // 播放线路名称
    var playFrom = [];
    var tabMatches = html.match(/<div[^>]*class="[^"]*module-tab-item[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi);
    if (tabMatches) {
        for (var i = 0; i < tabMatches.length; i++) {
            var spanMatch = tabMatches[i].match(/<span>([^<]+)<\/span>/);
            if (spanMatch) playFrom.push(spanMatch[1]);
        }
    }
    if (playFrom.length === 0) playFrom.push("默认线路");

    // 播放地址列表
    var playUrl = [];
    var playBlocks = html.match(/<div[^>]*class="[^"]*module-play-list[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (playBlocks) {
        for (var j = 0; j < playBlocks.length && j < playFrom.length; j++) {
            var block = playBlocks[j];
            var links = block.match(/<a[^>]*href="\/(?:play|vodplay)\/([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi);
            var eps = [];
            if (links) {
                for (var k = links.length - 1; k >= 0; k--) {
                    var hrefMatch = links[k].match(/href="\/(?:play|vodplay)\/([^"]+)"/);
                    var spanMatch2 = links[k].match(/<span>([^<]+)<\/span>/);
                    if (hrefMatch) {
                        var name = spanMatch2 ? spanMatch2[1] : (k+1);
                        eps.push(name + '$' + hrefMatch[1]);
                    }
                }
                playUrl.push(eps.join('#'));
            } else {
                playUrl.push('');
            }
        }
    }

    var vod_play_from = playFrom.join('$$$');
    var vod_play_url = playUrl.join('$$$');

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
    var url = host + "/vodsearch/" + encodeURIComponent(wd) + "-------------/" + (page > 1 ? "page/" + page + "/" : "");
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
