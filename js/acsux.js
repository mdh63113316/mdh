const host = 'https://acsux.cn';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Referer: host + '/',
};

async function req(url) {
    const res = await fetch(url, { headers, redirect: 'follow' });
    const text = await res.text();
    return text;
}

function htmlDecode(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function cleanText(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function getList(html) {
    const list = [];
    const itemRe = /<a[^>]+href="\/dt\/(\d+)\.html"(?:[^>]*title="([^"]+)")?[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = itemRe.exec(html))) {
        const id = match[1];
        let name = cleanText(htmlDecode(match[2] || '')) || '';
        const block = match[3];
        if (!name) {
            name = cleanText(htmlDecode((/alt="([^"]+)"/.exec(block) || [])[1] || ''));
        }
        let pic = '';
        const picMatch = /data-original="([^"]+)"/.exec(block) || /src="([^"]+)"/.exec(block);
        if (picMatch) {
            pic = picMatch[1];
            if (pic.startsWith('/')) pic = host + pic;
        }
        const remark = cleanText((/class="module-item-note">([\s\S]*?)<\/div>/.exec(block) || [])[1] || '');
        list.push({
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remark,
        });
    }
    return list;
}

function getSearchList(html) {
    const list = [];
    const seen = new Set();
    const itemRe = /<a[^>]+href="\/dt\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = itemRe.exec(html))) {
        const id = match[1];
        if (seen.has(id)) continue;
        seen.add(id);
        const block = match[2];
        const title = cleanText(htmlDecode((/alt="([^"]+)"/.exec(block) || [])[1] || ''));
        if (!title) continue;
        list.push({
            vod_id: id,
            vod_name: title,
            vod_pic: '',
            vod_remarks: '',
        });
    }
    return list;
}

async function init(cfg) {
    return;
}

async function home() {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '剧集' },
            { type_id: '2', type_name: '电影' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺' },
        ],
        filters: {
            '1': [
                {
                    key: 'class',
                    name: '类型',
                    value: [
                        { n: '全部', v: '' },
                        { n: '爱情', v: '爱情' },
                        { n: '古装', v: '古装' },
                        { n: '犯罪', v: '犯罪' },
                        { n: '冒险', v: '冒险' },
                        { n: '悬疑', v: '悬疑' },
                        { n: '惊悚', v: '惊悚' },
                        { n: '喜剧', v: '喜剧' },
                    ],
                },
            ],
            '2': [
                {
                    key: 'class',
                    name: '类型',
                    value: [
                        { n: '全部', v: '' },
                        { n: '动作片', v: '动作片' },
                        { n: '喜剧片', v: '喜剧片' },
                        { n: '爱情片', v: '爱情片' },
                        { n: '科幻片', v: '科幻片' },
                        { n: '恐怖片', v: '恐怖片' },
                    ],
                },
            ],
            '3': [
                {
                    key: 'class',
                    name: '类型',
                    value: [
                        { n: '全部', v: '' },
                        { n: '国产动漫', v: '国产动漫' },
                        { n: '日本动漫', v: '日本动漫' },
                        { n: '欧美动漫', v: '欧美动漫' },
                        { n: '其他动漫', v: '其他动漫' },
                    ],
                },
            ],
            '4': [
                {
                    key: 'class',
                    name: '类型',
                    value: [
                        { n: '全部', v: '' },
                        { n: '内地综艺', v: '内地综艺' },
                        { n: '港台综艺', v: '港台综艺' },
                        { n: '日本综艺', v: '日本综艺' },
                        { n: '韩国综艺', v: '韩国综艺' },
                    ],
                },
            ],
        },
    });
}

async function homeVod() {
    const html = await req(host);
    return JSON.stringify({ list: getList(html) });
}

async function category(tid, pg, filter, extend) {
    const p = parseInt(pg || 1, 10);
    const targetId = extend && extend.class ? extend.class : tid;
    const url = host + '/cp/' + targetId + (p > 1 ? '/page/' + p + '.html' : '.html');
    const html = await req(url);
    return JSON.stringify({ list: getList(html), page: p });
}

async function detail(id) {
    const html = await req(host + '/dt/' + id + '.html');
    const name = (/<h1[^>]*>([^<]+)<\/h1>/.exec(html) || [])[1] || '';
    let pic = (/<img[^>]+(?:data-original|src)="([^"]+)"/.exec(html) || [])[1] || '';
    if (pic.startsWith('/')) pic = host + pic;
    const content = cleanText((/<div class="module-info-content[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html) || [])[1] || (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '');
    const froms = [];
    for (const m of html.matchAll(/<div class="module-tab-item"[\s\S]*?<span>([^<]+)<\/span>/g)) {
        froms.push(cleanText(m[1]));
    }
    const playBlocks = [];
    for (const block of html.matchAll(/<div class="module-play-list-content[\s\S]*?<\/div>/g)) {
        const items = [];
        for (const a of block[0].matchAll(/onclick="location\.replace\('\/play\/([^']+)'\)"[^>]*>\s*<span>([^<]+)<\/span>/g)) {
            const title = cleanText(a[2]);
            const value = a[1];
            items.push(title + '$' + value);
        }
        if (items.length) playBlocks.push(items.join('#'));
    }
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: cleanText(htmlDecode(name)),
            vod_pic: pic,
            vod_content: content,
            vod_play_from: playBlocks.length ? (froms.length ? froms.join('$$$') : '播放') : '播放',
            vod_play_url: playBlocks.join('$$$'),
        }],
    });
}

async function search(wd, quick, pg) {
    const p = parseInt(pg || 1, 10);
    let url = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (p > 1) url = host + '/search/' + encodeURIComponent(wd) + '-------------.html/page/' + p + '.html';
    const html = await req(url);
    return JSON.stringify({ list: getSearchList(html) });
}

async function play(flag, id, flags) {
    const rawId = String(id || '');
    const playUrl = rawId.endsWith('.html') ? host + '/play/' + rawId : host + '/play/' + rawId + '/';
    const html = await req(playUrl);
    const m3u8 = html.match(/https?:\/\/[^"'\s>]+\.m3u8/);
    if (m3u8) {
        return JSON.stringify({ parse: 0, url: m3u8[0].replace(/\\/g, ''), header: headers });
    }
    const escaped = html.match(/url":"([^"]+\.m3u8)"/);
    if (escaped) {
        return JSON.stringify({ parse: 0, url: escaped[1].replace(/\\\//g, '/'), header: headers });
    }
    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (iframe) {
        return JSON.stringify({ parse: 1, url: iframe[1], header: headers });
    }
    const srcLink = html.match(/href="([^"]+\.m3u8)"/);
    if (srcLink) {
        return JSON.stringify({ parse: 0, url: srcLink[1], header: headers });
    }
    return JSON.stringify({ parse: 1, url: playUrl, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
