let host = 'https://www.hhkan0.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 调试开关：设置为 true 时会在控制台输出日志（需要 TVBox 支持）
let DEBUG = false;

function log(msg) {
    if (DEBUG) console.log(msg);
}

async function init(cfg) {}

/**
 * 增强版列表解析：支持多种 CMS 结构
 */
function getList(html) {
    let videos = [];
    // 尝试多种可能的视频卡片选择器
    let selectors = [
        ".module-item",           // 苹果CMS 默认
        ".fed-list-item",         // 飞飞CMS 常用
        ".myui-vodlist__box",     // 海洋CMS
        ".video-item",            // 通用
        ".vodlist_item",          // 另一种
        ".stui-vodlist__box"      // 第一弹模板
    ];
    let items = null;
    for (let sel of selectors) {
        items = pdfa(html, sel);
        if (items && items.length > 0) {
            log(`使用选择器 ${sel} 匹配到 ${items.length} 项`);
            break;
        }
    }
    if (!items || items.length === 0) {
        log("未匹配到任何视频卡片，请检查页面结构");
        return videos;
    }

    items.forEach(it => {
        // 提取详情页链接中的 ID（支持多种模式）
        let idMatch = it.match(/\/voddetail\/(\d+)/) ||
                      it.match(/\/detail\/(\d+)/) ||
                      it.match(/\/show\/(\d+)/) ||
                      it.match(/\/movie\/(\d+)/) ||
                      it.match(/\/video\/(\d+)/) ||
                      it.match(/href="\/(?:index\/)?vod\/detail\/id\/(\d+)\.html/);
        // 提取标题
        let nameMatch = it.match(/title="(.*?)"/) ||
                        it.match(/alt="(.*?)"/) ||
                        it.match(/<strong>(.*?)<\/strong>/) ||
                        it.match(/<a[^>]*>([^<]+)<\/a>/);
        // 提取封面图
        let picMatch = it.match(/data-original="(.*?)"/) ||
                       it.match(/data-src="(.*?)"/) ||
                       it.match(/src="(.*?)"/);
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || "") : "";
            let vod_pic = pic;
            if (pic && pic.startsWith('/')) vod_pic = host + pic;
            // 备注（集数/更新）
            let remark = (it.match(/module-item-note\">(.*?)<\/div>/) ||
                          it.match(/remarks">(.*?)<\/span>/) ||
                          it.match(/<span class="note">(.*?)<\/span>/) ||
                          it.match(/<div class="note">(.*?)<\/div>/) ||
                          ["", ""])[1].replace(/<.*?>/g, "");
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<.*?>/g, ""),
                "vod_pic": vod_pic,
                "vod_remarks": remark
            });
        } else {
            log("视频项解析失败: " + (it.length > 100 ? it.substr(0,100) : it));
        }
    });
    return videos;
}

async function home(filter) {
    // 分类可以从首页动态获取，但为了稳定先硬编码（可根据网站实际分类修改）
    // 建议运行一次后查看首页侧边栏，替换为真实分类
    return JSON.stringify({
        "class": [
            {"type_id":"1","type_name":"电影"},
            {"type_id":"2","type_name":"电视剧"},
            {"type_id":"3","type_name":"综艺"},
            {"type_id":"4","type_name":"动漫"},
            {"type_id":"5","type_name":"纪录片"},
            {"type_id":"6","type_name":"短剧"}
        ],
        "filters": {}
    });
}

async function homeVod() {
    let resp = await req(host, { headers: headers });
    log("首页长度：" + (resp.content ? resp.content.length : 0));
    let list = getList(resp.content);
    log("首页解析到 " + list.length + " 条数据");
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let targetId = (extend && extend.class) ? extend.class : tid;
    // 支持多种分页格式：/vodtype/1/ 或 /vodtype/1.html 或 /index.php?m=vod-list-id-1-pg-2
    let url = host + "/vodtype/" + targetId + (parseInt(p) > 1 ? "/page/" + p + "/" : "");
    // 如果上面构造的url无效，也可以尝试添加 .html
    let resp = await req(url, { headers: headers });
    if (!resp.content || resp.content.length < 100) {
        // 降级尝试带 .html 的url
        let altUrl = host + "/vodtype/" + targetId + (parseInt(p) > 1 ? "-" + p : "") + ".html";
        resp = await req(altUrl, { headers: headers });
    }
    let list = getList(resp.content);
    return JSON.stringify({ 
        "list": list, 
        "page": parseInt(p) 
    });
}

