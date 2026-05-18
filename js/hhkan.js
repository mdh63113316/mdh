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
    let items = html.match(/<a[^>]+href="\/detail\/\d+\.html"[\s\S]*?<\/a>/gi) || [];
    if (!items.length) {
        items = pdfa(html, 'a');
    }
    let seen = {};
    items.forEach(it => {
        let idMatch = it.match(/href="\/detail\/(\d+)\.html"/);
        if (!idMatch) return;

        let nameMatch = it.match(/<strong[^>]*>([^<]+)<\/strong>/i)
            || it.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || it.match(/<span[^>]*>([^<]+)<\/span>/i);
        let name = nameMatch ? cleanText(nameMatch[1]) : '';
        if (!name) {
            let altMatch = it.match(/<img[^>]*alt=['"]([^'"]+)['"]/i);
            if (altMatch) name = cleanText(altMatch[1]);
        }
        if (!name || name.toLowerCase() === 'error') return;

        let pic = getPicFromAnchor(it);
        let remarkMatch = it.match(/<div[^>]*class="[^"]*(?:tag|score|info-tag|type|label)[^"]*"[^>]*>([^<]+)<\/div>/i)
            || it.match(/<span[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/i);
        let remark = remarkMatch ? cleanText(remarkMatch[1]) : '';

        let id = idMatch[1];
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
    if (p > 1) url += '/page/' + p + '.html';
    return url;
}

async function fetchList(url) {
    let resp = await req(url, { headers: headers });
    let html = resp.content || '';
    return JSON.stringify({ list: getList(html) });
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
    let html = resp.content || '';

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
    let playItems = pdfa(html, 'a');
    playItems.forEach(link => {
        let m = link.match(/href="\/play\/([^"']+\.html)"/i);
        if (m) {
            let title = (link.match(/>([^<]+)<\/a>/i) || ['', '播放'])[1];
            title = cleanText(title);
            if (!title) title = '播放';
            let playId = m[1];
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
    let url = host + '/search/' + encodeURIComponent(wd) + '.html';
    if (parseInt(p) > 1) url = host + '/search/' + encodeURIComponent(wd) + '.html/page/' + p + '.html';
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function play(flag, id, flags) {
    let url = id;
    if (url.startsWith('/play/')) {
        url = host + url;
    } else if (!url.startsWith('http')) {
        url = host + '/play/' + (url.endsWith('.html') ? url : url + '.html');
    }
    let resp = await req(url, { headers: headers });
    let html = resp.content || '';
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
