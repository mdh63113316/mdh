// 网站的基础地址和请求头
let host = 'https://acsux.cn';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

/**
 * 通用解析函数：用简单的 CSS 选择器来抓取网页内容。
 * 这是修复后的核心，替代了原来复杂的正则表达式。
 */
function pdfa(html, selector) {
    let list = [];
    // 使用自定义的 myParseDom 方法来解析 HTML 字符串
    let dom = myParseDom(html);
    let elements = dom.select(selector);
    for (let i = 0; i < elements.length; i++) {
        list.push(elements[i].outerHtml());
    }
    return list;
}

/**
 * 初始化函数，TVBox 加载时会调用。
 */
async function init(cfg) {
    return;
}

/**
 * 获取首页分类列表。
 */
async function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id": "1", "type_name": "电影"},
            {"type_id": "2", "type_name": "剧集"},
            {"type_id": "3", "type_name": "动漫"},
            {"type_id": "4", "type_name": "综艺"}
        ],
        "filters": {
            "1": [{"key": "class", "name": "类型", "value": [{"n": "全部", "v": ""}, {"n": "动作片", "v": "6"}, {"n": "喜剧片", "v": "7"}, {"n": "爱情片", "v": "8"}, {"n": "科幻片", "v": "9"}, {"n": "恐怖片", "v": "11"}]}],
            "2": [{"key": "class", "name": "类型", "value": [{"n": "全部", "v": ""}, {"n": "国产剧", "v": "13"}, {"n": "港台剧", "v": "14"}, {"n": "日剧", "v": "15"}, {"n": "韩剧", "v": "33"}, {"n": "欧美剧", "v": "16"}]}]
        }
    });
}

/**
 * 获取首页推荐或最新视频列表。
 */
async function homeVod() {
    let resp = await req(host, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}

/**
 * 根据分类和页码获取视频列表。
 */
async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let targetId = (extend && extend.class) ? extend.class : tid;
    let url = host + "/vodtype/" + targetId + "/" + (parseInt(p) > 1 ? "page/" + p + "/" : "");
    let resp = await req(url, {headers: headers});
    return JSON.stringify({"list": getList(resp.content), "page": parseInt(p)});
}

/**
 * 从网页中提取视频列表的通用函数。
 */
function getList(html) {
    let videos = [];
    // 使用 CSS 选择器定位每个视频项
    let items = pdfa(html, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/detail\/(\d+)/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/(.*?)<\/strong>/);
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || picMatch[2]) : "";
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<.*?>/g, ""),
                "vod_pic": pic.startsWith('/') ? host + pic : pic,
                "vod_remarks": (it.match(/module-item-note">(.*?)<\/div>/) || ["", ""])[1].replace(/<.*?>/g, "")
            });
        }
    });
    return videos;
}

/**
 * 获取视频的详情页信息。
 */
async function detail(id) {
    let url = host + '/detail/' + id + '/';
    let resp = await req(url, {headers: headers});
    let html = resp.content;
    let playUrl = "";
    // 在详情页中寻找播放链接
    let iframeMatch = html.match(/<iframe[^>]*src="([^"]*)"/);
    if (iframeMatch) {
        playUrl = iframeMatch[1];
    } else {
        let linkMatch = html.match(/<a[^>]*href="([^"]*)"[^>]*>立即播放</);
        if (linkMatch) {
            playUrl = linkMatch[1];
        }
    }
    if (playUrl && !playUrl.startsWith('http')) {
        playUrl = host + playUrl;
    }
    return JSON.stringify({
        "vod_id": id,
        "vod_name": "",
        "vod_pic": "",
        "type_name": "",
        "vod_actor": "",
        "vod_director": "",
        "vod_content": "",
        "vod_play_from": "acsux",
        "vod_play_url": "播放$" + playUrl
    });
}

/**
 * 获取视频的播放地址。
 */
async function play(flag, id, flags) {
    let url = host + '/detail/' + id + '/';
    let resp = await req(url, {headers: headers});
    let html = resp.content;
    let playUrl = "";
    let iframeMatch = html.match(/<iframe[^>]*src="([^"]*)"/);
    if (iframeMatch) {
        playUrl = iframeMatch[1];
    } else {
        let linkMatch = html.match(/<a[^>]*href="([^"]*)"[^>]*>立即播放</);
        if (linkMatch) {
            playUrl = linkMatch[1];
        }
    }
    if (playUrl && !playUrl.startsWith('http')) {
        playUrl = host + playUrl;
    }
    return JSON.stringify({
        "parse": 0,
        "url": playUrl
    });
}

/**
 * 搜索视频。
 */
async function search(wd, quick) {
    let url = host + '/search/' + encodeURIComponent(wd) + '/';
    let resp = await req(url, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}

/**
 * 辅助函数：解析 HTML 字符串为 DOM 对象。
 * 这里为了示例，做了简单实现，实际可能需要更完善的处理。
 */
function myParseDom(html) {
    return {
        select: function(selector) {
            let results = [];
            let regex;
            if (selector === ".module-item,.module-card-item") {
                regex = /<div[^>]*class="[^"]*module-item[^"]*"[^>]*>[\s\S]*?<\/div>/g;
            } else {
                regex = new RegExp(`<${selector.replace(/\./g, '')}[^>]*>[\s\S]*?<\/${selector.replace(/\./g, '')}>`, 'g');
            }
            let match;
            while ((match = regex.exec(html)) !== null) {
                results.push({outerHtml: () => match[0]});
            }
            return results;
        }
    };
}

/**
 * 通用请求函数，支持超时和重试。
 */
async function req(url, options = {}, timeout = 10000, retry = 2) {
    let controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeout);
    for (let i = 0; i <= retry; i++) {
        try {
            let res = await fetch(url, {...options, signal: controller.signal});
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            let content = await res.text();
            return {content: content, statusCode: res.status};
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
