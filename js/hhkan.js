let host = 'https://www.hhkan1.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
};

// 调试开关：默认开启全局调试，可通过 init({debug:false}) 关闭，或在请求 URL 中加上 __raw=1
let DEBUG = true;

async function init(cfg) {
    try {
        DEBUG = !!(cfg && cfg.debug);
    } catch (e) {}
}

function cleanText(str) {
    return String(str || '').replace(/<.*?>/g, '').replace(/\s+/g, ' ').trim();
}

function resolveImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return host + url;
    return url;
}

function getPicFromAnchor(it) {
    let pic = '';
    let srcSetMatch = it.match(/(?:srcSet|srcset|data-srcset|data-lazy-srcset)=['"]([^'"]+)['"]/i);
    if (srcSetMatch) {
        let candidates = srcSetMatch[1].split(',').map(item => {
            let parts = item.trim().split(/\s+/);
            return { url: parts[0], width: parseInt(parts[1], 10) || 0 };
        }).filter(item => item.url);
        candidates.sort((a, b) => b.width - a.width);
        for (let candidate of candidates) {
            pic = resolveImageUrl(candidate.url);
            if (pic) break;
        }
    }
    if (!pic) {
        let picMatch = it.match(/(?:data-original|data-src|data-lazy-src|src)=['"]([^'"]+)['"]/i);
        if (picMatch) pic = resolveImageUrl(picMatch[1]);
    }
    return pic;
}

function getList(html) {
    let videos = [];
    let items = [];
    let seen = {};
    
    if (!html || html.length < 100) {
        return [];
    }
    
    // ========== 方案1: 用pdfa选择器 ==========
    try {
        items = pdfa(html, ".module-item,.movie-card,.vod-item,.vod-card,.video-item,li[data-id]");
    } catch (e) {}
    
    if (items && items.length > 0) {
        items.forEach(function(it) {
            let idMatch = it.match(/data-id=["']([^"']+)["']|href=["']([^"']*\/(?:detail|vod|view)\/([^\/\?&'"]+)[^"']*)["']/i);
            if (!idMatch) return;
            
            let id = idMatch[1] || idMatch[3];
            if (!id) return;
            id = String(id).split('.')[0];
            if (!id || id.length === 0) return;
            
            let titleMatch = it.match(/title=["']([^"']+)["']/i) || it.match(/alt=["']([^"']+)["']/i) || it.match(/>([^<]{2,100})<\/a>/);
            let name = titleMatch ? cleanText(titleMatch[1]) : '';
            if (!name || name.length < 2) return;
            
            let pic = getPicFromAnchor(it);
            if (pic && pic.startsWith('/')) pic = host + pic;
            
            let key = id + '|' + name;
            if (!seen[key]) {
                seen[key] = true;
                videos.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: '' });
            }
        });
        
        if (videos.length > 0) return videos;
    }
    
    // ========== 方案2: 纯正则提取 /detail/ 链接 ==========
    seen = {};
    let detailRegex = /href=["']([^"']*\/detail\/([^\/\?&'"]+)[^"']*)["'][^>]*>[\s\S]{0,300}?<\/a>/gi;
    let match;
    while ((match = detailRegex.exec(html)) !== null) {
        let fullLink = match[0];
        let id = String(match[2]).split('.')[0];
        if (!id || id.length === 0) continue;
        
        // 提取标题
        let titleMatch = fullLink.match(/title=["']([^"']+)["']/i) 
            || fullLink.match(/alt=["']([^"']+)["']/i)
            || fullLink.match(/<img[^>]*alt=["']([^"']+)["']/i)
            || fullLink.match(/>([^<]{2,100})<\/a>/);
        let name = titleMatch ? cleanText(titleMatch[1]) : '';
        if (!name || name.length < 2) continue;
        
        let pic = getPicFromAnchor(fullLink);
        if (pic && pic.startsWith('/')) pic = host + pic;
        
        let key = id + '|' + name;
        if (!seen[key]) {
            seen[key] = true;
            videos.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: '' });
        }
    }
    
    if (videos.length > 0) return videos;
    
    // ========== 方案3: 最后的救急方案 - 任意 <a> 标签+数字ID ==========
    seen = {};
    let allAnchorRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>[\s\S]{0,200}?<\/a>/gi;
    match = null;
    while ((match = allAnchorRegex.exec(html)) !== null) {
        let fullLink = match[0];
        let href = match[1];
        
        // 只要包含数字和 .html 的都可以
        if (href.indexOf('.html') === -1) continue;
        
        let idMatch = href.match(/(\d+)/);
        if (!idMatch) continue;
        let id = idMatch[1];
        
        // 简单验证：ID 不能太长
        if (id.length > 10) continue;
        
        let titleMatch = fullLink.match(/title=["']([^"']+)["']/i)
            || fullLink.match(/alt=["']([^"']+)["']/i)
            || fullLink.match(/>([^<]{2,100})<\/a>/);
        let name = titleMatch ? cleanText(titleMatch[1]) : ('Item_' + id);
        if (!name || name.length < 2) name = 'Item_' + id;
        
        let pic = getPicFromAnchor(fullLink);
        if (pic && pic.startsWith('/')) pic = host + pic;
        
        let key = id + '|' + name;
        if (!seen[key]) {
            seen[key] = true;
            videos.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: '' });
        }
        
        if (videos.length >= 50) break;
    }
    
    return videos;
}

