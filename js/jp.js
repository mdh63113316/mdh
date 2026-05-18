let host = 'https://www.sizhengxt.com';
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
    if (url.includes('/_next/image')) {
        let u = url.match(/url=([^&]+)/);
        if (u) return decodeURIComponent(u[1]);
    }
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return host + url;
    return url;
}

function getPicFromAnchor(it) {
    let pic = '';
    let srcSetMatch = it.match(/(?:srcSet|srcset|data-srcset|data-lazy-srcset)=['"]([^'"]+)['"]/i);
    if (srcSetMatch) {
        let urls = srcSetMatch[1].split(',').map(i => i.trim().split(' ')[0]);
        for (let candidate of urls.reverse()) {
            if (candidate) {
                pic = resolveImageUrl(candidate);
                if (pic) break;
            }
        }
    }
    if (!pic) {
        let picMatch = it.match(/(?:src|data-src|data-lazy-src|data-original)=['"]([^'"]+)['"]/i);
        if (picMatch) pic = resolveImageUrl(picMatch[1]);
    }
    return pic;
}

function getList(html) {
    let videos = [];
    let items = html.match(/<div class="hover-card__Content-sc-ab4ff6e3-0 kShZro">[\s\S]*?<div class="hover-card__VideoInfo-sc-ab4ff6e3-3 eLRHGm video-info">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];
    if (!items.length) {
        items = pdfa(html, 'a');
    }
    let seen = {};
    items.forEach(it => {
        let idMatch = it.match(/href="\/detail\/(\d+)"/);
        if (!idMatch) return;

        let titleMatch = it.match(/<div[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
        let name = titleMatch ? cleanText(titleMatch[1]) : '';
        if (!name) {
            let altMatch = it.match(/<img[^>]*alt="([^"]+)"/i);
            if (altMatch) name = cleanText(altMatch[1]);
        }
        if (!name) return;

        let pic = getPicFromAnchor(it);
        let scoreMatch = it.match(/<div[^>]*class="[^"]*\bscore\b[^"]*"[^>]*>([^<]+)<\/div>/);
        let remark = scoreMatch ? cleanText(scoreMatch[1]) : '';

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
    return videos.slice(0, 60);
}


async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影1' },
            { type_id: '2', type_name: '电视剧1' },
            { type_id: '3', type_name: '综艺' },
            { type_id: '4', type_name: '动漫' },
        ],
        filters: {
            '1': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '喜剧', v: '喜剧' },
                { n: '动作', v: '动作' },
                { n: '战争', v: '战争' },
                { n: '爱情', v: '爱情' },
                { n: '悬疑', v: '悬疑' },
                { n: '科幻', v: '科幻' },
            ] }],
            '2': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '国产剧', v: '国产剧' },
                { n: '港台剧', v: '港台剧' },
                { n: '日剧', v: '日剧' },
                { n: '韩剧', v: '韩剧' },
                { n: '欧美剧', v: '欧美剧' },
            ] }],
            '3': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '内地综艺', v: '内地综艺' },
                { n: '港台综艺', v: '港台综艺' },
                { n: '日本综艺', v: '日本综艺' },
                { n: '韩国综艺', v: '韩国综艺' },
            ] }],
            '4': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '国产动漫', v: '国产动漫' },
                { n: '日本动漫', v: '日本动漫' },
                { n: '欧美动漫', v: '欧美动漫' },
            ] }],
        },
    });
}

async function homeVod() {
    let resp = await req(host + '/vod/show/id/1', { headers: headers });
    let html = resp.content || '';
    return JSON.stringify({ list: getList(html) });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let url = host + '/vod/show/id/' + tid;
    if (extend && extend.class) {
        url += '/class/' + encodeURIComponent(extend.class);
    } else if (extend && extend.type) {
        url += '/type/' + encodeURIComponent(extend.type);
    }
    if (parseInt(p) > 1) url += '/page/' + p;
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content), page: parseInt(p) });
}

async function detail(id) {
    let url = host + '/detail/' + id;
    let resp = await req(url, { headers: headers });
    let html = resp.content || '';

    let name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<]+)<\/title>/) || ['', ''])[1];

    let pic = '';
    let ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogImageMatch) {
        pic = ogImageMatch[1];
        if (pic.includes('/_next/image')) {
            let urlParam = pic.match(/url=([^&]+)/);
            if (urlParam) pic = decodeURIComponent(urlParam[1]);
        }
    }
    if (pic && pic.startsWith('/')) pic = host + pic;

    let content = cleanText((html.match(/<meta name="description" content="([^"]*)"/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ['', ''])[1]);

    let playUrls = [];
    let seenPlay = {};
    let episodeJson = '';

    let listIndex = html.indexOf('episodeList');
    if (listIndex >= 0) {
        let arrStart = html.indexOf('[', listIndex);
        if (arrStart >= 0) {
            let depth = 0;
            let inString = false;
            let quoteChar = '';
            let escapeNext = false;
            for (let i = arrStart; i < html.length; i++) {
                let ch = html[i];
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                if (ch === '\\') {
                    escapeNext = true;
                    continue;
                }
                if (inString) {
                    if (ch === quoteChar) inString = false;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    inString = true;
                    quoteChar = ch;
                    continue;
                }
                if (ch === '[') depth++;
                if (ch === ']') {
                    depth--;
                    if (depth === 0) {
                        episodeJson = html.slice(arrStart, i + 1);
                        break;
                    }
                }
            }
        }
    }

    if (episodeJson) {
        episodeJson = episodeJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        episodeJson = episodeJson.replace(/([{,\s])([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        try {
            let episodes = JSON.parse(episodeJson);
            episodes.forEach(ep => {
                let nid = String(ep.nid || '');
                let sort = String(ep.sort || '1');
                let nameText = cleanText(ep.name || ('第' + sort + '集'));
                let playKey = id + '/' + sort + '/' + nid;
                if (nid && !seenPlay[playKey]) {
                    seenPlay[playKey] = true;
                    playUrls.push(nameText + '$' + playKey);
                }
            });
        } catch (e) {}
    }

    if (!playUrls.length) {
        let playItems = pdfa(html, 'a');
        playItems.forEach(link => {
            let m = link.match(/href="\/vod\/play\/(\d+\/\d+\/\d+)"/);
            if (m && !seenPlay[m[1]]) {
                seenPlay[m[1]] = true;
                let parts = m[1].split('/');
                let episode = parts[1] || '1';
                playUrls.push('第' + episode + '集$' + parts[0] + '/' + episode + '/' + parts[2]);
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
    let url = host + '/vod/search/' + encodeURIComponent(wd);
    if (parseInt(p) > 1) url += '/page/' + p;
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function play(flag, id, flags) {
    let parts = id.split('/');
    let url;
    if (parts.length >= 3) {
        url = host + '/vod/play/' + parts.join('/');
    } else if (parts.length === 2) {
        url = host + '/vod/play/' + parts[0] + '/1/' + parts[1];
    } else {
        url = host + '/vod/play/' + id;
    }
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
