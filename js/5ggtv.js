// 5GGTV.cc - TVBox JS 接口文件
// 使用方法：在 TVBox 配置文件的 sites 数组中添加以下配置
// {
//     "key": "5ggtv",
//     "name": "5GGTV",
//     "type": 3,
//     "api": "5ggtv.js",
//     "searchable": 1,
//     "quickSearch": 1,
//     "filterable": 1
// }

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
    play_parse: true,
    lazy: `js:
        var html = request(input);
        var url = html.match(/var url = ['"](.*?)['"]/)[1];
        var next = html.match(/var next = ['"](.*?)['"]/)[1];
        input = url + next;
    `,
    double: true,
    推荐: '.module-item;.module-item-cover .module-item-pic;*;*;*',
    一级: '.module-item;a&&title;.module-item-cover .module-item-pic&&data-original;.module-item-text&&Text;a&&href',
    二级: {
        title: 'h1&&Text;.module-info-tag-link:eq(1)&&Text',
        img: '.module-item-cover .module-item-pic&&data-original',
        desc: '.module-info-content&&Text',
        content: '.module-info-content&&Text',
        tabs: '.module-tab-item',
        lists: '.module-play-list:eq(#id) a',
    },
    搜索: '.module-search-item;a&&title;.lazyload&&data-original;.module-item-note&&Text;a&&href',
}

function init() {
    console.log("5GGTV 初始化完成");
}

function home(filter) {
    var classes = [];
    var classList = rule.class_name.split('&');
    var classUrl = rule.class_url.split('&');
    
    for (var i = 0; i < classList.length; i++) {
        classes.push({
            type_id: i + 1,
            type_name: classList[i],
            has_sub: false
        });
    }
    
    return JSON.stringify({
        class: classes
    });
}

function homeVod(params) {
    return '{}';
}

function category(tid, pg, filter, extend) {
    var url = rule.host + rule.url.replace('fyclass', tid).replace('fypage', pg);
    var html = request(url);
    
    var list = [];
    try {
        var items = pdfa(html, '.module-item');
        for (var i = 0; i < items.length; i++) {
            var title = pdfh(items[i], 'a&&title');
            var img = pdfh(items[i], '.module-item-cover .module-item-pic&&data-original');
            var note = pdfh(items[i], '.module-item-text&&Text');
            var links = pdfh(items[i], 'a&&href');
            
            if (title && img) {
                list.push({
                    vod_id: links,
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: note
                });
            }
        }
    } catch (e) {
        console.log("获取列表失败：" + e.message);
    }
    
    return JSON.stringify({
        list: list
    });
}

function detail(vod_url) {
    var html = request(vod_url);
    
    try {
        var title = pdfh(html, 'h1&&Text');
        var img = pdfh(html, '.module-item-cover .module-item-pic&&data-original');
        var desc = pdfh(html, '.module-info-content&&Text');
        var content = desc;
        
        // 获取播放列表
        var tabs = pdfa(html, '.module-tab-item');
        var tabNames = [];
        for (var i = 0; i < tabs.length; i++) {
            tabNames.push(pdfh(tabs[i], 'Text'));
        }
        
        var playlists = [];
        for (var i = 0; i < tabNames.length; i++) {
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
            vod_content: content,
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
        var html = request(id);
        var url = html.match(/var url = ['"](.*?)['"]/);
        var next = html.match(/var next = ['"](.*?)['"]/);
        
        if (url && next) {
            var playUrl = url[1] + next[1];
            return JSON.stringify({
                parse: 0,
                url: playUrl,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
        }
    } catch (e) {
        console.log("获取播放地址失败：" + e.message);
    }
    
    return JSON.stringify({
        parse: 0,
        url: id
    });
}

function search(pg, wd) {
    var url = rule.host + '/vod/search/page/' + pg + '/wd/' + wd + '.html';
    var html = request(url);
    
    var list = [];
    try {
        var items = pdfa(html, '.module-search-item');
        for (var i = 0; i < items.length; i++) {
            var title = pdfh(items[i], 'a&&title');
            var img = pdfh(items[i], '.lazyload&&data-original');
            var note = pdfh(items[i], '.module-item-note&&Text');
            var links = pdfh(items[i], 'a&&href');
            
            if (title && img) {
                list.push({
                    vod_id: links,
                    vod_name: title,
                    vod_pic: img,
                    vod_remarks: note
                });
            }
        }
    } catch (e) {
        console.log("搜索失败：" + e.message);
    }
    
    return JSON.stringify({
        list: list
    });
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
        search: search
    };
} catch (e) {
    // 在非 Node.js 环境中静默失败
}
