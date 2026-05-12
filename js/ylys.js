// 网站基础信息配置
let host = 'https://www.ylys.tv';  // 网站主域名
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// --- 通用初始化函数 (必须) ---
async function init(cfg) {
    // 此函数在爬虫加载时被调用，可用于初始化配置
    return JSON.stringify({});
}

// --- 通用解析函数：从HTML中提取视频列表 ---
function getList(html) {
    let videos = [];
    // 查找视频项目元素，选择器根据网站结构调整
    let items = pdfa(html, ".module-item, .module-card-item, .fed-list-item");
    items.forEach(it => {
        // 1. 提取视频ID (从详情页链接中)
        let idMatch = it.match(/detail\/(\d+)/) || it.match(/voddetail\/(\d+)/);
        // 2. 提取视频名称
        let nameMatch = it.match(/title="(.*?)"/) || it.match(/alt="(.*?)"/) || it.match(/<a[^>]*>(.*?)<\/a>/);
        // 3. 提取视频封面图URL
        let picMatch = it.match(/data-original="(.*?)"/) || it.match(/src="(.*?)"/);
        
        if (idMatch && nameMatch) {
            let pic = picMatch ? (picMatch[1] || "") : "";
            videos.push({
                "vod_id": idMatch[1],
                "vod_name": nameMatch[1].replace(/<.*?>/g, ""),
                "vod_pic": pic.startsWith('/') ? host + pic : pic,
                // 备注信息 (如更新至第几集)
                "vod_remarks": (it.match(/note">(.*?)</) || ["", ""])[1].replace(/<.*?>/g, "")
            });
        }
    });
    return videos;
}

// --- 首页: 获取分类列表和筛选器 ---
async function home(filter) {
    // 硬编码的分类ID和名称，与网站实际分类对应
    return JSON.stringify({
        "class": [
            {"type_id": "1", "type_name": "电影"},
            {"type_id": "2", "type_name": "电视剧"},
            {"type_id": "3", "type_name": "综艺"},
            {"type_id": "4", "type_name": "动漫"},
            // 你可以在这里继续添加更多分类
        ],
        "filters": {}  // 筛选器功能未实现，可根据需要扩展
    });
}

// --- 首页推荐: 获取首页展示的视频列表 ---
async function homeVod() {
    let resp = await req(host, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}

// --- 分类页: 获取指定分类下的视频列表 ---
async function category(tid, pg, filter, extend) {
    let p = pg || 1;
    // 根据网站实际路由结构构造URL，这里使用常见的苹果CMS路由
    let url = `${host}/vodtype/${tid}/${p > 1 ? `page/${p}/` : ''}`;
    let resp = await req(url, {headers: headers});
    return JSON.stringify({
        "list": getList(resp.content),
        "page": parseInt(p)
    });
}

// --- 详情页: 获取视频的详细信息 ---
async function detail(id) {
    let url = `${host}/voddetail/${id}/`;
    let resp = await req(url, {headers: headers});
    let html = resp.content;
    
    // 1. 提取播放源名称 (如 "量子资源", "快播云" 等)
    let playFrom = pdfa(html, ".module-tab-item").map(it => {
        return (it.match(/<span>(.*?)<\/span>/) || ["", "默认线路"])[1];
    }).join('$$$');
    
    // 2. 提取播放地址列表
    let playUrl = pdfa(html, ".module-play-list-content").map(list => {
        return pdfa(list, "a").map(a => {
            let name = (a.match(/<span>(.*?)<\/span>/) || ["", "播放"])[1];
            let urlMatch = a.match(/href="\/play\/([^"]+)"/);
            return name + '$' + (urlMatch ? urlMatch[1] : "");
        }).join('#');
    }).join('$$$');
    
    // 3. 提取其他信息
    let vod_name = (html.match(/<h1[^>]*>(.*?)<\/h1>/) || ["", ""])[1];
    let vod_pic = (html.match(/data-original="([^"]+)"/) || ["", ""])[1];
    let vod_content = (html.match(/<div class="[^"]*content[^"]*">(.*?)<\/div>/) || ["", ""])[1];
    vod_content = vod_content.replace(/<[^>]+>/g, ''); // 去除HTML标签
    
    return JSON.stringify({
        list: [{
            'vod_id': id,
            'vod_name': vod_name,
            'vod_pic': vod_pic,
            'vod_content': vod_content,
            'vod_play_from': playFrom,
            'vod_play_url': playUrl
        }]
    });
}

// --- 搜索功能 ---
async function search(wd, quick, pg) {
    let p = pg || 1;
    let url = `${host}/vodsearch/${encodeURIComponent(wd)}-------------/${p > 1 ? `page/${p}/` : ''}`;
    let resp = await req(url, {headers: headers});
    return JSON.stringify({list: getList(resp.content)});
}

// --- 播放: 解析出最终的m3u8视频地址 ---
async function play(flag, id, flags) {
    let url = `${host}/play/${id}/`;
    let resp = await req(url, {headers: headers});
    // 从页面中提取 .m3u8 地址
    let m3u8 = resp.content.match(/"url":"([^"]+\.m3u8)"/);
    if (m3u8) {
        // 如果找到，直接返回真实地址
        return JSON.stringify({
            parse: 0,  // parse=0 表示这是最终播放地址，无需再解析
            url: m3u8[1].replace(/\\/g, ""),
            header: headers
        });
    }
    // 如果没找到，则返回当前页面URL，由TVBox内部解析器尝试处理
    return JSON.stringify({
        parse: 1,
        url: url,
        header: headers
    });
}

// 导出所有函数，供TVBox调用
export default { init, home, homeVod, category, detail, search, play };
