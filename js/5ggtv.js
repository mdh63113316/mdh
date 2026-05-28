/**
 * 5GGTV.cc - TVBox JS 接口文件
 * 参考永乐视频.js 写法优化
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

let host = 'https://www.5ggtv.cc';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": host + "/"
};

/**
 * 统一列表解析函数
 */
function getList(html) {
    let videos = [];
    let items = pdfa(html, ".module-item,.module-card-item,.module-list-item");
    
    items.forEach(it => {
        try {
            // 提取 ID - 从链接中提取
            let idMatch = it.match(/\/v\/(\d+)\.html/) || it.match(/\/detail\/(\d+)/) || it.match(/href="([^"]+)"/);
            let id = idMatch ? (idMatch[1] || idMatch[0]) : "";
            
            // 提取标题
            let nameMatch = it.match(/title="([^"]+)"/) || it.match(/alt="([^"]+)"/) || it.match(/<strong>([^<]+)<\/strong>/);
            let name = nameMatch ? (nameMatch[1] || nameMatch[0]) : "";
            
            // 提取图片
            let picMatch = it.match(/data-original="([^"]+)"/) || it.match(/src="([^"]+)"/) || it.match(/data-src="([^"]+)"/);
            let pic = picMatch ? (picMatch[1] || picMatch[0]) : "";
            if (pic && pic.indexOf('http') !== 0 && pic.indexOf('//') !== 0) {
                pic = host + pic;
            }
            
            // 提取备注
            let remarkMatch = it.match(/module-item-note[^>]*>([^<]+)<\//) || it.match(/module-item-text[^>]*>([^<]+)<\//);
            let remark = remarkMatch ? remarkMatch[1].trim() : "";
            
            if (id && name) {
                videos.push({
                    "vod_id": id,
                    "vod_name": name.replace(/<.*?>/g, "").trim(),
                    "vod_pic": pic,
                    "vod_remarks": remark
                });
            }
        } catch (e) {
            console.log("解析列表项失败：" + e.message);
        }
    });
    
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
        ],
        "filters": {
            "dianying": [
                {"key": "class", "name": "类型", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "动作片", "v": "dongzuopian"},
                    {"n": "喜剧片", "v": "xijupian"},
                    {"n": "爱情片", "v": "aiqingpian"},
                    {"n": "科幻片", "v": "kehuanpian"},
                    {"n": "恐怖片", "v": "kongbupian"},
                    {"n": "剧情片", "v": "juqingpian"},
                    {"n": "战争片", "v": "zhanzhengpian"}
                ]}
            ],
            "dianshiju": [
                {"key": "class", "name": "类型", "value": [
                    {"n": "全部", "v": ""},
                    {"n": "国产剧", "v": "guochanju"},
                    {"n": "港台剧", "v": "gangtaiju"},
                    {"n": "日韩剧", "v": "rihanju"},
                    {"n": "欧美剧", "v": "oumeiju"},
                    {"n": "泰国剧", "v": "taiguoju"}
                ]}
            ]
        }
    });
}

/**
 * 获取首页推荐
 */
