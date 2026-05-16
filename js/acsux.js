// ========== 诊断增强版 - 用于 acsux.cn ==========
let host = 'https://acsux.cn';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3"
};

// ----- 通用辅助函数 -----
async function req(url, options = {}, timeout = 8000, retry = 2) {
    // 简化版请求，不用AbortController（部分TVBox环境不支持）
    for (let i = 0; i <= retry; i++) {
        try {
            let res = await fetch(url, { ...options, redirect: 'follow' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            let content = await res.text();
            return { content, statusCode: res.status };
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// 多模式提取视频列表
function extractVideos(html, url) {
    let videos = [];
    let debugInfo = [];

    // 模式1：原acsux.js中的正则（/detail/数字）
    let detailMatches = [...html.matchAll(/href="\/detail\/(\d+)/g)];
    if (detailMatches.length > 0) {
        debugInfo.push(`模式1命中: /detail/ 条目 ${detailMatches.length}`);
        detailMatches.forEach(m => {
            let id = m[1];
            let name = '';
            let pic = '';
            // 尝试从附近提取标题和图片
            let block = html.substring(Math.max(0, m.index - 300), m.index + 300);
            let nameMatch = block.match(/alt="([^"]+)"/) || block.match(/title="([^"]+)"/) || block.match(/>([^<]+)<\/a>/);
            if (nameMatch) name = nameMatch[1];
            let picMatch = block.match(/src="([^"]+\.(jpg|png|jpeg))"/) || block.match(/data-original="([^"]+)"/);
            if (picMatch) pic = picMatch[1];
            if (name) videos.push({ vod_id: id, vod_name: name, vod_pic: pic.startsWith('http') ? pic : host + pic });
        });
        if (videos.length) return { videos, debugInfo };
    }

    // 模式2：常见苹果CMS模块 .module-item 或 .video-item
    let items = [...html.matchAll(/<a[^>]*class="[^"]*(?:module-item|video-item|poster-item)[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/gi)];
    if (items.length > 0) {
        debugInfo.push(`模式2命中: 模块类 条目 ${items.length}`);
        items.forEach(m => {
            let href = m[1];
            let idMatch = href.match(/\/(\d+)\.html/);
            if (idMatch) {
                videos.push({
                    vod_id: idMatch[1],
                    vod_name: m[3].trim(),
                    vod_pic: m[2].startsWith('http') ? m[2] : host + m[2]
                });
            }
        });
        if (videos.length) return { videos, debugInfo };
    }

    // 模式3：通用链接匹配（任何包含数字的detail链接）
    let anyLink = [...html.matchAll(/href="\/(?:detail|vod|video|show)\/(\d+)/gi)];
    if (anyLink.length > 0) {
        debugInfo.push(`模式3命中: 任意详情链接 条目 ${anyLink.length}`);
        anyLink.forEach(m => {
            let id = m[1];
            let name = '';
            let pic = '';
            let block = html.substring(Math.max(0, m.index - 200), m.index + 200);
            let nameMatch = block.match(/alt="([^"]+)"/) || block.match(/title="([^"]+)"/);
            if (nameMatch) name = nameMatch[1];
            let picMatch = block.match(/src="([^"]+\.(jpg|png))"/);
            if (picMatch) pic = picMatch[1];
            if (name) videos.push({ vod_id: id, vod_name: name, vod_pic: pic.startsWith('http') ? pic : host + pic });
        });
        if (videos.length) return { videos, debugInfo };
    }

    // 如果以上都失败，保存前1000字符的HTML到debugInfo以便分析
    debugInfo.push(`提取失败，HTML片段: ${html.substring(0, 1000)}`);
    return { videos, debugInfo };
}

// ----- TVBox 接口 -----
async function init(cfg) { return; }

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: "1", type_name: "电影" },
            { type_id: "2", type_name: "剧集" },
            { type_id: "3", type_name: "动漫" }
        ],
        filters: {}
    });
}

async function homeVod() {
    let resp = await req(host, { headers });
    let { videos, debugInfo } = extractVideos(resp.content, host);
    // 这里无法输出debugInfo到TVBox，但你可以把它写进一个本地文件（如果支持）
    return JSON.stringify({ list: videos });
}

async function category(tid, pg, filter, extend) {
    let page = pg || 1;
    // 尝试多种可能的分类页URL格式
    let urls = [
        `${host}/vodtype/${tid}/${page > 1 ? `page/${page}/` : ''}`,
        `${host}/vod/show/id/${tid}/page/${page}.html`,
        `${host}/index.php/vod/type/id/${tid}/page/${page}.html`,
        `${host}/type/${tid}/${page}.html`
    ];
    let resp = null;
    for (let url of urls) {
        try {
            resp = await req(url, { headers });
            if (resp.content && resp.content.includes('class="module"')) break;
        } catch(e) {}
    }
    if (!resp) return JSON.stringify({ list: [] });
    let { videos } = extractVideos(resp.content, host);
    return JSON.stringify({ list: videos, page: page, pagecount: page + 1 });
}

async function detail(id) {
    let url = `${host}/detail/${id}`;
    let resp = await req(url, { headers });
    let html = resp.content;
    let name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || '';
    let pic = (html.match(/data-original="([^"]+)"/) || html.match(/src="([^"]+\.(jpg|png))"/))?.[1] || '';
    let content = (html.match(/<p[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
    // 提取播放链接（iframe或直接m3u8）
    let playUrl = '';
    let iframe = html.match(/<iframe[^>]*src="([^"]+)"/);
    if (iframe) playUrl = iframe[1];
    else {
        let m3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8/);
        if (m3u8) playUrl = m3u8[0];
        else {
            let playLink = html.match(/onclick="location\.replace\('([^']+)'\)"/);
            if (playLink) playUrl = host + playLink[1];
        }
    }
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: name,
            vod_pic: pic.startsWith('http') ? pic : host + pic,
            vod_content: content.replace(/<[^>]*>/g, ''),
            vod_play_from: '直接播放',
            vod_play_url: playUrl ? `播放$${playUrl}` : ''
        }]
    });
}

async function play(flag, id, flags) {
    let url = id.startsWith('http') ? id : `${host}/play/${id}.html`;
    let resp = await req(url, { headers });
    let html = resp.content;
    let m3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8/);
    if (m3u8) return JSON.stringify({ parse: 0, url: m3u8[0] });
    return JSON.stringify({ parse: 1, url: url }); // 交给外部解析器
}

async function search(wd, quick, pg) {
    let page = pg || 1;
    let url = `${host}/search/${encodeURIComponent(wd)}/${page}.html`;
    let resp = await req(url, { headers });
    let { videos } = extractVideos(resp.content, host);
    return JSON.stringify({ list: videos });
}
