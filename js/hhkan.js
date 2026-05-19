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
    let seen = {};
    
    // 直接用正则提取包含 /detail/ 或 /vod/ 的链接及其上下文
    let detailRegex = /<a[^>]*href=["']([^"']*\/(?:detail|vod|view)\/[^"']*?)["'][^>]*>([\s\S]{0,500}?)<\/a>/gi;
    let match;
    
    while ((match = detailRegex.exec(html)) !== null) {
        let fullLink = match[0];
        let href = match[1];
        let innerHtml = match[2];
        
        // 提取 ID
        let idMatch = href.match(/\/(?:detail|vod|view)\/([^\/\?&'\"]+?)(?:|\.html)/i);
        if (!idMatch) continue;
        
        let id = String(idMatch[1]).trim();
        if (!id || id.length === 0) continue;
        
        // 提取标题：优先级 title > alt > strong > img > 文本
        let name = '';
        let nameMatch = fullLink.match(/title=["']([^"']+)["']/i)
            || fullLink.match(/alt=["']([^"']+)["']/i)
            || fullLink.match(/<img[^>]*alt=["']([^"']+)["']/i)
            || fullLink.match(/<strong[^>]*>([^<]+)<\/strong>/i)
            || innerHtml.match(/>([^<]{2,100})</);
        if (nameMatch) name = cleanText(nameMatch[1]);
        
        if (!name || name.length < 2) continue;
        
        // 提取图片
        let pic = getPicFromAnchor(fullLink);
        if (!pic) pic = getPicFromAnchor(innerHtml);
        if (pic && pic.startsWith('/')) pic = host + pic;
        
        // 提取备注（评分、标签等）
        let remark = '';
        let remarkMatch = fullLink.match(/<span[^>]*class=["'][^"']*(?:score|tag|year|remark|info)[^"']*["'][^>]*>([^<]{1,50})<\/span>/i)
            || fullLink.match(/<div[^>]*class=["'][^"']*(?:score|tag|year|remark|info)[^"']*["'][^>]*>([^<]{1,50})<\/div>/i);
        if (remarkMatch) remark = cleanText(remarkMatch[1]);
        
        let key = id + '|' + name;
        if (!seen[key]) {
            seen[key] = true;
            videos.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: remark });
        }
    }
    
    return videos;
}

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '连续剧' },
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
    let list = getList(html || '');
    return JSON.stringify({ list: list });
}

async function homeVod() {
    return fetchList(host);
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
    
    // 提取所有可能的播放链接
    let playRegex = /<a[^>]*href=["']([^"']*\/play\/[^"']*?)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
    let pmatch;
    while ((pmatch = playRegex.exec(html)) !== null) {
        let plink = pmatch[1];
        let ptext = pmatch[2];
        
        // 规范化 play 链接 ID
        let playId = plink.replace(/^.*\/play\//, '').replace(/\.html.*/, '').trim();
        if (!playId || playId.length === 0) continue;
        
        // 提取分集名称（优先从链接文本提取）
        let episodeName = cleanText(ptext.match(/>([^<]{1,100})</)?.[1] || '播放');
        if (!episodeName || episodeName.length === 0) episodeName = '播放';
        
        if (!seenPlay[playId]) {
            seenPlay[playId] = true;
            playUrls.push(episodeName + '$' + playId);
        }
    }
    
    // 如果没有抽取到任何链接，尝试正则备用方案
    if (!playUrls.length) {
        let allPlayLinks = html.match(/href=["']([^"']*\/play\/[^"']*?)["']/gi) || [];
        allPlayLinks.forEach(linkAttr => {
            let plink = linkAttr.replace(/href=["']/, '').replace(/["']/, '');
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