async function home(filter) {
    // 如果开启调试，或通过 filter 指定 __raw，则返回首页原始 HTML 供排查
    try {
        const rawRequested = DEBUG || (filter && ((typeof filter === 'string' && filter.indexOf('__raw=1') !== -1) || filter.__raw));
        if (rawRequested) {
            // 使用 fetchList 返回原始 HTML（fetchList 支持 __raw=1）
            try {
                return await fetchList(host + '/?__raw=1');
            } catch (e) {
                // 回退到静态返回
            }
        }
    } catch (e) {}

    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影1' },
            { type_id: '2', type_name: '连续剧1' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺纪录' },
            { type_id: '6', type_name: '短剧' },
        ],
        filters: {
            '1': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '动作', v: '动作' },
                { n: '科幻', v: '科幻' },
                { n: '爱情', v: '爱情' },
                { n: '悬疑', v: '悬疑' },
                { n: '惊悚', v: '惊悚' },
            ] }],
            '2': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '都市', v: '都市' },
                { n: '古装', v: '古装' },
                { n: '剧情', v: '剧情' },
            ] }],
            '3': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '国产动漫', v: '国产动漫' },
                { n: '日本动漫', v: '日本动漫' },
                { n: '欧美动漫', v: '欧美动漫' },
            ] }],
            '4': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '真人秀', v: '真人秀' },
                { n: '音乐', v: '音乐' },
                { n: '纪实', v: '纪实' },
            ] }],
            '6': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '短片', v: '短片' },
            ] }],
        },
    });
}

function buildCategoryUrl(tid, pg, extend) {
    let url = host + '/channel/' + tid + '.html';
    if (extend && extend.class) {
        url = host + '/channel/' + tid + '.html?class=' + encodeURIComponent(extend.class);
    } else if (extend && extend.area) {
        url = host + '/channel/' + tid + '.html?area=' + encodeURIComponent(extend.area);
    } else if (extend && extend.year) {
        url = host + '/channel/' + tid + '.html?year=' + encodeURIComponent(extend.year);
    }
    let p = parseInt(pg) || 1;
    if (p > 1) {
        if (url.includes('?')) {
            // 已有查询参数，追加 page
            url += '&page=' + p;
        } else if (url.endsWith('.html')) {
            // 替换 .html 为 /page/{p}.html
            url = url.replace(/\.html$/, '/page/' + p + '.html');
        } else {
            url += '?page=' + p;
        }
    }
    return url;
}

async function fetchList(url) {
    let resp = await req(url, { headers: headers });
    let html = '';
    if (resp) {
        if (typeof resp === 'string') {
            html = resp;
        } else if (resp.content) {
            html = resp.content;
        } else if (resp.body) {
            html = resp.body;
        }
    }
    // 如果返回内容过短或可能被反爬拦截，使用浏览器回退抓取
    if (!html || html.length < 300) {
        try {
            let bh = await fetchWithBrowser(url);
            if (bh && bh.length > html.length) html = bh;
        } catch (e) {}
    }
    // 调试模式：若开启调试或 URL 指定 __raw=1，则直接返回原始 HTML 供排查
    try {
        if (DEBUG || (typeof url === 'string' && url.indexOf('__raw=1') !== -1)) {
            return JSON.stringify({ raw: html });
        }
    } catch (e) {}
    let list = getList(html);
    return JSON.stringify({ list: list });
}

async function homeVod() {
    // 尝试常见的首页路径
    let candidates = [
        host + '/channel/1.html',
        host + '/',
        host + '/index.html'
    ];
    
    for (let url of candidates) {
        try {
            let result = await fetchList(url);
            let data = JSON.parse(result);
            // 如果 fetchList 返回原始 HTML（调试模式），则直接返回
            if (data && data.raw && (DEBUG || (typeof url === 'string' && url.indexOf('__raw=1') !== -1))) {
                return result;
            }
            if (data.list && data.list.length > 0) {
                return result;
            }
        } catch (e) {}
    }
    
    return fetchList(candidates[0]);
}

