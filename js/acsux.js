// 网站基础配置
let host = 'https://www.ylys.tv';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// ======================== 通用解析函数 ========================
function pdfa(html, selector) {
    let list = [];
    let dom = myParseDom(html);
    let elements = dom.select(selector);
    for (let i = 0; i < elements.length; i++) {
        list.push(elements[i].outerHtml());
    }
    return list;
}

function myParseDom(html) {
    return {
        select: function(selector) {
            let results = [];
            let regex;
            if (selector === ".module-item,.module-card-item") {
                regex = /<a[^>]*class="module-poster-item[^"]*"[^>]*>[\s\S]*?<\/a>/g;
            } else {
                regex = new RegExp(`<${selector.replace(/\./g, '')}[^>]*>[\s\S]*?<\/${selector.replace(/\./g, '')}>`, 'g');
            }
            let match;
            while ((match = regex.exec(html)) !== null) {
                results.push({outerHtml: () => match[0]});
            }
            return results;
        }
    };
}

async function req(url, options = {}, timeout = 10000, retry = 2) {
    let controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeout);
    for (let i = 0; i <= retry; i++) {
        try {
            let res = await fetch(url, {...options, signal: controller.signal});
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            let content = await res.text();
            return {content: content, statusCode: res.status};
        } catch (e) {
            if (i === retry) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// ======================== TVBox 接口函数 ========================
async function init(cfg) {
    return;
}

async function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id": "2", "type_name": "电影"},
            {"type_id": "1", "type_name": "剧集"},
            {"type_id": "3", "type_name": "动漫"},
            {"type_id": "4", "type_name": "综艺"}
        ],
        "filters": {}
    });
}

async function homeVod() {
    let resp = await req(host, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}

async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    let url = host + "/cp/" + tid + ".html" + (p > 1 ? "?page=" + p : "");
    let resp = await req(url, {headers: headers});
    let list = getList(resp.content);
    let hasMore = resp.content.includes("下一页");
    return JSON.stringify({list: list, page: p, pagecount: hasMore ? p + 1 : p});
}

function getList(html) {
    let videos = [];
    let items = pdfa(html, ".module-item,.module-card-item");
    items.forEach(it => {
        let idMatch = it.match(/href="\/dt\/(\d+)\.html/);
        let nameMatch = it.match(/title="(.*?)"/);
        let picMatch = it.match(/data-original="(.*?)"/);
        let noteMatch = it.match(/<div class="module-item-note">(.*?)<\/div>/);
        if (idMatch && nameMatch) {
            let pic = picMatch ? picMatch[1] : "";
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1],
                "vod_pic": pic.startsWith('/') ? host + pic : pic,
                "vod_remarks": noteMatch ? noteMatch[1] : ""
            });
        }
    });
    return videos;
}

async function detail(id) {
    let url = host + '/dt/' + id + '.html';
    let resp = await req(url, {headers: headers});
    let html = resp.content;
    let name = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || ["", ""])[1];
    let pic = (html.match(/data-original="([^"]+)"/) || ["", ""])[1];
    let content = (html.match(/<div class="module-info-introduction"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/) || ["", ""])[1];
    let playFrom = "播放线路";
    let playUrl = "";
    let sources = html.match(/<div class="module-tab-item[^"]*" data-dropdown-value="([^"]+)">[\s\S]*?<small>(\d+)<\/small>/g);
    let allPlayUrls = [];
    if (sources) {
        for (let src of sources) {
            let sourceName = src.match(/data-dropdown-value="([^"]+)"/)[1];
            let sourceEpisodes = [];
            let panelId = html.match(new RegExp(`<div class="module-tab-item[^"]*" data-dropdown-value="${sourceName}"[^>]*>\\s*<span>${sourceName}<\\/span>\\s*<small>\\d+<\\/small>\\s*<\\/div>\\s*<div class="tab-list[^"]*" id="panel(\\d+)"`));
            if (panelId) {
                let panelContent = html.match(new RegExp(`<div class="tab-list[^"]*" id="panel${panelId[1]}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
                if (panelContent) {
                    let episodes = panelContent[1].match(/<a[^>]*onclick="location\.replace\('\/play\/\d+-\d+-(\d+)\.html'\)"[^>]*>([\\s\\S]*?)<\/a>/g);
                    if (episodes) {
                        for (let ep of episodes) {
                            let epNum = ep.match(/\/play\/\d+-\d+-(\d+)\.html/)[1];
                            let epName = ep.match(/<span>([^<]+)<\/span>/)[1];
                            sourceEpisodes.push(epName + '$' + epNum);
                        }
                    }
                }
            }
            if (sourceEpisodes.length > 0) {
                allPlayUrls.push(sourceEpisodes.join('#'));
                playFrom += "$$$" + sourceName;
            }
        }
    }
    if (allPlayUrls.length > 0) {
        playUrl = allPlayUrls.join('$$$');
    } else {
        let fallbackMatch = html.match(/location\.replace\('\/play\/(\d+-\d+-\d+)\.html'/);
        if (fallbackMatch) {
            playUrl = "播放$" + fallbackMatch[1];
        }
    }
    return JSON.stringify({
        list: [{
            'vod_id': id,
            'vod_name': name,
            'vod_pic': pic.startsWith('/') ? host + pic : pic,
            'vod_content': content ? content.replace(/<[^>]*>/g, '').trim() : "",
            'vod_play_from': playFrom,
            'vod_play_url': playUrl
        }]
    });
}

async function play(flag, id, flags) {
    let url = host + "/play/" + id + ".html";
    let resp = await req(url, {headers: headers});
    let html = resp.content;
    let m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8/);
    if (m3u8Match) {
        return JSON.stringify({parse: 0, url: m3u8Match[0]});
    }
    let jsonMatch = html.match(/"url":"(https?:\/\/[^"]+\.m3u8)"/);
    if (jsonMatch) {
        return JSON.stringify({parse: 0, url: jsonMatch[1].replace(/\\/g, "")});
    }
    return JSON.stringify({parse: 1, url: url});
}

async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = host + "/search/" + encodeURIComponent(wd) + "-------------.html" + (p > 1 ? "?page=" + p : "");
    let resp = await req(url, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}
