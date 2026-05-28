/**
 * 5GGTV.cc - TVBox JS 接口文件
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

var rule = {
    title: '5GGTV',
    host: 'https://www.5ggtv.cc',
    url: '/s/fyclass/page/fypage.html',
    searchUrl: '/vod/search/page/fypage/wd/**.html',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    class_name: '电影&电视剧&综艺&动漫&短剧',
    class_url: 'dianying&dianshiju&zongyi&dongman&duanju',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 5000,
    play_parse: true,
    lazy: `js:
        var html = request(input);
        var m = html.match(/var\\s+url\\s*=\\s*['"]([^'"]*)['"]/);
        var n = html.match(/var\\s+next\\s*=\\s*['"]([^'"]*)['"]/);
        if (m && n) {
            input = m[1] + n[1];
        } else if (m) {
            input = m[1];
        } else {
            var iframe = html.match(/<iframe[^>]*src=['"]([^'"]*)['"]/);
            if (iframe) {
                input = iframe[1];
            }
        }
    `,
    double: true,
    推荐: '.module-item;.module-item-cover .module-item-pic&&data-original;.module-item-title&&Text;.module-item-text&&Text;a&&href',
    一级: '.module-item;.module-item-title&&Text;.module-item-cover .module-item-pic&&data-original;.module-item-text&&Text;a&&href',
    二级访问前: '',
    二级: `js:
        log('进入二级页面:' + input);
        var html = request(input);
        var title = pdfh(html, 'h1&&Text');
        var img = pdfh(html, '.module-item-cover .module-item-pic img&&src');
        if (!img) img = pdfh(html, '.module-item-cover .module-item-pic&&data-original');
        var desc = pdfh(html, '.module-info-content&&Text');
        if (!desc) desc = pdfh(html, '.module-info-tag&&Text');
        var content = desc;
        
        // 获取播放列表
        var tabs = pdfa(html, '.module-tab-item');
        var tabNames = [];
        for (var i = 0; i < tabs.length; i++) {
            var tabName = pdfh(tabs[i], 'Text');
            tabNames.push(tabName);
        }
        
        var playlists = [];
        for (var i = 0; i < tabs.length; i++) {
            var tabItems = pdfa(html, '.module-play-list:eq(' + i + ') a');
            var episodes = [];
            for (var j = 0; j < tabItems.length; j++) {
                var epTitle = pdfh(tabItems[j], 'Text');
                var epUrl = pdfh(tabItems[j], 'a&&href');
                episodes.push(epTitle + '$' + epUrl);
            }
            playlists.push(episodes.join('#'));
        }
        
        VOD = {
            vod_id: input,
            vod_name: title,
            vod_pic: img,
            vod_remarks: '',
            vod_content: content,
            vod_play_from: tabNames.join('$$$'),
            vod_play_url: playlists.join('$$$')
        };
    `,
    搜索: '.module-search-item;.module-search-card-content a&&title;.module-search-card-content img&&src;.module-search-card-footer span&&Text;a&&href',
}

// 标准接口函数
function init() {
    console.log("5GGTV 初始化完成");
}

function home(filter) {
    var classes = [];
    var classList = rule.class_name.split('&');
    var classUrl = rule.class_url.split('&');
    
    for (var i = 0; i < classList.length; i++) {
        classes.push({
            type_id: classUrl[i],
            type_name: classList[i],
            has_sub: false
        });
    }
    
    return JSON.stringify({
        class: classes
    });
}

function homeVod(params) {
    try {
        var url = rule.host + rule.url.replace('fyclass', rule.class_url.split('&')[0]).replace('fypage', '1');
        var html = request(url);
        var list = [];
        
        var items = pdfa(html, rule.推荐.split(';')[0]);
        for (var i = 0; i < items.length && i < rule.limit; i++) {
            var segments = rule.推荐.split(';');
            var title = pdfh(items[i], segments[2]);
            var img = pdfh(items[i], segments[1]);
            var note = pdfh(items[i], segments[3]);
            var link = pdfh(items[i], segments[4]);
            
            if (title && img) {
                list.push({
                    vod_id: link,
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: note
                });
            }
        }
        
        return JSON.stringify({
            list: list
        });
    } catch (e) {
        console.log("获取首页推荐失败：" + e.message);
        return '{}';
    }
}

function category(tid, pg, filter, extend) {
    try {
        var url = rule.host + rule.url.replace('fyclass', tid).replace('fypage', pg);
        var html = request(url, {
            headers: rule.headers,
            timeout: rule.timeout
        });
        
        var list = [];
        var items = pdfa(html, rule.一级.split(';')[0]);
        
        for (var i = 0; i < items.length; i++) {
            var segments = rule.一级.split(';');
            var title = pdfh(items[i], segments[1]);
            var img = pdfh(items[i], segments[2]);
            var note = pdfh(items[i], segments[3]);
            var link = pdfh(items[i], segments[4]);
            
            if (title && link) {
                list.push({
                    vod_id: link,
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: note
                });
            }
        }
        
        return JSON.stringify({
            list: list,
            page: parseInt(pg),
            pagecount: 999,
            total: items.length
        });
    } catch (e) {
        console.log("获取分类页面失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

function detail(vod_url) {
    try {
        var html = request(vod_url, {
            headers: rule.headers,
            timeout: rule.timeout
        });
        
        var title = pdfh(html, 'h1&&Text');
        if (!title) title = '未知影片';
        
        var img = pdfh(html, '.module-item-cover .module-item-pic img&&src');
        if (!img) img = pdfh(html, '.module-item-cover .module-item-pic&&data-original');
        
        var desc = pdfh(html, '.module-info-content&&Text');
        if (!desc) desc = pdfh(html, '.module-info-tag&&Text');
        if (!desc) desc = '';
        
        // 获取播放列表
        var tabs = pdfa(html, '.module-tab-item');
        var tabNames = [];
        for (var i = 0; i < tabs.length; i++) {
            var tabName = pdfh(tabs[i], 'Text');
            tabNames.push(tabName);
        }
        
        var playlists = [];
        for (var i = 0; i < tabs.length; i++) {
            var tabItems = pdfa(html, '.module-play-list:eq(' + i + ') a');
            var episodes = [];
            for (var j = 0; j < tabItems.length; j++) {
                var epTitle = pdfh(tabItems[j], 'Text');
                var epUrl = pdfh(tabItems[j], 'a&&href');
                episodes.push(epTitle + '$' + epUrl);
            }
            playlists.push(episodes.join('#'));
        }
        
        return JSON.stringify({
            vod_id: vod_url,
            vod_name: title,
            vod_pic: img,
            vod_remarks: '',
            vod_content: desc,
            vod_play_from: tabNames.join('$$$'),
            vod_play_url: playlists.join('$$$')
        });
    } catch (e) {
        console.log("获取详情失败：" + e.message);
        return '{}';
    }
}

function play(flag, id, flags) {
    try {
        var url = id;
        if (url.indexOf('http') === 0 || url.indexOf('//') === 0) {
            return JSON.stringify({
                parse: 0,
                url: url,
                header: rule.headers
            });
        }
        
        var fullUrl = rule.host + (url.indexOf('/') === 0 ? url : '/' + url);
        var html = request(fullUrl, {
            headers: rule.headers,
            timeout: rule.timeout
        });
        
        // 尝试多种匹配方式
        var matches = [
            html.match(/var\\s+url\\s*=\\s*['"]([^'"]*)['"]/),
            html.match(/var\\s*source\\s*=\\s*\\[\\{[^}]*url:\\s*['"]([^'"]*)['"]/),
            html.match(/<iframe[^>]*src=['"]([^'"]*)['"]/),
            html.match(/data:\\s*['"]([^'"]+m3u8[^'"]*)['"]/),
            html.match(/sources:\\s*\\[\\{[^}]*file:\\s*['"]([^'"]*)['"]/)
        ];
        
        for (var i = 0; i < matches.length; i++) {
            if (matches[i]) {
                var playUrl = matches[i][1];
                if (playUrl && playUrl.indexOf('http') !== 0 && playUrl.indexOf('//') !== 0) {
                    playUrl = rule.host + playUrl;
                }
                return JSON.stringify({
                    parse: 0,
                    url: playUrl,
                    header: rule.headers
                });
            }
        }
        
        return JSON.stringify({
            parse: 1,
            url: fullUrl
        });
    } catch (e) {
        console.log("获取播放地址失败：" + e.message);
        return JSON.stringify({
            parse: 0,
            url: id
        });
    }
}

function search(pg, wd) {
    try {
        var url = rule.host + '/vod/search/page/' + pg + '/wd/' + encodeURIComponent(wd) + '.html';
        var html = request(url, {
            headers: rule.headers,
            timeout: rule.timeout
        });
        
        var list = [];
        var items = pdfa(html, rule.搜索.split(';')[0]);
        
        for (var i = 0; i < items.length; i++) {
            var segments = rule.搜索.split(';');
            var title = pdfh(items[i], segments[1]);
            var img = pdfh(items[i], segments[2]);
            var note = pdfh(items[i], segments[3]);
            var link = pdfh(items[i], segments[4]);
            
            if (title && link) {
                list.push({
                    vod_id: link,
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: note
                });
            }
        }
        
        return JSON.stringify({
            list: list
        });
    } catch (e) {
        console.log("搜索失败：" + e.message);
        return JSON.stringify({ list: [] });
    }
}

// 导出接口
try {
    module.exports = {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search,
        rule: rule
    };
} catch (e) {
    // 在非 Node.js 环境中静默失败
}
