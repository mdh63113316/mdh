/**
 * 5GGTV.cc - TVBox JS 接口文件
 * 支持多线路自动切换
 * 
 * 使用方法：在 TVBox 配置文件的 sites 数组中添加以下配置
 * {
 *     "key": "5ggtv",
 *     "name": "5GGTV",
 *     "type": 3,
 *     "api": "https://你的服务器地址/5ggtv.js",
 *     "searchable": 1,
 *     "quickSearch": 1,
 *     "filterable": 1
 * }
 */

// 多线路配置，自动尝试可用线路
let hosts = [
    'https://www.5ggtv.cc',
    'https://5ggtv.cc',
    'https://www.5gdy.cc',
    'https://5gdy.cc'
];

let currentHost = hosts[0];
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
    "Referer": currentHost + "/"
};

/**
 * 测试线路可用性
 */
function testHost() {
    for (let i = 0; i < hosts.length; i++) {
        try {
            let testUrl = hosts[i] + "/s/dianying/page/1.html";
            let resp = request(testUrl, { headers: headers, timeout: 5000 });
            if (resp && resp.indexOf("module-item") !== -1) {
                currentHost = hosts[i];
                console.log("成功切换到线路：" + currentHost);
                return true;
            }
        } catch (e) {
            console.log("线路测试失败：" + hosts[i]);
        }
    }
    return false;
}

/**
 * 统一列表解析函数 - 支持多种 HTML 结构
 */
function getList(html) {
    if (!html || typeof html !== 'string') return [];
    
    let videos = [];
    
    // 尝试 1: module-item (现代 CMS)
    let items = pdfa(html, ".module-item");
    if (items && items.length > 0) {
        items.forEach(it => {
            try {
                let title = pdfh(it, '.module-item-title&&Text') || pdfh(it, 'a&&title') || '';
                if (!title) {
                    let titleMatch = it.match(/title="([^"]+)"/);
                    title = titleMatch ? titleMatch[1] : '';
                }
                
                let img = pdfh(it, '.module-item-cover .module-item-pic&&data-original') || pdfh(it, '.module-item-pic&&data-original') || '';
                if (!img) {
                    let imgMatch = it.match(/data-original="([^"]+)"/);
                    img = imgMatch ? imgMatch[1] : '';
                }
                
                let remark = pdfh(it, '.module-item-text&&Text') || '';
                let link = pdfh(it, 'a&&href') || '';
                
                // 提取 ID
                let id = link;
                let idMatch = link.match(/\/v\/(\d+)/) || link.match(/\/detail\/(\d+)/);
                if (idMatch) id = idMatch[1];
                
                if (title) {
                    videos.push({
                        "vod_id": id || link,
                        "vod_name": title.trim(),
                        "vod_pic": (img && img.indexOf('http') !== 0) ? currentHost + img : img,
                        "vod_remarks": remark.trim()
                    });
                }
            } catch (e) {
                console.log("解析失败：" + e.message);
            }
        });
        if (videos.length > 0) return videos;
    }
    
    // 尝试 2: module-card-item (备用)
    items = pdfa(html, ".module-card-item,.module-list-item");
    if (items && items.length > 0) {
        items.forEach(it => {
            try {
                let title = pdfh(it, '.card-title&&Text') || pdfh(it, 'a&&title') || '';
                if (!title) {
                    let titleMatch = it.match(/title="([^"]+)"/);
                    title = titleMatch ? titleMatch[1] : '';
                }
                
                let img = pdfh(it, '.lazyload&&data-original') || pdfh(it, 'img&&src') || '';
                if (!img) {
                    let imgMatch = it.match(/(data-original|src)="([^"]+)"/);
                    img = imgMatch ? imgMatch[2] : '';
                }
                
                let remark = pdfh(it, '.note&&Text') || pdfh(it, '.remarks&&Text') || '';
                let link = pdfh(it, 'a&&href') || '';
                
                if (title) {
                    videos.push({
                        "vod_id": link,
                        "vod_name": title.trim(),
                        "vod_pic": (img && img.indexOf('http') !== 0) ? currentHost + img : img,
                        "vod_remarks": remark.trim()
                    });
                }
            } catch (e) {
                console.log("解析失败：" + e.message);
            }
        });
    }
    
    return videos;
}

