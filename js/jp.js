let host = 'https://www.sizhengxt.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/",
    "Cookie": "PGY_Domain_Key=e70c27cbfca2a14f57f4b688cbc057bd"
};

// 公用函数：清洗文本，去除 HTML 标签与多余空白
function cleanText(str) {
    return String(str || '').replace(/<.*?>/g, '').replace(/\s+/g, ' ').trim();
}

// 从 HTML 中提取视频列表
function getList(html) {
    let videos = [];
    let items = pdfa(html, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/href="\/(?:vod\/detail\/id\/(\d+)\.html|dt\/(\d+)\.html)/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/alt="(.*?)"/) || it.match(/<strong>(.*?)<\/strong>/);
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        if (idMatch && nameMatch) {
            let videoId = (idMatch[1] || idMatch[2] || '');
            let pic = picMatch ? (picMatch[1] || picMatch[2] || '') : '';
            if (pic && pic.startsWith('/')) pic = host + pic;
            videos.push({
                vod_id: videoId,
                vod_name: cleanText(nameMatch[1]),
                vod_pic: pic,
                vod_remarks: cleanText((it.match(/module-item-note">([\s\S]*?)<\/div>/) || ['', ''])[1]),
            });
        }
    });
    return videos;
}

async function init(cfg) {}

// 首页分类
async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '电视剧' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺' }
        ],
        filters: {}
    });
}

// 首页推荐
async function homeVod() {
    let resp = await req(host, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

// 分类页
async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let url = host + '/vod/show/id/' + tid + '/page/' + p + '.html';
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content), page: parseInt(p) });
}

// 详情页
async function detail(id) {
    let url = host + '/vod/detail/id/' + id + '.html';
    let resp = await req(url, { headers: headers });
    let html = resp.content;

    // 获取播放源名称
    let playFrom = pdfa(html, '.module-tab-item').map(it => {
        return (it.match(/<span>(.*?)<\/span>/) || ['', '默认播放'])[1];
    }).join('$$$');
    if (!playFrom) playFrom = '直接播放';

    // 获取播放地址
    let playUrl = '';
    let links = pdfa(html, '.module-play-list-content a');
    if (links.length === 0) {
        links = pdfa(html, '.playlist a');
    }
    if (links.length > 0) {
        playUrl = links.map(a => {
            let name = (a.match(/<span>(.*?)<\/span>/) || ['', '播放'])[1];
            let link = a.match(/href="([^"]+)"/);
            if (link && link[1]) {
                let href = link[1];
                if (href.includes('/vod/play/id/')) {
                    let match = href.match(/\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)/);
                    if (match) {
                        return name + '$' + match[1] + '/' + match[2] + '/' + match[3];
                    }
                    return name + '$' + href.match(/\/vod\/play\/id\/(\d+)/)[1];
                }
                return name + '$' + href;
            }
            return name + '$';
        }).join('#');
    } else {
        // 如果没有播放列表，尝试找iframe
        let iframeSrc = html.match(/<iframe[^>]*src="([^"]+)"/);
        if (iframeSrc) {
            playUrl = '播放$' + iframeSrc[1];
        }
    }

    let pic = (html.match(/data-original="(.*?)"/) || ['', ''])[1];
    if (pic && pic.startsWith('/')) pic = host + pic;

    let vod_name = (html.match(/<h1>(.*?)<\/h1>/) || ['', ''])[1];
    let vod_content = (html.match(/introduction-content">[\s\S]*?<p>([\s\S]*?)<\/p>/) || ['', ''])[1];
    vod_content = cleanText(vod_content);

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: vod_name,
            vod_pic: pic,
            vod_content: vod_content,
            vod_play_from: playFrom,
            vod_play_url: playUrl,
        }],
    });
}

// 搜索
async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + '/vod/search.html?wd=' + encodeURIComponent(wd) + '&page=' + p;
    let resp = await req(url, { headers: headers });
    let videos = [];
    let items = pdfa(resp.content, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/href="\/(?:vod\/detail\/id\/(\d+)\.html|dt\/(\d+)\.html)/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/alt="(.*?)"/);
        if (idMatch && nameMatch) {
            videos.push({
                vod_id: (idMatch[1] || idMatch[2] || ''),
                vod_name: cleanText(nameMatch[1]),
                vod_pic: '',
                vod_remarks: '',
            });
        }
    });
    return JSON.stringify({ list: videos });
}

// 播放解析
async function play(flag, id, flags) {
    let playUrl = '';
    if (id.includes('/')) {
        // 处理类似 1/2/3 的格式：表示 id/sid/nid
        let parts = id.split('/');
        if (parts.length >= 3) {
            playUrl = host + '/vod/play/id/' + parts[0] + '/sid/' + parts[1] + '/nid/' + parts[2] + '.html';
        } else {
            playUrl = host + '/vod/play/id/' + parts[0] + '.html';
        }
    } else {
        playUrl = host + '/vod/play/id/' + id + '.html';
    }
    let resp = await req(playUrl, { headers: headers });
    let html = resp.content;

    // 查找视频地址
    let m3u8Match = html.match(/"url":"([^"]+\.m3u8)"/) || html.match(/https?:\/\/[^"']+\.m3u8/);
    if (m3u8Match) {
        return JSON.stringify({ parse: 0, url: m3u8Match[1].replace(/\\/g, ''), header: headers });
    }

    // 查找iframe里的地址
    let iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
    if (iframeMatch && iframeMatch[1]) {
        // 递归解析iframe
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith('/')) iframeUrl = host + iframeUrl;
        let iframeResp = await req(iframeUrl, { headers: headers });
        let iframeHtml = iframeResp.content;
        let iframeM3u8 = iframeHtml.match(/"url":"([^"]+\.m3u8)"/) || iframeHtml.match(/https?:\/\/[^"']+\.m3u8/);
        if (iframeM3u8) {
            return JSON.stringify({ parse: 0, url: iframeM3u8[1].replace(/\\/g, ''), header: headers });
        }
    }

    return JSON.stringify({ parse: 1, url: playUrl, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
