// 终极兼容版 - 纯函数式，无任何现代语法
var HOST = 'https://www.ylys.tv';
var HEADERS = {"User-Agent": "Mozilla/5.0"};

function init() { return JSON.stringify({}); }
function home() {
    return JSON.stringify({
        class: [
            {type_id:1, type_name:"电影"},
            {type_id:2, type_name:"电视剧"},
            {type_id:3, type_name:"综艺"},
            {type_id:4, type_name:"动漫"}
        ],
        filters: {}
    });
}
function homeVod() {
    var html = request(HOST, {headers:HEADERS}).content;
    var list = [];
    var items = html.match(/<a[^>]+href="\/voddetail\/(\d+)\.html[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi);
    if (items) {
        for (var i=0; i<items.length && i<20; i++) {
            var id = items[i].match(/\/voddetail\/(\d+)/);
            var pic = items[i].match(/src="([^"]+)"/);
            if (id) list.push({
                vod_id: id[1],
                vod_name: "视频" + i,
                vod_pic: pic ? pic[1] : ''
            });
        }
    }
    return JSON.stringify({list: list});
}
function category(tid, pg) {
    var url = HOST + '/vodtype/' + tid + (pg>1?'/page/'+pg:'');
    var html = request(url, {headers:HEADERS}).content;
    var list = [];
    var items = html.match(/<a[^>]+href="\/voddetail\/(\d+)\.html[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi);
    if (items) {
        for (var i=0; i<items.length; i++) {
            var id = items[i].match(/\/voddetail\/(\d+)/);
            var pic = items[i].match(/src="([^"]+)"/);
            if (id) list.push({
                vod_id: id[1],
                vod_name: "视频"+id[1],
                vod_pic: pic?pic[1]:''
            });
        }
    }
    return JSON.stringify({list: list, page: pg});
}
function detail(id) {
    var url = HOST + '/voddetail/' + id + '.html';
    var html = request(url, {headers:HEADERS}).content;
    var name = (html.match(/<h1>([^<]+)<\/h1>/) || ['',''])[1];
    var pic = (html.match(/data-original="([^"]+)"/) || ['',''])[1];
    var content = (html.match(/<div class="content">([\s\S]*?)<\/div>/) || ['',''])[1];
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_content: content,
            vod_play_from: '默认',
            vod_play_url: '1$'+id
        }]
    });
}
function search(wd) {
    var url = HOST + '/vodsearch/' + encodeURIComponent(wd) + '.html';
    var html = request(url, {headers:HEADERS}).content;
    var list = [];
    var items = html.match(/<a[^>]+href="\/voddetail\/(\d+)\.html[^>]*>([^<]+)<\/a>/gi);
    if (items) {
        for (var i=0; i<items.length; i++) {
            var id = items[i].match(/\/voddetail\/(\d+)/);
            var name = items[i].match(/>([^<]+)</);
            if (id) list.push({vod_id:id[1], vod_name:name?name[1]:''});
        }
    }
    return JSON.stringify({list: list});
}
function play(flag, id) {
    var url = HOST + '/play/' + id + '.html';
    var html = request(url, {headers:HEADERS}).content;
    var m3u8 = html.match(/url:\s*['"]([^'"]+\.m3u8)['"]/);
    if (m3u8) return JSON.stringify({parse:0, url:m3u8[1]});
    return JSON.stringify({parse:1, url:url});
}

return {init,home,homeVod,category,detail,search,play};
