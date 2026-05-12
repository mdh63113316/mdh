let host = 'https://www.ylys.tv';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

async function init(cfg) {}

/**
 * 通用解析：从 HTML 中提取视频列表
 */
function getList(html) {
    let videos = [];
    // ylys.tv 使用 .module-item 作为视频卡片容器
    let items = pdfa(html, ".module-item");
    items.forEach(it => {
        // 提取详情页链接中的 ID (支持 /voddetail/123/ 或 /detail/123/)
        let idMatch = it.match(/\/voddetail\/(\d+)/) || it.match(/\/detail\/(\d+)/);
        // 提取标题（优先取 title 属性，其次取 <strong> 或 <a> 文本）
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/<strong>(.*?)<\/strong>/) || it.match(/<a[^>]*>([^<]+)<\/a>/);
        // 提取封面图
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || "") : "";
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<.*?>/g, ""),
                "vod_pic": pic.startsWith('http') ? pic : (pic.startsWith('/') ? host + pic : pic),
                "vod_remarks": (it.match(/module-item-note\">(.*?)<\/div>/) || ["", ""])[1].replace(/<.*?>/g, "")
            });
        }
    });
    return videos;
}

async function home(filter) {
    // 分类映射（根据 ylys.tv 的实际分类ID填写，此处为常见苹果CMS默认值）
    return JSON.stringify({
        "class": [
            {"type_id":"1","type_name":"电影"},
            {"type_id":"2","type_name":"电视剧"},
            {"type_id":"3","type_name":"综艺"},
            {"type_id":"4","type_name":"动漫"},
            {"type_id":"5","type_name":"纪录片"}
        ],
        "filters": {}   // 如需筛选可添加，此处留空
    });
}

async function homeVod() {
    let resp = await req(host, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    // 如果有筛选扩展，则使用扩展中的分类ID
    let targetId = (extend && extend.class) ? extend.class : tid;
    let url = host + "/vodtype/" + targetId + (parseInt(p) > 1 ? "/page/" + p + "/" : "");
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ 
        "list": getList(resp.content), 
        "page": parseInt(p) 
    });
}

async function detail(id) {
    let url = host + '/voddetail/' + id + '/';
    let resp = await req(url, { headers: headers });
    let html = resp.content;
    
    // 播放线路名称
    let playFrom = pdfa(html, ".module-tab-item").map(it => {
        return (it.match(/<span>(.*?)<\/span>/) || ["", "默认线路"])[1];
    }).join('$$$');
    
    // 播放地址列表（按线路分组）
    let playUrl = pdfa(html, ".module-play-list-content").map(list => {
        return pdfa(list, "a").map(a => {
            let name = (a.match(/<span>(.*?)<\/span>/) || ["", "第" + (i+1) + "集"])[1];
            let link = a.match(/href="\/play\/([^"]+)"/) || a.match(/href="\/vodplay\/([^"]+)"/);
            return name + '$' + (link ? link[1] : "");
        }).join('#');
    }).join('$$$');
    
    // 如果上面没取到播放源，尝试备用选择器
    if (!playFrom || playFrom === "$$$") {
        playFrom = "默认线路";
        let altLinks = pdfa(html, ".play-list a");
        if (altLinks.length > 0) {
            playUrl = altLinks.map(a => {
                let name = (a.match(/<span>(.*?)<\/span>/) || ["", "播放"])[1];
                let link = a.match(/href="\/(?:play|vodplay)\/([^"]+)"/);
                return name + '$' + (link ? link[1] : "");
            }).join('#');
        } else {
            playUrl = "";
        }
    }
    
    // 提取其他详情信息
    let vod_name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ["", ""])[1];
    let vod_pic = (html.match(/data-original="([^"]+)"/) || ["", ""])[1];
    let vod_content = (html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || ["", ""])[1];
    vod_content = vod_content.replace(/<[^>]+>/g, '');
    
    return JSON.stringify({
        list: [{
            'vod_id': id,
            'vod_name': vod_name,
            'vod_pic': vod_pic,
            'vod_content': vod_content,
            'vod_play_from': playFrom,
            'vod_play_url': playUrl
        }]
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + "/vodsearch/" + encodeURIComponent(wd) + "-------------/" + (parseInt(p) > 1 ? "page/" + p + "/" : "");
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function play(flag, id, flags) {
    let url = host + "/play/" + id + "/";
    let resp = await req(url, { headers: headers });
    // 尝试提取 m3u8 地址
    let m3u8 = resp.content.match(/"url":"([^"]+\.m3u8)"/) || 
               resp.content.match(/url:\s*['"]([^'"]+\.m3u8)['"]/);
    if (m3u8) {
        let realUrl = m3u8[1].replace(/\\/g, "");
        return JSON.stringify({ parse: 0, url: realUrl, header: headers });
    }
    // 未找到则返回播放页，由 TVBox 内部解析
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
