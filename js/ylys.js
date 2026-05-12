let host = 'https://www.ylys.tv';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

async function init(cfg) {}

function getList(html) {
    let videos = [];
    let items = pdfa(html, ".module-item,.module-card-item");
    // 关键：判断 items 是否存在且有 length
    if (!items || items.length === 0) return videos;
    items.forEach(it => {
        let idMatch = it.match(/\/voddetail\/(\d+)/) || it.match(/\/detail\/(\d+)/);
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/<strong>(.*?)<\/strong>/);
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || picMatch[2] || "") : "";
            let vod_pic = pic;
            if (pic && pic.startsWith('/')) vod_pic = host + pic;
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<.*?>/g, ""),
                "vod_pic": vod_pic,
                "vod_remarks": (it.match(/module-item-note\">(.*?)<\/div>/) || ["", ""])[1].replace(/<.*?>/g, "")
            });
        }
    });
    return videos;
}

async function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id":"1","type_name":"电影"},
            {"type_id":"2","type_name":"电视剧"},
            {"type_id":"3","type_name":"综艺"},
            {"type_id":"4","type_name":"动漫"},
            {"type_id":"5","type_name":"纪录片"}
        ],
        "filters": {}
    });
}

async function homeVod() {
    let resp = await req(host, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let targetId = (extend && extend.class) ? extend.class : tid;
    let url = host + "/vodtype/" + targetId + (parseInt(p) > 1 ? "/page/" + p + "/" : "");
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ 
        "list": getList(resp.content), 
        "page": parseInt(p) 
    });
}

async function detail(id) {
    let url = host + '/voddetail/' + id + '/';
    let resp = await req(url, { headers: headers });
    let html = resp.content;
    
    // 播放线路名称（完全参考原代码写法）
    let playFrom = [];
    let tabItems = pdfa(html, ".module-tab-item");
    if (tabItems && tabItems.length > 0) {
        tabItems.forEach(it => {
            let match = it.match(/<span>(.*?)<\/span>/);
            playFrom.push(match ? match[1] : "线路");
        });
    }
    if (playFrom.length === 0) playFrom.push("默认线路");
    
    // 播放地址列表
    let playUrl = [];
    let playLists = pdfa(html, ".module-play-list-content");
    if (playLists && playLists.length > 0) {
        playLists.forEach(list => {
            let links = pdfa(list, "a");
            let eps = [];
            if (links && links.length > 0) {
                links.forEach(a => {
                    let nameMatch = a.match(/<span>(.*?)<\/span>/);
                    let linkMatch = a.match(/href="\/play\/([^"]+)"/) || a.match(/href="\/vodplay\/([^"]+)"/);
                    if (linkMatch) {
                        let name = nameMatch ? nameMatch[1] : "播放";
                        eps.push(name + '$' + linkMatch[1]);
                    }
                });
            }
            playUrl.push(eps.join('#'));
        });
    }
    
    // 如果没取到，尝试备用选择器
    if (playUrl.length === 0 || (playUrl.length === 1 && playUrl[0] === "")) {
        let altLinks = pdfa(html, ".play-list a");
        if (altLinks && altLinks.length > 0) {
            playFrom = ["默认线路"];
            let eps = [];
            altLinks.forEach(a => {
                let nameMatch = a.match(/<span>(.*?)<\/span>/);
                let linkMatch = a.match(/href="\/(?:play|vodplay)\/([^"]+)"/);
                if (linkMatch) {
                    let name = nameMatch ? nameMatch[1] : "播放";
                    eps.push(name + '$' + linkMatch[1]);
                }
            });
            playUrl = [eps.join('#')];
        }
    }
    
    let vod_name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ["", ""])[1];
    let vod_pic = (html.match(/data-original="([^"]+)"/) || ["", ""])[1];
    let vod_content = (html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || ["", ""])[1];
    if (vod_content) vod_content = vod_content.replace(/<[^>]+>/g, '');
    
    return JSON.stringify({
        list: [{
            'vod_id': id,
            'vod_name': vod_name,
            'vod_pic': vod_pic,
            'vod_content': vod_content,
            'vod_play_from': playFrom.join('$$$'),
            'vod_play_url': playUrl.join('$$$')
        }]
    });
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + "/vodsearch/" + encodeURIComponent(wd) + "-------------/" + (parseInt(p) > 1 ? "page/" + p + "/" : "");
    let resp = await req(url, { headers: headers });
    return JSON.stringify({ list: getList(resp.content) });
}

async function play(flag, id, flags) {
    let url = host + "/play/" + id + "/";
    let resp = await req(url, { headers: headers });
    let m3u8 = resp.content.match(/"url":"([^"]+\.m3u8)"/);
    if (m3u8 && m3u8[1]) {
        return JSON.stringify({ parse: 0, url: m3u8[1].replace(/\\/g, ""), header: headers });
    }
    return JSON.stringify({ parse: 1, url: url, header: headers });
}

export default { init, home, homeVod, category, detail, search, play };
