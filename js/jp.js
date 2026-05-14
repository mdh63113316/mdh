var rule = {
    title:'金牌影院',
    host:'https://www.sizhengxt.com',
    url:'/show/fyclass--------fypage---.html',
    searchUrl:'/search/------------fypage---.html?wd=**',
    searchable:2,
    quickSearch:0,
    filterable:0,
    class_parse:'.fed-navs li a;a&&Text;a&&href;/(\\d+).html',
    headers:{'User-Agent':'MOBILE_UA'},
    timeout:5000,
    class_name:'电影&电视剧&综艺&动漫&伦理&福利&动作片&喜剧片&爱情片&科幻片&恐怖片&剧情片&战争片&国产剧&港剧&日剧&韩剧&海外剧&番剧',
    class_url:'1&2&3&4&40&41&6&7&8&9&10&11&12&13&20&28&29&30&31'
};

/**
 * 首页数据
 */
async function homeVod(params) {
    let html = await getHtml(rule.host);
    let vodList = [];
    let list = html.match(/<a href="(\\/vod\\/[^"]+)"[^>]*>([^<]+)<\\/a>/g);
    if (list) {
        list.forEach(item => {
            let url = item.match(/href="([^"]+)"/)[1];
            let name = item.match(/>([^<]+)</)[1];
            vodList.push({ 
                vod_id: url, 
                vod_name: name,
                vod_pic: rule.host + '/static/images/default.png'
            });
        });
    }
    return JSON.stringify({ list: vodList });
}

/**
 * 分类数据
 */
async function category(tid, pg, filter, extend) {
    let url = rule.host + `/vod/show/id/${tid}/page/${pg}.html`;
    let html = await getHtml(url);
    let vodList = [];
    let items = html.match(/<a href="(\\/vod\\/[^"]+)"[^>]*>([^<]+)<\\/a>/g) || [];
    items.forEach(item => {
        let url = item.match(/href="([^"]+)"/)[1];
        let name = item.match(/>([^<]+)</)[1];
        vodList.push({ 
            vod_id: url, 
            vod_name: name,
            vod_pic: rule.host + '/static/images/default.png'
        });
    });
    return JSON.stringify({ list: vodList, page: pg, pagecount: 10, limit: 20, total: vodList.length });
}

/**
 * 详情数据
 */
async function detail(vod_url) {
    let html = await getHtml(vod_url);
    let title = html.match(/<h1[^>]*>([^<]+)<\\/h1>/)[1] || '';
    let pic = html.match(/<img[^>]+src="([^"]+)"/)[1] || '';
    let playList = [];
    let playItems = html.match(/<a href="([^"]+)"[^>]*>([^<]+)<\\/a>/g) || [];
    playItems.forEach(item => {
        let url = item.match(/href="([^"]+)"/)[1];
        let name = item.match(/>([^<]+)</)[1];
        if (url && name && !url.includes('javascript:')) {
            playList.push({ title: name, url: url });
        }
    });
    let playUrl = {};
    playUrl['播放源'] = playList;
    return JSON.stringify({ 
        vod_id: vod_url,
        vod_name: title,
        vod_pic: pic,
        vod_actor: '',
        vod_director: '',
        vod_content: '',
        vod_play_from: Object.keys(playUrl).join('$$$'),
        vod_play_url: Object.values(playUrl).map(group => group.map(item => `${item.title}$$${item.url}`).join('#')).join('$$$')
    });
}

/**
 * 播放地址处理
 */
async function play(flag, id, flags) {
    return JSON.stringify({ parse: 0, url: id });
}

/**
 * 搜索功能
 */
async function search(wd, quick, pg) {
    let url = rule.host + `/search/------------${pg}---.html?wd=${encodeURIComponent(wd)}`;
    let html = await getHtml(url);
    let vodList = [];
    let items = html.match(/<a href="(\\/vod\\/[^"]+)"[^>]*>([^<]+)<\\/a>/g) || [];
    items.forEach(item => {
        let url = item.match(/href="([^"]+)"/)[1];
        let name = item.match(/>([^<]+)</)[1];
        if (name && name.includes(wd)) {
            vodList.push({ 
                vod_id: url, 
                vod_name: name,
                vod_pic: rule.host + '/static/images/default.png'
            });
        }
    });
    return JSON.stringify({ list: vodList });
}