async function category(tid, pg, filter, extend) {
    let url = buildCategoryUrl(tid, pg, extend);
    let result = await fetchList(url);
    try {
        let data = JSON.parse(result);
        if (data && data.raw && (DEBUG || (typeof url === 'string' && url.indexOf('__raw=1') !== -1))) {
            return result;
        }
        return JSON.stringify({ list: data.list || [], page: parseInt(pg) || 1 });
    } catch (e) {
        // 如果解析失败，直接返回 fetchList 的结果（可能已经是原始 raw）
        return result;
    }
}

async function detail(id) {
    let url = '';
    if (typeof id === 'string' && id.startsWith('http')) {
        url = id;
    } else {
        url = host + '/detail/' + id + '.html';
    }
    let resp = await req(url, { headers: headers });
    let html = '';
    if (resp) {
        if (typeof resp === 'string') {
            html = resp;
        } else if (resp.content) {
            html = resp.content;
        } else if (resp.body) {
            html = resp.body;
        }
    }

    // 调试/原始返回：如果开启 DEBUG 或 id/url 包含 __raw=1，则直接返回原始 HTML
    try {
        if (DEBUG || (typeof id === 'string' && id.indexOf('__raw=1') !== -1) || (typeof url === 'string' && url.indexOf('__raw=1') !== -1)) {
            return JSON.stringify({ raw: html });
        }
    } catch (e) {}

    let name = '';
    let nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
        || html.match(/<strong[^>]*>([^<]+)<\/strong>/i)
        || html.match(/<title>([^-]+)/i)
        || html.match(/class=["']title["'][^>]*>([^<]+)</i);
    if (nameMatch) name = cleanText(nameMatch[1]);
    if (!name) name = 'ID_' + id;
    
    let pic = '';
    let picMatch = html.match(/<meta property=['"]og:image['"] content=['"]([^'">]+)['"]/i)
        || html.match(/<img[^>]*data-original=['"]([^'">]+)['"]/i)
        || html.match(/<img[^>]*src=['"]([^'">]+)['"]/i)
        || html.match(/poster['":]?\s*[=:]?\s*["']?([^"'>\s]+\.[jpgpng]+)/i);
    if (picMatch) pic = resolveImageUrl(picMatch[1]);
    if (pic && pic.startsWith('/')) pic = host + pic;

    let content = '';
    let descMatch = html.match(/<meta name=["']description["'] content=["']([^"']+)['"]/i)
        || html.match(/<div[^>]*class=["'][^"']*(?:desc|intro|detail|content|description)[^"']*["'][^>]*>([^<]{10,500})</i)
        || html.match(/<p[^>]*class=["'][^"']*(?:desc|intro|detail|content)[^"']*["'][^>]*>([^<]{10,500})</i);
    if (descMatch) content = cleanText(descMatch[1]);

    let playUrls = [];
    let seenPlay = {};
    
    // 用 pdfa 尝试选择播放链接容器
    let playItems = [];
    try {
        playItems = pdfa(html, 'a[href*="/play/"],.module-play-list a,.play-list a,.playlist a,.episodes a,a');
    } catch (e) {
        playItems = pdfa(html, 'a') || [];
    }
    
    playItems.forEach(function(link) {
        let href = link.match(/href=["']([^"']*\/play\/[^"']*)["']/i);
        if (!href) return;
        
        let playPath = href[1];
        // 规范化 play ID
        let playId = playPath.replace(/^.*\/play\//, '').replace(/\.html.*/, '').trim();
        if (!playId) return;
        
        // 提取分集名
        let episodeName = '';
        let nameMatch = link.match(/<span[^>]*>([^<]{1,50})<\/span>/i)
            || link.match(/>([^<]{1,50})<\/a>/i);
        if (nameMatch) episodeName = cleanText(nameMatch[1]);
        if (!episodeName) episodeName = '播放';
        
        if (!seenPlay[playId]) {
            seenPlay[playId] = true;
            playUrls.push(episodeName + '$' + playId);
        }
    });
    
    // 备用：直接正则扫描所有 /play/ 链接
    if (!playUrls.length) {
        let allLinks = html.match(/href=["']([^"']*\/play\/[^"']*?)["']/gi) || [];
        allLinks.forEach(function(link) {
            let plink = link.replace(/href=["']/, '').replace(/["'].*/, '');
            let playId = plink.replace(/^.*\/play\//, '').replace(/\.html.*/, '').trim();
            if (playId && !seenPlay[playId]) {
                seenPlay[playId] = true;
                playUrls.push('播放$' + playId);
            }
        });
    }

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: cleanText(name),
            vod_pic: pic,
            vod_content: content,
            vod_play_from: '播放',
            vod_play_url: playUrls.join('#'),
        }],
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    // 尝试多个常见搜索路径
    let candidates = [
        host + '/search/' + encodeURIComponent(wd) + '.html',
        host + '/search?q=' + encodeURIComponent(wd),
        host + '/s?wd=' + encodeURIComponent(wd),
    ];
    if (parseInt(p) > 1) {
        candidates.push(host + '/search/' + encodeURIComponent(wd) + '/page/' + p + '.html');
    }
    
    let html = '';
    for (let url of candidates) {
        try {
            let resp = await req(url, { headers: headers });
            html = resp && (resp.content || resp.body || resp) || '';
            // 调试/原始返回：如果开启 DEBUG 或 URL 指定 __raw=1，则直接返回原始 HTML
            try {
                if (DEBUG || (typeof url === 'string' && url.indexOf('__raw=1') !== -1)) {
                    return JSON.stringify({ raw: html });
                }
            } catch (e) {}

            let list = getList(html);
            if (list && list.length > 0) {
                return JSON.stringify({ list: list });
            }
        } catch (e) {}
    }
    
    return JSON.stringify({ list: [] });
}

async function play(flag, id, flags) {
    let url = id;
    if (url.startsWith('/play/')) {
        url = host + url;
    } else if (!url.startsWith('http')) {
        url = host + '/play/' + (url.endsWith('.html') ? url : url + '.html');
    }
    let resp = await req(url, { headers: headers });
    let html = resp && (resp.content || resp.body || resp) || '';
    // 调试/原始返回：如果开启 DEBUG 或 id/url 包含 __raw=1，则直接返回原始 HTML
    try {
        if (DEBUG || (typeof id === 'string' && id.indexOf('__raw=1') !== -1) || (typeof url === 'string' && url.indexOf('__raw=1') !== -1)) {
            return JSON.stringify({ raw: html });
        }
    } catch (e) {}
    
    // 尝试多种 m3u8 提取方式
    let patterns = [
        /['"](https?:[^'"\s]+\.m3u8[^'"\s]*)['"]/i,              // "...m3u8..."
        /source[^>]*src=['"]([^'"\s]+\.m3u8[^'"\s]*)['"]/i,      // <source src="...m3u8...">
        /url['":]?\s*['"]?([^'"\s,;]+\.m3u8[^'"\s]*)/i,          // url: "...m3u8..."
        /"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/i,                     // "url":"...m3u8..."
        /https?:\/\/[^\s'"]*\.m3u8[^\s'"]*(?=[\s'"]|$)/i        // 直接 m3u8 URL
    ];
    
    for (let pattern of patterns) {
        let m = html.match(pattern);
        if (m) {
            let playUrl = m[1];
            return JSON.stringify({ parse: 0, url: playUrl.replace(/\\/g, ''), header: headers });
        }
    }
    
    // 未找到直接 URL，返回 parse:1 让 TVBOX 解析
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

// --------- Playwright 回退抓取器 ---------
// 说明：运行此回退需要在运行环境中安装 `playwright`。
// 安装命令：`npm install playwright` 并执行 `npx playwright install chromium`
async function fetchWithBrowser(url) {
    try {
        const pw = require('playwright');
        const browser = await pw.chromium.launch({ headless: true });
        const context = await browser.newContext({ userAgent: headers['User-Agent'], javaScriptEnabled: true });
        const page = await context.newPage();
        await page.setExtraHTTPHeaders({ Referer: headers.Referer });
        // 有些站点需要延时等待 JS 执行和弹窗关闭
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => {});
        // 尝试关闭常见弹窗
        try {
            await page.keyboard.press('Escape');
            await page.evaluate(() => {
                const selectors = ['.close', '.dialog-close', '.layui-layer-close', '.popup-close', '.btn-close'];
                selectors.forEach(s => { const el = document.querySelector(s); if (el) el.click(); });
            });
        } catch (e) {}
        // 等待额外请求
        await page.waitForTimeout(1200).catch(e => {});
        let html = await page.content();
        await browser.close();
        return html || '';
    } catch (err) {
        // require 失败或浏览器启动失败
        return '';
    }
}

export default { init, home, homeVod, category, detail, search, play };
