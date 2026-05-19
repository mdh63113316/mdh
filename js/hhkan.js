let host = 'https://www.hhkan1.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
};

async function init(cfg) {}

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
    
    // 层级 1：尝试智能选择器（module-item, card, vod等）
    try {
        items = pdfa(html, ".module-item,.module-card-item,.module-item-pic,.movie-card,.vod-item,.vod-card,.vodlist li,.video-item");
    } catch (e) {}
    
    // 层级 2：如果层级1失败，用通用的 <a> 选择并过滤
    if (!items || !items.length) {
        try {
            items = pdfa(html, 'a[href*="/detail/"]');
        } catch (e) {}
    }
    
    // 层级 3：最后回退到所有 <a> 标签
    if (!items || !items.length) {
        items = pdfa(html, 'a') || [];
    }
    
    items.forEach(function(it) {
        // 提取链接
        let idMatch = it.match(/href=["']([^"']*\/(?:detail|vod|view)\/([^\/\?&'"]+)[^"']*)["']/i);
        if (!idMatch) {
            // 备用：寻找任何包含数字的 href
            let anyMatch = it.match(/href=["']([^"']+)["']/i);
            if (anyMatch && anyMatch[1].indexOf('html') > -1) {
                idMatch = anyMatch;
            } else {
                return;
            }
        }
        
        let href = idMatch[1];
        let id = '';
        
        // 从 href 提取 ID
        let detailId = href.match(/\/(?:detail|vod|view)\/([^\/\?&'"]+)/i);
        if (detailId) {
            id = detailId[1].split('.')[0]; // 移除 .html 后缀
        } else {
            let numId = href.match(/(\d+)/);
            if (numId) id = numId[1];
        }
        
        if (!id) return;
        
        // 提取标题
        let name = '';
        let titleMatch = it.match(/title=["']([^"']+)["']/i)
            || it.match(/alt=["']([^"']+)["']/i)
            || it.match(/<img[^>]*alt=["']([^"']+)["']/i)
            || it.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i)
            || it.match(/<strong[^>]*>([^<]+)<\/strong>/i);
        
        if (titleMatch) name = cleanText(titleMatch[1]);
        if (!name) {
            // 从链接文本提取
            let textMatch = it.match(/>([^<]{2,100})<\/a>/);
            if (textMatch) name = cleanText(textMatch[1]);
        }
        
        if (!name || name.length < 2) return;
        
        // 提取图片
        let pic = getPicFromAnchor(it);
        if (pic && pic.startsWith('/')) pic = host + pic;
        
        // 提取备注
        let remark = '';
        let scoreMatch = it.match(/<span[^>]*class=["'][^"']*(?:score|tag|label|year)[^"']*["'][^>]*>([^<]{1,30})<\/span>/i)
            || it.match(/<div[^>]*class=["'][^"']*(?:score|tag|label|year)[^"']*["'][^>]*>([^<]{1,30})<\/div>/i);
        if (scoreMatch) remark = cleanText(scoreMatch[1]);
        
        let key = id + '|' + name;
        if (!seen[key]) {
            seen[key] = true;
            videos.push({
                vod_id: id,
                vod_name: name,
                vod_pic: pic,
                vod_remarks: remark,
            });
        }
    });
    
    return videos;
}

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影1' },
            { type_id: '2', type_name: '连续剧1' },
            { type_id: '3', type_name: '动漫2' },
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
        url = host + '/show/' + tid + '-' + encodeURIComponent(extend.class) + '-----.html';
    } else if (extend && extend.area) {
        url = host + '/show/' + tid + '--' + encodeURIComponent(extend.area) + '----.html';
    } else if (extend && extend.year) {
        url = host + '/show/' + tid + '----' + encodeURIComponent(extend.year) + '--.html';
    }
    let p = parseInt(pg) || 1;
    if (p > 1) {
        // 两种常见分页形式：/page/{p}.html 或 ?page={p}
        if (url.endsWith('.html')) url = url.replace(/\.html$/, '/page/' + p + '.html');
        else url += (url.includes('?') ? '&' : '?') + 'page=' + p;
    }
    return url;
}

async function fetchList(url) {
    let resp = await req(url, { headers: headers });
    let html = resp && (resp.content || resp.body || resp) || '';
    if (!html) html = '';
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
    return JSON.stringify({ list: JSON.parse(result).list, page: parseInt(pg) || 1 });
}

async function detail(id) {
    let url = host + '/detail/' + id + '.html';
    let resp = await req(url, { headers: headers });
    let html = resp && (resp.content || resp.body || resp) || '';

    let name = (html.match(/<strong[^>]*>([^<]+)<\/strong>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || ['', ''])[1];
    let pic = '';
    let picMatch = html.match(/<img[^>]*data-original=['"]([^'">]+)['"]/i)
        || html.match(/<img[^>]*src=['"]([^'">]+)['"]/i)
        || html.match(/<meta property=['"]og:image['"] content=['"]([^'">]+)['"]/i);
    if (picMatch) pic = resolveImageUrl(picMatch[1]);
    if (pic && pic.startsWith('/')) pic = host + pic;

    let content = cleanText((html.match(/<p[^>]*class="[^"]*(?:desc|intro|text)[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || html.match(/<div[^>]*class="[^"]*(?:desc|intro|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || ['', ''])[1]);

    let playUrls = [];
    let seenPlay = {};
    
    // 用 pdfa 尝试选择播放链接容器
    let playItems = [];
    try {
        playItems = pdfa(html, 'a[href*="/play/"],.module-play-list-content a,.play-list a');
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

export default { init, home, homeVod, category, detail, search, play };