async function detail(id) {
    let url = host + '/voddetail/' + id + '/';
    let resp = await req(url, { headers: headers });
    let html = resp.content;
    if (!html || html.length === 0) {
        // 尝试其他url模式
        let altUrl = host + '/vod/' + id + '.html';
        resp = await req(altUrl, { headers: headers });
        html = resp.content;
    }
    if (!html) return JSON.stringify({ list: [] });
    
    // 播放线路名称（多选择器）
    let playFrom = [];
    let tabItems = pdfa(html, ".module-tab-item");
    if (!tabItems || tabItems.length === 0) {
        tabItems = pdfa(html, ".play-source-tab li");
    }
    if (!tabItems || tabItems.length === 0) {
        tabItems = pdfa(html, ".stui-pannel__head .stui-pannel__title");
    }
    if (tabItems && tabItems.length > 0) {
        tabItems.forEach(it => {
            let match = it.match(/<span>(.*?)<\/span>/) || it.match(/<a[^>]*>(.*?)<\/a>/);
            playFrom.push(match ? match[1].trim() : "线路");
        });
    }
    if (playFrom.length === 0) playFrom.push("默认线路");
    
    // 播放地址列表（多选择器）
    let playUrl = [];
    let playLists = pdfa(html, ".module-play-list-content");
    if (!playLists || playLists.length === 0) {
        playLists = pdfa(html, ".play-list");
    }
    if (!playLists || playLists.length === 0) {
        playLists = pdfa(html, ".vodplaylist");
    }
    if (playLists && playLists.length > 0) {
        playLists.forEach(list => {
            let links = pdfa(list, "a");
            let eps = [];
            if (links && links.length > 0) {
                links.forEach(a => {
                    let nameMatch = a.match(/<span>(.*?)<\/span>/) || a.match(/title="(.*?)"/);
                    let linkMatch = a.match(/href="\/(?:play|vodplay)\/([^"]+)"/) ||
                                    a.match(/href="\/(?:index\/)?vod\/play\/id\/(\d+)\.html/);
                    if (linkMatch) {
                        let name = nameMatch ? nameMatch[1] : "播放";
                        eps.push(name + '$' + linkMatch[1]);
                    }
                });
            }
            if (eps.length > 0) playUrl.push(eps.join('#'));
        });
    }
    
    // 如果仍未取到，尝试直接从页面提取 iframe 嵌入的播放器地址（某些站用播放器调用）
    if (playUrl.length === 0) {
        let iframe = html.match(/<iframe[^>]+src="([^"]+)"[^>]*>/);
        if (iframe && iframe[1]) {
            playFrom = ["默认线路"];
            playUrl = ["1$" + iframe[1]];
        }
    }
    
    // 基本信息
    let vod_name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ["", ""])[1];
    let vod_pic = (html.match(/data-original="([^"]+)"/) || ["", ""])[1];
    let vod_content = (html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || ["", ""])[1];
    if (vod_content) vod_content = vod_content.replace(/<[^>]+>/g, '');
    
    return JSON.stringify({
        list: [{
            'vod_id': id,
            'vod_name': vod_name,
            'vod_pic': vod_pic,
            'vod_content': vod_content,
            'vod_play_from': playFrom.join('$$$'),
            'vod_play_url': playUrl.join('$$$')
        }]
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + "/vodsearch/" + encodeURIComponent(wd) + "-------------/" + (parseInt(p) > 1 ? "page/" + p + "/" : "");
    let resp = await req(url, { headers: headers });
    let list = getList(resp.content);
    // 如果没搜到，尝试使用 /search.php?keyword=xxx 格式
    if (list.length === 0) {
        let altUrl = host + "/search.php?keyword=" + encodeURIComponent(wd) + "&page=" + p;
        resp = await req(altUrl, { headers: headers });
        list = getList(resp.content);
    }
    return JSON.stringify({ list: list });
}

async function play(flag, id, flags) {
    let url = host + "/play/" + id + "/";
    let resp = await req(url, { headers: headers });
    let html = resp.content;
    // 尝试提取 m3u8 地址（常见几种格式）
    let m3u8 = html.match(/"url":"([^"]+\.m3u8)"/) ||
               html.match(/url:\s*['"]([^'"]+\.m3u8)['"]/) ||
               html.match(/<source src="([^"]+\.m3u8)"/) ||
               html.match(/file:\s*['"]([^'"]+\.m3u8)['"]/);
    if (m3u8 && m3u8[1]) {
        let realUrl = m3u8[1].replace(/\\/g, "");
        // 处理相对路径
        if (realUrl.startsWith('//')) realUrl = 'https:' + realUrl;
        if (realUrl.startsWith('/')) realUrl = host + realUrl;
        return JSON.stringify({ parse: 0, url: realUrl, header: headers });
    }
    // 未找到则返回播放页，让 TVBox 尝试解析
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
