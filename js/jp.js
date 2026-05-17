let host = 'https://www.sizhengxt.com';
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
    // 使用通用的方式提取所有 detail 链接
    let pattern = /href="\/detail\/(\d+)"[^>]*>([^<]+)<\/a>\s*<\/h[234]|href="\/detail\/(\d+)"\s+[^>]*title="([^"]+)"|<h[234]\s+[^>]*><a\s+[^>]*href="\/detail\/(\d+)"[^>]*>([^<]+)<\/a>/g;
    let matches = [...html.matchAll(pattern)];
    let seen = {};
    
    matches.forEach(match => {
        let id = match[1] || match[3] || match[5];
        let name = match[2] || match[4] || match[6];
        let key = id + '-' + name;
        
        if (id && name && !seen[key]) {
            seen[key] = true;
            videos.push({
                vod_id: id,
                vod_name: cleanText(name),
                vod_pic: '',
                vod_remarks: '',
            });
        }
    });
    
    return videos.slice(0, 50);
}

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '电视剧' },
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
    let resp = await req(host, { 
        headers: headers,
        timeout: 5000,
        redirect: 'follow'
    });
    let html = resp.content || '';
    return JSON.stringify({ list: getList(html) });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let targetId = (extend && extend.class) ? extend.class : tid;
    let url = host + '/type/' + targetId;
    if (parseInt(p) > 1) url += '/page/' + p;
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content), page: parseInt(p) });
}

async function detail(id) {
    let url = host + '/detail/' + id;
    let resp = await req(url, { headers: headers });
    let html = resp.content;

    let name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ['', ''])[1];
    let pic = (html.match(/data-original="([^"]+)"/) || html.match(/<img[^>]+src="([^"]+)"/)) || ['', ''];
    pic = pic[1] || '';
    if (pic && pic.startsWith('/')) pic = host + pic;

    let content = cleanText((html.match(/class="[^"]*content[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/) || 
        html.match(/<meta name="description" content="([^"]*)"/) || ['', ''])[1]);

    let playFrom = pdfa(html, '.myui-content__list,.tab-pane').map(it => 
        (it.match(/<h3[^>]*>([^<]+)<\/h3>/) || it.match(/<span[^>]*>([^<]+)<\/span>/) || ['', '线路'])[1]
    ).join('$$$');

    let playUrl = pdfa(html, '.myui-content__list,.tab-pane').map(list => 
        pdfa(list, 'a').map(a => {
            let n = (a.match(/<span[^>]*>([^<]+)<\/span>/) || ['', '播放'])[1];
            let v = a.match(/href="\/vod\/play\/(\d+)\/sid\/(\d+)"/);
            return n + '$' + (v ? (v[1] + '/' + v[2]) : '');
        }).filter(x => x.split('$')[1]).join('#')
    ).filter(x => x).join('$$$');

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: cleanText(name),
            vod_pic: pic,
            vod_content: content,
            vod_play_from: playFrom || '播放',
            vod_play_url: playUrl,
        }],
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + '/search/wd/' + encodeURIComponent(wd);
    if (parseInt(p) > 1) url += '/page/' + p;
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function play(flag, id, flags) {
    let parts = id.split('/');
    let vid = parts[0];
    let sid = parts[1] || '1';
    let url = host + '/vod/play/' + vid + '/sid/' + sid;
    let resp = await req(url, { headers: headers });
    
    let m3u8 = resp.content.match(/"url":"([^"]+\.m3u8)"/);
    if (m3u8) return JSON.stringify({ parse: 0, url: m3u8[1].replace(/\\/g, ''), header: headers });
    
    let m3u8b = resp.content.match(/https?:\/\/[^"']+\.m3u8/);
    if (m3u8b) return JSON.stringify({ parse: 0, url: m3u8b[0], header: headers });
    
    let iframe = resp.content.match(/<iframe[^>]+src="([^"]+)"/);
    if (iframe) return JSON.stringify({ parse: 1, url: iframe[1], header: headers });
    
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
