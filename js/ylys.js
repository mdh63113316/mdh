var rule = {
    // 站点基本信息
    title: '永乐影视',
    host: 'https://www.ylys.tv',
    // 苹果CMS 标准 API 路径
    searchUrl: '/vodsearch/-------------.html?wd=**',
    classUrl: '/vodshow/**--------**---**.html',
    // 分类映射
    class_parse: '.nav-menu li:gt(0) a:regex(<a href="/(vodshow)?/?([\\d]+).*?">([^<]+)</a>)',
    
    // ---------- 首页推荐 ----------
    homeUrl: '/',
    home_parse: '.pack.pr span:has(img)',
    
    // ---------- 列表解析 ----------
    list_parse: '.fed-list-info',
    list_url: 'a.fed-list-title@href',
    list_title: 'a.fed-list-title@title',
    list_img: '.fed-list-pics@data-original',
    list_note: '.fed-list-remarks@text',
    
    // ---------- 详情页解析 ----------
    detail_parse: '.fed-part-rows',
    detail_url: 'link@href',
    detail_title: 'h1@text',
    detail_img: '.fed-deta-vod-img@data-original',
    detail_note: '.fed-text-center@text',
    detail_content: '.fed-deta-content:eq(0)@text',
    
    // ---------- 播放列表解析 ----------
    play_parse: true,
    play_list: '.fed-play-item',
    play_url: '.fed-btns-info@data-href',
    play_title: '.fed-btns-info@title',
    
    // ---------- 搜索功能 ----------
    search_parse: '.fed-list-info',
    search_url: 'a.fed-list-title@href',
    search_title: 'a.fed-list-title@title',
    search_img: '.fed-list-pics@data-original',
    search_note: '.fed-list-remarks@text',
    
    // ---------- 通用配置 ----------
    header: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        'Referer': 'https://www.ylys.tv/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    },
    timeout: 30,
    // 自动识别编码
    encoding: 'UTF-8'
};

// 导出规则
rule = JSON.stringify(rule);
