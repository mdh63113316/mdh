// 站点基础信息
var host = 'https://www.ylys.tv';
var headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36",
    "Referer": host + "/"
};

// 请求封装（同步）
function fetchUrl(url) {
    var result = request(url, { headers: headers, method: 'GET' });
    return result ? result.content : '';
}

// 从HTML中提取视频列表（兼容多种列表页）

function getList(html) {
    var videos = [];
    // 尝试匹配不同结构的数据源
    var items = html.match(/<div[^>]*class="[^"]*module-item[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (items === null) {
        items = html.match(/<div[^>]*class="[^"]*fed-list-item[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    }
    if (items === null) {
        return videos;
    }
    // 遍历最多40个项目
    var maxItems = items.length > 40 ? 40 : items.length;
    for (var i = 0; i < maxItems; i++) {
        var it = items[i];
        // 提取详情页链接和ID
        var linkMatch = it.match(/href="\/(?:voddetail|detail)\/(\d+)/i);
        if (linkMatch === null) continue;
        var vod_id = linkMatch[1];
        // 提取名称
        var nameMatch = it.match(/title="([^"]+)"/i) || it.match(/alt="([^"]+)"/i) || it.match(/<strong>([^<]+)<\/strong>/i);
        var vod_name = nameMatch ? nameMatch[1] : '';
        // 提取封面
        var picMatch = it.match(/data-original="([^"]+)"/i) || it.match(/src="([^"]+)"/i);
        var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';
        // 提取备注
        var remarkMatch = it.match(/<div[^>]*class="[^"]*note[^"]*"[^>]*>([^<]+)<\/div>/i) || it.match(/<span[^>]*class="[^"]*remarks[^"]*"[^>]*>([^<]+)<\/span>/i);
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

// 初始化
function init() {
    return JSON.stringify({});
}

// 首页分类
function home(filter) {
    var classes = [
        {"type_id": "1", "type_name": "电影"},
        {"type_id": "2", "type_name": "剧集"},
        {"type_id": "3", "type_name": "综艺"},
        {"type_id": "4", "type_name": "动漫"}
    ];
    return JSON.stringify({
        "class": classes,
        "filters": {}
    });
}

// 首页推荐
function homeVod() {
    var html = fetchUrl(host);
    var list = getList(html);
    return JSON.stringify({ "list": list });
}

// 分类页
function category(tid, pg, filter, extend) {
    var page = pg || 1;
    var targetId = (extend && extend.class) ? extend.class : tid;
    var url = host + "/vodtype/" + targetId + (page > 1 ? "/page/" + page + "/" : "");
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({
        "list": list,
        "page": page
    });
}

// 详情页
function detail(id) {
    var url = host + '/voddetail/' + id + '/';
    var html = fetchUrl(url);
    // 提取剧集标题
    var nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    var vod_name = nameMatch ? nameMatch[1] : '';
    // 提取海报图片
    var picMatch = html.match(/data-original="([^"]+)"/i);
    var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';
    // 提取介绍内容
    var contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<div[^>]*class="[^"]*introduction-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    var vod_content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '') : '';
    // 提取播放线路名称
    var playFromMatches = html.match(/<div[^>]*class="[^"]*module-tab-item[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi);
    var playFrom = [];
    if (playFromMatches) {
        for (var i = 0; i < playFromMatches.length; i++) {
            var spanMatch = playFromMatches[i].match(/<span>([^<]+)<\/span>/);
            if (spanMatch) playFrom.push(spanMatch[1]);
        }
    }
    if (playFrom.length === 0) playFrom.push("默认线路");
    // 提取播放链接
    var playUrl = [];
    var playListBlocks = html.match(/<div[^>]*class="[^"]*module-play-list[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (playListBlocks) {
        for (var j = 0; j < playListBlocks.length && j < playFrom.length; j++) {
            var block = playListBlocks[j];
            var links = block.match(/<a[^>]*href="\/(?:play|vodplay)\/([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi);
            var eps = [];
            if (links) {
                for (var k = links.length - 1; k >= 0; k--) {
                    var hrefMatch = links[k].match(/href="\/(?:play|vodplay)\/([^"]+)"/);
                    var spanMatch = links[k].match(/<span>([^<]+)<\/span>/);
                    if (hrefMatch) {
                        var name = spanMatch ? spanMatch[1] : (k+1);
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

// 搜索功能
function search(wd, quick, pg) {
    var page = pg || 1;
    var url = host + "/vodsearch/" + encodeURIComponent(wd) + "-------------" + (page > 1 ? "/page/" + page + "/" : "");
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({ "list": list });
}

// 播放地址解析
function play(flag, id, flags) {
    var url = host + "/play/" + id + "/";
    var html = fetchUrl(url);
    // 尝试提取 m3u8 链接
    var m3u8Match = html.match(/url:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) || html.match(/"url":"([^"]+\.m3u8[^"]*)"/i);
    if (m3u8Match) {
        var realUrl = m3u8Match[1].replace(/\\/g, '');
        return JSON.stringify({
            parse: 0,
            url: realUrl,
            header: headers
        });
    }
    // 未找到链接则返回页面自身
    return JSON.stringify({
        parse: 1,
        url: url,
        header: headers
    });
}

// TVBox 标准导出
return {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
