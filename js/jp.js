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
    let items = pdfa(html, 'a');
    let seen = {};
    items.forEach(it => {
        let idMatch = it.match(/href="\/detail\/(\d+)"/);
        if (!idMatch) return;
        
        let titleMatch = it.match(/<span>([^<]*[^\s<][^<]*)<\/span>/);
        if (!titleMatch) return;
        
        let name = cleanText(titleMatch[1]);
        if (!name) return;
        
        let pic = '';
        let srcSetMatch = it.match(/srcSet="([^"]+)"/);
        if (srcSetMatch) {
            let urls = srcSetMatch[1].split(',');
            let lastUrl = urls[urls.length - 1].trim().split(' ')[0];
            if (lastUrl.includes('https://obs')) {
                pic = lastUrl;
            } else {
                let urlMatch = srcSetMatch[1].match(/(https:\/\/[^\s"]+\.(?:jpg|png|webp|jpeg))/);
                if (urlMatch) pic = urlMatch[1];
            }
        }
        if (!pic) {
            let picMatch = it.match(/src="(https:\/\/[^"]+\.(?:jpg|png|webp|jpeg))"/);
            if (picMatch) pic = picMatch[1];
        }
        if (!pic) {
            let picMatch = it.match(/src="(\/[^"]+\.(?:jpg|png|webp|jpeg))"/);
            if (picMatch) pic = host + picMatch[1];
        }
        
        let scoreMatch = it.match(/>([0-9.]+)<\/div>/);
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
    let playItems = pdfa(html, 'a');
    playItems.forEach(link => {
        let m = link.match(/href="\/vod\/play\/(\d+\/\d+\/\d+)"/);
        if (m && !seenPlay[m[1]]) {
            seenPlay[m[1]] = true;
            let parts = m[1].split('/');
            let episode = parts[1] || '1';
            let sid = parts[2];
            playUrls.push('第' + episode + '集$' + parts[0] + '/' + episode + '/' + sid);
        }
    });

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
