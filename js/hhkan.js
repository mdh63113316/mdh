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
    try {
        items = pdfa(html, ".module-item,.module-card-item,.vodlist .vodlist-ol li,.vodlist li,.vod-list li,a");
    } catch (e) {
        items = pdfa(html, 'a') || [];
    }
    if (!items || !items.length) items = html.match(/<a[\s\S]*?<\/a>/gi) || [];

    let seen = {};
    items.forEach(it => {
        let hrefMatch = it.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) return;
        let href = hrefMatch[1];

        // normalize absolute urls to path
        if (/^https?:\/\//i.test(href)) {
            try { href = new URL(href).pathname + (new URL(href).search || ''); } catch (e) {}
        }

        // match various detail/vod url patterns
        let idMatch = href.match(/\/(?:detail|vod|dt|view)\/([^\/\?&'\"]+)\.html/i)
            || href.match(/(\d+)\.html/);
        if (!idMatch) return;

        let id = idMatch[1];

        let nameMatch = it.match(/title=["']([^"']+)["']/i)
            || it.match(/alt=["']([^"']+)["']/i)
            || it.match(/<img[^>]*alt=["']([^"']+)["']/i)
            || it.match(/<strong[^>]*>([^<]+)<\/strong>/i)
            || it.match(/>([^<]+)<\/a>/i);
        let name = nameMatch ? cleanText(nameMatch[1]) : '';
        if (!name) return;

        let pic = getPicFromAnchor(it);
        if (pic && pic.startsWith('/')) pic = host + pic;

        let remarkMatch = it.match(/<span[^>]*class=["'][^"']*(?:tag|score|info-tag|type|label)[^"']*["'][^>]*>([^<]+)<\/span>/i)
            || it.match(/<div[^>]*class=["'][^"']*(?:tag|score|info-tag|type|label)[^"']*["'][^>]*>([^<]+)<\/div>/i);
        let remark = remarkMatch ? cleanText(remarkMatch[1]) : '';

        let key = id + '|' + name;
        if (!seen[key]) {
            seen[key] = true;
            videos.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: remark });
        }
    });
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
    if ((!list || !list.length) && html) {
        // 回退：正则直接抽取含有 /detail/ 或 /play/ 链接的 a 标签
        let items = html.match(/<a[^>]+href=["']([^"']+(?:\/detail\/|\/play\/|\.html))[^"']*["'][^>]*>[\s\S]*?<\/a>/gi) || [];
        let seen = {};
        items.forEach(it => {
            let hrefM = it.match(/href=["']([^"']+)["']/i);
            if (!hrefM) return;
            let href = hrefM[1];
            if (/^https?:\/\//i.test(href)) {
                try { href = new URL(href).pathname + (new URL(href).search || ''); } catch (e) {}
            }
            let idM = href.match(/\/(?:detail|vod|dt|view)\/(?:.*?)(\d+)\.html/i) || href.match(/(\d+)\.html/);
            if (!idM) return;
            let id = idM[1];
            let nameM = it.match(/title=["']([^"']+)["']/i) || it.match(/alt=["']([^"']+)["']/i) || it.match(/<img[^>]*alt=["']([^"']+)["']/i) || it.match(/<strong[^>]*>([^<]+)<\/strong>/i) || it.match(/>([^<]+)<\/a>/i);
            let name = nameM ? cleanText(nameM[1]) : ('id_' + id);
            if (!name) return;
            let pic = getPicFromAnchor(it);
            if (pic && pic.startsWith('/')) pic = host + pic;
            let key = id + '|' + name;
            if (!seen[key]) {
                seen[key] = true;
                list.push({ vod_id: id, vod_name: name, vod_pic: pic, vod_remarks: '' });
            }
        });
    }
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
    let playItems = [];
    try { playItems = pdfa(html, '.module-play-list-content a, .play-list a, a'); } catch (e) { playItems = pdfa(html, 'a'); }
    playItems.forEach(link => {
        let m = link.match(/href=["']([^"']*play[^"']*\.html)["']/i) || link.match(/href=["']([^"']*play[^"']*)["']/i);
        if (m) {
            let href = m[1];
            if (href.startsWith('/')) href = href.replace(/^\//, '');
            let title = (link.match(/<span[^>]*>([^<]+)<\/span>/i) || link.match(/>([^<]+)<\/a>/i) || ['', '播放'])[1];
            title = cleanText(title) || '播放';
            let playId = href.replace(/^play\//, '').replace(/^[\/]*/, '');
            if (!seenPlay[playId]) {
                seenPlay[playId] = true;
                playUrls.push(title + '$' + playId);
            }
        }
    });
    if (!playUrls.length) {
        let main = html.match(/href="(\/play\/[^"']+\.html)"/i);
        if (main) playUrls.push('播放$' + main[1].replace(/^\/play\//, ''));
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
    // 站点可能存在多种搜索路径，尝试几种常见形式
    let candidates = [
        host + '/search/' + encodeURIComponent(wd) + '.html',
        host + '/s?wd=' + encodeURIComponent(wd),
        host + '/search?q=' + encodeURIComponent(wd),
        host + '/search/' + encodeURIComponent(wd) + '.html/page/' + p + '.html'
    ];
    let html = '';
    for (let url of candidates) {
        try {
            let resp = await req(url, { headers: headers });
            html = resp && (resp.content || resp.body || resp) || '';
            if (html && html.indexOf('class') !== -1) break; // 简单判断是否为有效页面
        } catch (e) {}
    }
    return JSON.stringify({ list: getList(html) });
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
    let m = html.match(/['"](https?:[^'"\s]+\.m3u8[^'"\s]*)['"]/i);
    if (m) {
        return JSON.stringify({ parse: 0, url: m[1].replace(/\\/g, ''), header: headers });
    }
    let m2 = html.match(/source[^>]*src=['"]([^'"\s]+\.m3u8[^'"\s]*)['"]/i);
    if (m2) {
        return JSON.stringify({ parse: 0, url: m2[1].replace(/\\/g, ''), header: headers });
    }
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