/**
 * 获取分类
 */
function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id": "dianying", "type_name": "电影"},
            {"type_id": "dianshiju", "type_name": "电视剧"},
            {"type_id": "zongyi", "type_name": "综艺"},
            {"type_id": "dongman", "type_name": "动漫"},
            {"type_id": "duanju", "type_name": "短剧"}
        ]
    });
}

/**
 * 获取首页推荐
 */
function homeVod() {
    try {
        // 先测试线路
        testHost();
        
        let html = request(currentHost, { headers: headers, timeout: 8000 });
        return JSON.stringify({ list: getList(html) });
    } catch (e) {
        console.log("获取首页推荐失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 获取分类列表
 */
function category(tid, pg, filter, extend) {
    try {
        let p = parseInt(pg);
        let pageStr = p > 1 ? "/page/" + p : "";
        let url = currentHost + "/s/" + tid + pageStr + ".html";
        
        let html = request(url, { headers: headers, timeout: 8000 });
        let list = getList(html);
        
        return JSON.stringify({ 
            list: list,
            page: p,
            pagecount: 999,
            total: list.length
        });
    } catch (e) {
        console.log("获取分类列表失败：" + e.message);
        // 失败时尝试切换线路
        for (let i = 0; i < hosts.length; i++) {
            if (hosts[i] !== currentHost) {
                currentHost = hosts[i];
                try {
                    let p = parseInt(pg);
                    let pageStr = p > 1 ? "/page/" + p : "";
                    let url = currentHost + "/s/" + tid + pageStr + ".html";
                    let html = request(url, { headers: headers, timeout: 8000 });
                    let list = getList(html);
                    return JSON.stringify({ list: list });
                } catch (e2) {
                    continue;
                }
            }
        }
        return JSON.stringify({ list: [] });
    }
}

/**
 * 获取详情
 */
function detail(id) {
    try {
        let url = id;
        if (id.indexOf('http') === -1) {
            if (id.indexOf('/v/') !== 0) {
                url = currentHost + '/v/' + id + '.html';
            } else {
                url = currentHost + id;
            }
        }
        
        let html = request(url, { headers: headers, timeout: 8000 });
        
        // 提取标题
        let title = pdfh(html, 'h1&&Text');
        if (!title) {
            let titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            title = titleMatch ? titleMatch[1] : "未知影片";
        }
        
        // 提取图片
        let img = pdfh(html, '.module-item-cover .module-item-pic&&data-original') || pdfh(html, '.module-item-pic&&src') || '';
        if (!img) {
            let imgMatch = html.match(/data-original="([^"]+)"/);
            img = imgMatch ? imgMatch[1] : '';
        }
        if (img && img.indexOf('http') !== 0 && img.indexOf('//') !== 0) {
            img = currentHost + img;
        }
        
        // 提取描述
        let desc = pdfh(html, '.module-info-content&&Text') || pdfh(html, '.video-info-content&&Text') || '';
        
        // 提取播放线路
        let tabs = pdfa(html, '.module-tab-item');
        let tabNames = [];
        tabs.forEach(tab => {
            let tabText = pdfh(tab, 'Text');
            if (!tabText) {
                let match = tab.match(/<span[^>]*>([^<]+)</);
                tabText = match ? match[1] : '';
            }
            if (tabText) tabNames.push(tabText.trim());
        });
        if (tabNames.length === 0) tabNames = ['默认线路'];
        
        // 提取播放列表
        let playlists = [];
        let playLists = pdfa(html, '.module-play-list,.module-list');
        playLists.forEach((list, index) => {
            let episodes = [];
            let links = pdfa(list, 'a');
            links.forEach(link => {
                let epName = pdfh(link, 'Text');
                let epUrl = pdfh(link, 'a&&href');
                if (epName && epUrl) {
                    episodes.push(epName.trim() + '$' + epUrl);
                }
            });
            if (episodes.length > 0) {
                playlists.push(episodes.join('#'));
            }
        });
        
        if (playlists.length === 0) {
            // 备用方案：提取所有播放链接
            let allLinks = pdfa(html, 'a[href*="/play/"],a[href*="/video/"]');
            let allEpisodes = [];
            allLinks.forEach(link => {
                let name = pdfh(link, 'Text') || '播放';
                let epUrl = pdfh(link, 'a&&href');
                if (epUrl) allEpisodes.push(name.trim() + '$' + epUrl);
            });
            if (allEpisodes.length > 0) {
                playlists = [allEpisodes.join('#')];
            }
        }
        
        return JSON.stringify({
            list: [{
                'vod_id': id,
                'vod_name': title,
                'vod_pic': img,
                'vod_remarks': '',
                'vod_content': desc || '',
                'vod_play_from': tabNames.join('$$$'),
                'vod_play_url': playlists.join('$$$')
            }]
        });
    } catch (e) {
        console.log("获取详情失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 搜索
 */
function search(wd, quick, pg) {
    try {
        let p = parseInt(pg);
        let url = currentHost + "/vod/search/page/" + p + "/wd/" + encodeURIComponent(wd) + ".html";
        
        let html = request(url, { headers: headers, timeout: 8000 });
        let list = getList(html);
        
        return JSON.stringify({ list: list });
    } catch (e) {
        console.log("搜索失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 播放
 */
function play(flag, id, flags) {
    try {
        let url = id;
        
        // 如果已经是播放链接
        if (url.indexOf('http') === 0 || url.indexOf('//') === 0) {
            return JSON.stringify({ parse: 0, url: url, header: headers });
        }
        
        // 构建播放页面 URL
        let playUrl = url;
        if (url.indexOf('/play/') !== 0 && url.indexOf('/video/') !== 0) {
            playUrl = '/video/' + url;
        }
        playUrl = currentHost + playUrl;
        
        let html = request(playUrl, { headers: headers, timeout: 8000 });
        
        // 多种播放地址匹配方式
        let playUrls = [];
        
        // 方式 1: var url = "..."
        let m1 = html.match(/var\s+url\s*=\s*["']([^"']+)["']/);
        if (m1) playUrls.push(m1[1]);
        
        // 方式 2: "url":"..." or "url":"..."
        let m2 = html.match(/["']url["']\s*:\s*["']([^"']+)["']/);
        if (m2) playUrls.push(m2[1]);
        
        // 方式 3: sources: [{ file: "..." }]
        let m3 = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/);
        if (m3) playUrls.push(m3[1]);
        
        // 方式 4: iframe src
        let m4 = html.match(/<iframe[^>]*src\s*=\s*["']([^"']+m3u8[^"']*)["']/);
        if (m4) playUrls.push(m4[1]);
        
        // 方式 5: data:url
        let m5 = html.match(/data:\s*["']([^"'\.]+\.m3u8[^"']*)["']/);
        if (m5) playUrls.push(m5[1]);
        
        // 方式 6: eval 中的 url
        let m6 = html.match(/eval\(function.*?return\s*["']([^"']+)["']/);
        if (m6) playUrls.push(m6[1]);
        
        // 获取第一个可用的播放地址
        for (let i = 0; i < playUrls.length; i++) {
            let playUrl = playUrls[i];
            
            // 处理转义
            playUrl = playUrl.replace(/\\/g, "");
            
            // 如果是相对路径，拼接 host
            if (playUrl.indexOf('http') !== 0 && playUrl.indexOf('//') !== 0) {
                playUrl = currentHost + playUrl;
            }
            
            // 验证是否是视频链接
            if (playUrl.indexOf('.m3u8') !== -1 || playUrl.indexOf('.mp4') !== -1 || playUrl.indexOf('video') !== -1) {
                return JSON.stringify({
                    parse: 0,
                    url: playUrl,
                    header: headers
                });
            }
        }
        
        // 没有找到直接播放地址，返回播放页面让壳子解析
        return JSON.stringify({
            parse: 1,
            url: playUrl,
            header: headers
        });
    } catch (e) {
        console.log("获取播放地址失败：" + e.message);
        return JSON.stringify({ parse: 1, url: id, header: headers });
    }
}

// 导出接口
function init() {
    console.log("5GGTV 初始化完成");
    testHost();
}

try {
    module.exports = {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search
    };
} catch (e) {
    // 在非 Node.js 环境中静默失败
}
