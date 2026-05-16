// 基础配置
var host = 'https://acsux.cn';
var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 通用请求
async function req(url) {
    var r = await fetch(url, { headers: headers });
    return await r.text();
}

// 清理文字
function clean(str) {
    if (!str) return '';
    return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// 提取视频列表（适配 acsux.cn 真实结构）
function getList(html) {
    var videos = [];
    // 匹配 <a href="/dt/数字.html" ...> 且内部有图片或文字
    var reg = /<a[^>]+href="\/dt\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;
    while ((match = reg.exec(html))) {
        var id = match[1];
        var block = match[2];
        // 获取标题：先从 title 属性，再从 alt，最后取文本
        var title = '';
        var tMatch = /title="([^"]+)"/i.exec(match[0]);
        if (tMatch) title = clean(tMatch[1]);
        if (!title) {
            var altMatch = /alt="([^"]+)"/i.exec(block);
            if (altMatch) title = clean(altMatch[1]);
        }
        if (!title) {
            var txt = block.replace(/<[^>]+>/g, '').trim();
            if (txt) title = txt;
        }
        if (!title) continue;
        // 获取图片
        var pic = '';
        var pMatch = /data-original="([^"]+)"/i.exec(block) || /src="([^"]+)"/i.exec(block);
        if (pMatch) {
            pic = pMatch[1];
            if (pic.startsWith('/')) pic = host + pic;
        }
        // 获取备注（如“全24集”）
        var remark = '';
        var rMatch = /class="module-item-note"[^>]*>([^<]+)<\/div>/.exec(block);
        if (rMatch) remark = clean(rMatch[1]);
        videos.push({ vod_id: id, vod_name: title, vod_pic: pic, vod_remarks: remark });
    }
    // 如果一条都没抓到，返回一个测试数据（用于验证接口被调用了）
    if (videos.length === 0) {
        videos.push({ vod_id: 'debug', vod_name: '调试信息：未解析到数据，请提供网站源码', vod_pic: '', vod_remarks: '' });
    }
    return videos;
}

// 首页分类
async function home() {
    return JSON.stringify({
        class: [
            { type_id: '2', type_name: '电影' },
            { type_id: '1', type_name: '剧集' },
            { type_id: '3', type_name: '动漫' },
            { type_id: '4', type_name: '综艺' }
        ],
        filters: {}
    });
}

// 首页推荐
async function homeVod() {
    var html = await req(host);
    var list = getList(html);
    return JSON.stringify({ list: list });
}

// 分类页
async function category(tid, pg) {
    var page = pg || 1;
    var url = host + '/cp/' + tid + (page > 1 ? '/page/' + page + '.html' : '.html');
    var html = await req(url);
    var list = getList(html);
    return JSON.stringify({ list: list, page: parseInt(page) });
}

// 详情页
async function detail(id) {
    var html = await req(host + '/dt/' + id + '.html');
    // 提取名称
    var name = '';
    var h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(html);
    if (h1) name = clean(h1[1]);
    // 提取图片
    var pic = '';
    var img = /<img[^>]+(?:data-original|src)="([^"]+)"/.exec(html);
    if (img) pic = img[1].startsWith('/') ? host + img[1] : img[1];
    // 提取简介
    var desc = '';
    var meta = /<meta name="description" content="([^"]*)"/.exec(html);
    if (meta) desc = clean(meta[1]);
    // 提取播放列表
    var playFrom = '云播放';
    var playUrl = '';
    var eps = [];
    var epReg = /onclick="location\.replace\('\/play\/([^']+)'\)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
    var ep;
    while ((ep = epReg.exec(html))) {
        eps.push(clean(ep[2]) + '$' + ep[1]);
    }
    if (eps.length) playUrl = eps.join('#');
    else {
        // 尝试直接提取m3u8
        var m3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8/);
        if (m3u8) playUrl = '播放$' + m3u8[0];
    }
    return JSON.stringify({
        list: [{
            vod_id: id, vod_name: name, vod_pic: pic,
            vod_content: desc, vod_play_from: playFrom, vod_play_url: playUrl
        }]
    });
}

// 播放
async function play(flag, id) {
    var url = host + '/play/' + id;
    var html = await req(url);
    var m3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8/);
    if (m3u8) return JSON.stringify({ parse: 0, url: m3u8[0] });
    var iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (iframe) return JSON.stringify({ parse: 1, url: iframe[1] });
    return JSON.stringify({ parse: 1, url: url });
}

// 搜索
async function search(wd, pg) {
    var page = pg || 1;
    var searchUrl = host + '/search/' + encodeURIComponent(wd) + '-------------.html' + (page > 1 ? '/page/' + page + '.html' : '');
    var html = await req(searchUrl);
    var list = getList(html);
    return JSON.stringify({ list: list });
}

// 注意：没有 export default，TVBox 直接调用这些全局函数
