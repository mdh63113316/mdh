// 热播影视网 TVBox 爬虫 - 适用于 https://acsux.cn
// 完全兼容 TVBox 标准，已在安卓4设备测试通过

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

// 从 HTML 中提取视频列表
function getList(html) {
    var videos = [];
    // 匹配视频卡片（支持苹果CMS标准结构）
    var items = html.match(/<a[^>]*class="[^"]*module-item[^"]*"[^>]*>[\s\S]*?<\/a>/gi);
    if (!items || items.length === 0) return videos;
    
    for (var i = 0; i < items.length && i < 40; i++) {
        var it = items[i];
        // 提取详情页链接中的 ID
        var idMatch = it.match(/href="\/(?:detail|dt)\/(\d+)\.html/) || it.match(/\/detail\/(\d+)/);
        if (!idMatch) continue;
        var vod_id = idMatch[1];
        
        // 提取标题
        var nameMatch = it.match(/title="([^"]+)"/) || it.match(/alt="([^"]+)"/);
        var vod_name = nameMatch ? nameMatch[1] : '';
        
        // 提取封面图
        var picMatch = it.match(/data-original="([^"]+)"/) || it.match(/src="([^"]+)"/);
        var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';
        
        // 提取备注（集数/状态）
        var remarkMatch = it.match(/module-item-note">([^<]+)<\/div>/);
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
function home() {
    var classes = [
        {"type_id": "1", "type_name": "今日更新"},
        {"type_id": "2", "type_name": "电影"},
        {"type_id": "3", "type_name": "电视剧"},
        {"type_id": "4", "type_name": "综艺"},
        {"type_id": "5", "type_name": "动漫"}
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

// 分类页列表
function category(tid, pg) {
    var page = pg || 1;
    var targetId = tid;
    var url = host + "/channel/" + targetId + ".html";
    if (page > 1) url = host + "/index.php/vod/type/id/" + targetId + "/page/" + page + ".html";
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({
        "list": list,
        "page": page
    });
}

// 详情页
function detail(id) {
    var url = host + '/detail/' + id + '.html';
    var html = fetchUrl(url);
    
    // 提取标题
    var nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    var vod_name = nameMatch ? nameMatch[1] : '';
    
    // 提取封面
    var picMatch = html.match(/data-original="([^"]+)"/);
    var vod_pic = picMatch ? (picMatch[1].startsWith('http') ? picMatch[1] : host + picMatch[1]) : '';
    
    // 提取简介
    var contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    var vod_content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '') : '';
    
    // 播放线路名称
    var playFromMatches = html.match(/<div[^>]*class="[^"]*module-tab-item[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi);
    var playFrom = [];
    if (playFromMatches) {
        for (var i = 0; i < playFromMatches.length; i++) {
            var spanMatch = playFromMatches[i].match(/<span>([^<]+)<\/span>/);
            if (spanMatch) playFrom.push(spanMatch[1]);
        }
    }
    if (playFrom.length === 0) playFrom.push("默认线路");
    
    // 播放地址列表
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
                        var name = spanMatch ? spanMatch[1] : (k + 1);
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

// 搜索
function search(wd, pg) {
    var page = pg || 1;
    var url = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (page > 1) url = host + '/index.php/vod/search/page/' + page + '/wd/' + encodeURIComponent(wd) + '.html';
    var html = fetchUrl(url);
    var list = getList(html);
    return JSON.stringify({ "list": list });
}

// 播放地址解析
function play(flag, id) {
    var url = host + "/play/" + id + ".html";
    var html = fetchUrl(url);
    // 提取 m3u8 地址
    var m3u8Match = html.match(/url:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) || 
                     html.match(/"url":"([^"]+\.m3u8[^"]*)"/i);
    if (m3u8Match) {
        var realUrl = m3u8Match[1].replace(/\\/g, '');
        return JSON.stringify({
            parse: 0,
            url: realUrl,
            header: headers
        });
    }
    // 未找到则返回播放页
    return JSON.stringify({
        parse: 1,
        url: url,
        header: headers
    });
}

// 导出所有函数
return {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    search: search,
    detail: detail,
    play: play
};
