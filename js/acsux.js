// 网站基础配置
var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// ======================== 模拟TVBox官方解析函数 ========================
/**
 * pdfa 函数：从html中提取符合选择器的元素列表（数组形式）
 * @param {string} html  要解析的HTML字符串
 * @param {string} selector  选择器（按标准写法，这里使用简单匹配方式）
 * @returns {Array} 存放outerHTML的数组
 */
function pdfa(html, selector) {
    var list = [];
    var dom = myParseDom(html);
    var elements = dom.select(selector);
    for (var i = 0; i < elements.length; i++) {
        list.push(elements[i].outerHtml());
    }
    return list;
}

/**
 * pd 函数：从html中提取符合选择器的第一个元素的内容（字符串形式）
 * @param {string} html  要解析的HTML字符串
 * @param {string} selector  选择器（按标准写法，这里使用简单匹配方式）
 * @returns {string} 匹配到的第一个元素的outerHTML
 */
function pd(html, selector) {
    var elements = pdfa(html, selector);
    if (elements && elements.length > 0) {
        return elements[0];
    }
    return "";
}

/**
 * myParseDom：一个简单的DOM解析器，用于支持pdfa和pd函数的选择器功能。
 * 注意：TVBox环境可能自行提供了更强大的解析器，这里的实现作为兼容。
 * 若环境本身不支持，本函数可确保基础选择器运行。
 */
function myParseDom(html) {
    return {
        select: function(selector) {
            var results = [];
            var regex;
            // 兼容 .module-item 和 .module-card-item 这类常见类选择器
            if (selector === ".module-item,.module-card-item") {
                regex = /<a[^>]*class="[^"]*module-poster-item[^"]*"[^>]*>[\s\S]*?<\/a>/g;
            } else {
                // 简单处理单个类选择器，例如 .module-item-note
                var className = selector.replace(/\./g, '');
                if (className) {
                    regex = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'g');
                } else {
                    regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'g');
                }
            }
            var match;
            while ((match = regex.exec(html)) !== null) {
                results.push({outerHtml: function() { return match[0]; }});
            }
            return results;
        }
    };
}

/**
 * req 函数：发起网络请求，支持超时和重试
 */
async function req(url, options = {}, timeout = 8000, retry = 2) {
    for (var i = 0; i <= retry; i++) {
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(() => controller.abort(), timeout);
            var res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            var content = await res.text();
            return {content: content, statusCode: res.status};
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

/**
 * getList 函数：从HTML中提取视频列表
 * 通过选择器匹配.a模块，提取href和标题、图片等信息
 */
function getList(html) {
    var videos = [];
    var items = pdfa(html, ".module-item,.module-card-item");
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var idMatch = it.match(/href="\/dt\/(\d+)\.html/);
        var nameMatch = it.match(/title="([^"]+)"/) || it.match(/alt="([^"]+)"/);
        var picMatch = it.match(/data-original="([^"]+)"/) || it.match(/src="([^"]+)"/);
        var noteMatch = it.match(/<div class="module-item-note">([\s\S]*?)<\/div>/);
        if (idMatch && nameMatch) {
            var pic = picMatch ? (picMatch[1] || picMatch[2] || "") : "";
            var remark = noteMatch ? noteMatch[1].replace(/<[^>]*>/g, "").trim() : "";
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<[^>]*>/g, "").trim(),
                "vod_pic": pic.startsWith('/') ? host + pic : pic,
                "vod_remarks": remark
            });
        }
    }
    return videos;
}

/**
 * 搜索列表提取：用于搜索结果，因搜索页面结构与分类不同
 */
function getSearchList(html) {
    var videos = [];
    var seen = new Set();
    var items = html.match(/<a[^>]+href="\/dt\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g);
    if (items) {
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var idMatch = it.match(/\/dt\/(\d+)\.html/);
            var nameMatch = it.match(/alt="([^"]+)"/);
            if (idMatch && nameMatch && !seen.has(idMatch[1])) {
                seen.add(idMatch[1]);
                videos.push({
                    "vod_id": idMatch[1],
                    "vod_name": nameMatch[1],
                    "vod_pic": "",
                    "vod_remarks": ""
                });
            }
        }
    }
    return videos;
}

// ======================== TVBox标准接口函数 ========================
async function init(cfg) {
    return;
}

/**
 * home 函数：返回分类信息
 */
async function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id": "2", "type_name": "电影"},
            {"type_id": "1", "type_name": "剧集"},
            {"type_id": "3", "type_name": "动漫"},
            {"type_id": "4", "type_name": "综艺"}
        ],
        "filters": {}
    });
}

/**
 * homeVod 函数：获取首页推荐/最新视频
 */
async function homeVod() {
    var resp = await req(host, {headers: headers});
    var list = getList(resp.content);
    return JSON.stringify({list: list});
}

/**
 * category 函数：获取分类列表
 * @param {string} tid  分类ID
 * @param {number} pg   页码
 */
async function category(tid, pg, filter, extend) {
    var p = pg || 1;
    var url = host + '/cp/' + tid + (p > 1 ? '/page/' + p + '.html' : '.html');
    var resp = await req(url, {headers: headers});
    var list = getList(resp.content);
    return JSON.stringify({list: list, page: parseInt(p)});
}

/**
 * detail 函数：获取视频详情页信息，提取播放列表
 */
async function detail(id) {
    var url = host + '/dt/' + id + '.html';
    var resp = await req(url, {headers: headers});
    var html = resp.content;
    
    // 提取名称
    var name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ["", ""])[1];
    // 提取图片
    var pic = (html.match(/data-original="([^"]+)"/) || html.match(/src="([^"]+\.(jpg|png|jpeg))"/) || ["", ""])[1];
    if (pic && pic.startsWith('/')) pic = host + pic;
    // 提取简介
    var content = (html.match(/<meta name="description" content="([^"]+)"/) || ["", ""])[1];
    // 提取播放源和播放列表
    var playFrom = "线路";
    var playUrl = "";
    
    // 方式1：匹配 onclick 的 play 链接
    var eps = [];
    var epReg = /onclick="location\.replace\('\/play\/([^']+)'\)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
    var ep;
    while ((ep = epReg.exec(html)) !== null) {
        eps.push(ep[2] + '$' + ep[1]);
    }
    if (eps.length > 0) {
        playUrl = eps.join('#');
    } else {
        // 方式2：直接匹配 m3u8 链接
        var m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8/);
        if (m3u8Match) {
            playUrl = "播放$" + m3u8Match[0];
        }
    }
    
    return JSON.stringify({
        "list": [{
            "vod_id": id,
            "vod_name": name,
            "vod_pic": pic,
            "vod_content": content,
            "vod_play_from": playFrom,
            "vod_play_url": playUrl
        }]
    });
}

/**
 * play 函数：获取具体播放地址
 */
async function play(flag, id, flags) {
    var url = host + '/play/' + id;
    var resp = await req(url, {headers: headers});
    var html = resp.content;
    var m3u8 = html.match(/https?:\/\/[^"'\s>]+\.m3u8/);
    if (m3u8) {
        return JSON.stringify({parse: 0, url: m3u8[0]});
    }
    var iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (iframe) {
        return JSON.stringify({parse: 1, url: iframe[1]});
    }
    return JSON.stringify({parse: 1, url: url});
}

/**
 * search 函数：搜索视频
 */
async function search(wd, quick, pg) {
    var p = pg || 1;
    var searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html' + (p > 1 ? '/page/' + p + '.html' : '');
    var resp = await req(searchUrl, {headers: headers});
    var list = getSearchList(resp.content);
    return JSON.stringify({list: list});
}
