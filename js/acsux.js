let host = 'https://acsux.cn';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
};

async function init(cfg) {}

function cleanText(str) {
    return String(str || '').replace(/<.*?>/g, '').replace(/\s+/g, ' ').trim();
}

function getList(html) {
    let videos = [];
    let items = pdfa(html, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/href="\/dt\/(\d+)\.html"/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/alt="(.*?)"/) || it.match(/<strong>(.*?)<\/strong>/);
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || '') : '';
            if (pic.startsWith('/')) pic = host + pic;
            videos.push({
                vod_id: idMatch[1],
                vod_name: cleanText(nameMatch[1]),
                vod_pic: pic,
                vod_remarks: cleanText((it.match(/module-item-note">([\s\S]*?)<\/div>/) || ['', ''])[1]),
            });
        }
    });
    return videos;
}

function getSearchList(html) {
    let videos = [];
    let seen = {};
    let items = pdfa(html, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/href="\/dt\/(\d+)\.html"/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/alt="(.*?)"/) || it.match(/<strong>(.*?)<\/strong>/);
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        if (idMatch && nameMatch && !seen[idMatch[1]]) {
            seen[idMatch[1]] = true;
            let pic = picMatch ? (picMatch[1] || '') : '';
            if (pic.startsWith('/')) pic = host + pic;
            videos.push({
                vod_id: idMatch[1],
                vod_name: cleanText(nameMatch[1]),
                vod_pic: pic,
                vod_remarks: cleanText((it.match(/module-item-note">([\s\S]*?)<\/div>/) || ['', ''])[1]),
            });
        }
    });
    return videos;
}

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '剧集' },
            { type_id: '2', type_name: '电影' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺' },
        ],
        filters: {
            '1': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '爱情', v: '爱情' },
                { n: '古装', v: '古装' },
                { n: '犯罪', v: '犯罪' },
                { n: '冒险', v: '冒险' },
                { n: '悬疑', v: '悬疑' },
                { n: '惊悚', v: '惊悚' },
                { n: '喜剧', v: '喜剧' },
            ] }],
            '2': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '动作片', v: '动作片' },
                { n: '喜剧片', v: '喜剧片' },
                { n: '爱情片', v: '爱情片' },
                { n: '科幻片', v: '科幻片' },
                { n: '恐怖片', v: '恐怖片' },
            ] }],
            '3': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '国产动漫', v: '国产动漫' },
                { n: '日本动漫', v: '日本动漫' },
                { n: '欧美动漫', v: '欧美动漫' },
                { n: '其他动漫', v: '其他动漫' },
            ] }],
            '4': [{ key: 'class', name: '类型', value: [
                { n: '全部', v: '' },
                { n: '内地综艺', v: '内地综艺' },
                { n: '港台综艺', v: '港台综艺' },
                { n: '日本综艺', v: '日本综艺' },
                { n: '韩国综艺', v: '韩国综艺' },
            ] }],
        },
    });
}

async function homeVod() {
    let resp = await req(host, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let targetId = (extend && extend.class) ? extend.class : tid;
    let url = host + '/cp/' + targetId + (parseInt(p) > 1 ? '/page/' + p + '.html' : '.html');
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content), page: parseInt(p) });
}

async function detail(id) {
    let url = host + '/dt/' + id + '.html';
    let resp = await req(url, { headers: headers });
    let html = resp.content;

    let playFrom = pdfa(html, '.module-tab-item').map(it => (it.match(/<span>(.*?)<\/span>/) || ['', '播放'])[1]).join('$$$');
    let playUrl = pdfa(html, '.module-play-list-content').map(list => pdfa(list, 'a').map(a => {
        let n = (a.match(/<span>(.*?)<\/span>/) || ['', '播放'])[1];
        let v = a.match(/onclick="location\.replace\('\/play\/(.*?)\'\)"/) || a.match(/href="\/play\/(.*?)\/"/);
        return n + '$' + (v ? v[1] : '');
    }).join('#')).join('$$$');

    let pic = (html.match(/data-original="(.*?)"/) || ['', ''])[1];
    if (pic.startsWith('/')) pic = host + pic;

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: (html.match(/<h1>(.*?)<\/h1>/) || ['', ''])[1],
            vod_pic: pic,
            vod_content: (html.match(/introduction-content">[\s\S]*?<p>([\s\S]*?)<\/p>/) || ['', ''])[1].replace(/<.*?>/g, ''),
            vod_play_from: playFrom,
            vod_play_url: playUrl,
        }],
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + '/search/' + encodeURIComponent(wd) + '-------------.html';
    if (parseInt(p) > 1) url = host + '/search/' + encodeURIComponent(wd) + '-------------.html/page/' + p + '.html';
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getSearchList(resp.content) });
}

async function play(flag, id, flags) {
    let url = host + '/play/' + id;
    if (!url.endsWith('.html')) {
        url += '/';
    }
    let resp = await req(url, { headers: headers });
    let m3u8 = resp.content.match(/"url":"([^"]+\.m3u8)"/);
    if (m3u8) return JSON.stringify({ parse: 0, url: m3u8[1].replace(/\\/g, ''), header: headers });
    let m3u8b = resp.content.match(/https?:\/\/[^"']+\.m3u8/);
    if (m3u8b) return JSON.stringify({ parse: 0, url: m3u8b[0], header: headers });
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
