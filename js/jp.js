var rule = {
    title: '金牌影院',
    host: 'https://www.sizhengxt.com',
    homeUrl: '/',
    classUrl: '/vod/show/id/{class}/page/{page}.html',
    detailUrl: '/vod/detail/id/{vid}.html',
    searchUrl: '/search/page/{page}.html?wd={wd}',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000,
    class_name: '电影&电视剧&综艺&动漫&短剧&动作片&喜剧片&爱情片&科幻片&恐怖片&剧情片&战争片&国产剧&港剧&日剧&韩剧&海外剧&番剧',
    class_url: '1&2&3&4&20&6&7&8&9&10&11&12&13&14&15&16&17&18'
};

// 通用请求函数
function getPage(url) {
    return getHtml(url, { headers: rule.headers });
}

// 提取视频列表（通用）
function parseVodList(html, host) {
    let list = [];
    // 匹配 <a href="/vod/detail/id/xxx.html" class="xxx"> 或类似结构
    let reg = /<a[^>]*href="([^"]*\/vod\/detail\/id\/\d+\.html)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h[^>]*>([^<]+)<\/h[^>]*>/gi;
    let match;
    while ((match = reg.exec(html)) !== null) {
        let url = match[1];
        let pic = match[2];
        let name = match[3];
        if (name && url) {
            list.push({
                vod_id: url,
                vod_name: name.trim(),
                vod_pic: pic.startsWith('http') ? pic : host + pic
            });
        }
    }
    // 如果上面没匹配到，使用更宽松的正则
    if (list.length === 0) {
        let reg2 = /<a[^>]*href="([^"]*\/vod\/detail\/id\/\d+\.html)"[^>]*>([^<]+)<\/a>/gi;
        while ((match = reg2.exec(html)) !== null) {
            let url = match[1];
            let name = match[2];
            if (name && url && !name.includes('播放') && !name.includes('评论')) {
                list.push({
                    vod_id: url,
                    vod_name: name.trim(),
                    vod_pic: ''
                });
            }
        }
    }
    return list;
}

// 首页
async function homeVod() {
    let html = await getPage(rule.host + rule.homeUrl);
    if (!html) return JSON.stringify({ list: [] });
    let list = parseVodList(html, rule.host);
    return JSON.stringify({ list: list.slice(0, 20) });
}

// 分类
async function category(tid, pg, filter, extend) {
    let url = rule.host + rule.classUrl.replace('{class}', tid).replace('{page}', pg);
    let html = await getPage(url);
    if (!html) return JSON.stringify({ list: [] });
    let list = parseVodList(html, rule.host);
    // 尝试提取总页数
    let pageCount = 1;
    let pageMatch = html.match(/<a[^>]*href="[^"]*\/page\/(\d+)\.html"[^>]*>(\d+)<\/a>/g);
    if (pageMatch && pageMatch.length) {
        let maxPage = 0;
        for (let link of pageMatch) {
            let num = parseInt(link.match(/>(\d+)</)[1]);
            if (num > maxPage) maxPage = num;
        }
        if (maxPage > 0) pageCount = maxPage;
    }
    return JSON.stringify({
        list: list,
        page: pg,
        pagecount: pageCount,
        limit: 20,
        total: list.length
    });
}

// 详情
async function detail(vod_url) {
    let html = await getPage(vod_url.startsWith('http') ? vod_url : rule.host + vod_url);
    if (!html) return JSON.stringify({});

    // 提取标题
    let title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    // 提取图片
    let pic = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*vod-img[^"]*"/i)?.[1] || '';
    if (!pic) pic = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1] || '';
    // 提取简介
    let content = html.match(/<div[^>]*class="[^"]*vod-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    content = content.replace(/<[^>]+>/g, '').trim();

    // 提取播放列表（关键）
    let playList = [];
    // 常见播放列表结构：<div class="playlist"><a href="...">第01集</a> ... </div>
    let playBlock = html.match(/<div[^>]*class="[^"]*playlist[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (playBlock) {
        let links = playBlock[1].match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
        if (links) {
            for (let link of links) {
                let url = link.match(/href="([^"]+)"/)?.[1];
                let name = link.match(/>([^<]+)</)?.[1];
                if (url && name && !url.includes('javascript:')) {
                    playList.push({ title: name.trim(), url: url });
                }
            }
        }
    }
    // 如果没找到，尝试其他常见class
    if (playList.length === 0) {
        let playBlock2 = html.match(/<ul[^>]*class="[^"]*play-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
        if (playBlock2) {
            let links = playBlock2[1].match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
            if (links) {
                for (let link of links) {
                    let url = link.match(/href="([^"]+)"/)?.[1];
                    let name = link.match(/>([^<]+)</)?.[1];
                    if (url && name && !url.includes('javascript:')) {
                        playList.push({ title: name.trim(), url: url });
                    }
                }
            }
        }
    }

    let playFrom = '播放源';
    let playUrlStr = playList.map(v => `${v.title}$${v.url}`).join('#');
    return JSON.stringify({
        vod_id: vod_url,
        vod_name: title,
        vod_pic: pic,
        vod_content: content,
        vod_play_from: playFrom,
        vod_play_url: playUrlStr
    });
}

// 播放
async function play(flag, id, flags) {
    // 直接返回链接，如果需要解析重定向可在这里处理
    return JSON.stringify({ parse: 0, url: id });
}

// 搜索
async function search(wd, quick, pg) {
    let url = rule.host + rule.searchUrl.replace('{wd}', encodeURIComponent(wd)).replace('{page}', pg);
    let html = await getPage(url);
    if (!html) return JSON.stringify({ list: [] });
    let list = parseVodList(html, rule.host);
    return JSON.stringify({ list: list });
}