function homeVod() {
    try {
        let html = request(host, { headers: headers });
        return JSON.stringify({ 
            list: getList(html)
        });
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
        let url = host + "/s/" + tid + pageStr + ".html";
        
        let html = request(url, { headers: headers });
        let list = getList(html);
        
        return JSON.stringify({ 
            list: list,
            page: p,
            pagecount: 999,
            total: list.length
        });
    } catch (e) {
        console.log("获取分类列表失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 获取详情
 */
function detail(id) {
    try {
        let url = host + id;
        if (id.indexOf('/v/') !== 0 && id.indexOf('http') !== 0) {
            url = host + '/v/' + id + '.html';
        } else if (id.indexOf('http') !== 0) {
            url = host + id;
        }
        
        let html = request(url, { headers: headers });
        
        // 提取标题
        let title = pdfh(html, 'h1&&Text');
        if (!title) {
            let titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            title = titleMatch ? titleMatch[1] : "未知影片";
        }
        
        // 提取图片
        let img = pdfh(html, '.module-item-cover .module-item-pic img&&src');
        if (!img) {
            let imgMatch = html.match(/data-original="([^"]+)"/) || html.match(/src="([^"]+)"/);
            img = imgMatch ? (imgMatch[1] || imgMatch[0]) : "";
        }
        if (img && img.indexOf('http') !== 0 && img.indexOf('//') !== 0) {
            img = host + img;
        }
        
        // 提取描述
        let desc = pdfh(html, '.module-info-content&&Text');
        if (!desc) {
            let descMatch = html.match(/introduction-content[^>]*>.*?<p[^>]*>([^<]+)</);
            desc = descMatch ? descMatch[1] : "";
        }
        
        // 提取播放线路
        let tabs = pdfa(html, '.module-tab-item');
        let tabNames = [];
        tabs.forEach(tab => {
            let tabText = pdfh(tab, 'Text') || (tab.match(/<span[^>]*>([^<]+)</) || ["",""])[1];
            if (tabText) tabNames.push(tabText.trim());
        });
        
        // 提取播放列表
        let playlists = [];
        let playLists = pdfa(html, '.module-play-list,.module-list');
        playLists.forEach((list, index) => {
            let episodes = [];
            let links = pdfa(list, 'a');
            links.forEach(link => {
                let epName = pdfh(link, 'Text') || (link.match(/<span[^>]*>([^<]+)</) || ["",""])[1];
                let epUrl = pdfh(link, 'a&&href') || (link.match(/href="([^"]+)"/) || ["",""])[1];
                if (epName && epUrl) {
                    episodes.push(epName.trim() + '$' + epUrl);
                }
            });
            if (episodes.length > 0) {
                playlists.push(episodes.join('#'));
            }
        });
        
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
        let pageStr = p > 1 ? "/page/" + p : "";
        let url = host + "/vod/search/page/" + p + "/wd/" + encodeURIComponent(wd) + pageStr + ".html";
        
        let html = request(url, { headers: headers });
        let list = getList(html);
        
        return JSON.stringify({ 
            list: list
        });
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
        
        // 如果已经是完整 URL，直接返回
        if (url.indexOf('http') === 0 || url.indexOf('//') === 0) {
            return JSON.stringify({ 
                parse: 0, 
                url: url, 
                header: headers 
            });
        }
        
        // 构建播放页面 URL
        let playUrl = host + url;
        if (url.indexOf('/video/') !== 0 && url.indexOf('/v/') !== 0) {
            playUrl = host + '/video/' + url;
        }
        
        let html = request(playUrl, { headers: headers });
        
        // 尝试多种匹配方式
        let m3u8 = null;
        
        // 方式 1: var url = "xxx.m3u8"
        let match1 = html.match(/var\s+url\s*=\s*["']([^"']+)["']/);
        if (match1) m3u8 = match1[1];
        
        // 方式 2: "url":"xxx.m3u8"
        if (!m3u8) {
            let match2 = html.match(/["']url["']\s*:\s*["']([^"']+)["']/);
            if (match2) m3u8 = match2[1];
        }
        
        // 方式 3: sources: [{file: "xxx.m3u8"}]
        if (!m3u8) {
            let match3 = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/);
            if (match3) m3u8 = match3[1];
        }
        
        // 方式 4: iframe src
        if (!m3u8) {
            let match4 = html.match(/<iframe[^>]*src\s*=\s*["']([^"']+)["']/);
            if (match4) m3u8 = match4[1];
        }
        
        // 方式 5: data:url
        if (!m3u8) {
            let match5 = html.match(/data:\s*["']([^"'\.]+\.m3u8[^"']*)["']/);
            if (match5) m3u8 = match5[1];
        }
        
        if (m3u8) {
            // 处理转义字符
            m3u8 = m3u8.replace(/\\/g, "");
            // 如果是相对路径，拼接 host
            if (m3u8.indexOf('http') !== 0 && m3u8.indexOf('//') !== 0) {
                m3u8 = host + m3u8;
            }
            return JSON.stringify({ 
                parse: 0, 
                url: m3u8, 
                header: headers 
            });
        }
        
        // 没有找到播放地址，返回播放页面 URL 让壳子解析
        return JSON.stringify({ 
            parse: 1, 
            url: playUrl,
            header: headers 
        });
    } catch (e) {
        console.log("获取播放地址失败：" + e.message);
        return JSON.stringify({ 
            parse: 1, 
            url: host + '/video/' + id,
            header: headers 
        });
    }
}

// 导出接口
function init() {
    console.log("5GGTV 初始化完成");
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
