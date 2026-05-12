var rule = {
    title: '永乐视频',
    host: 'https://www.ylys.tv',
    homeUrl: '/',
    // 分类列表（从首页顶部菜单解析）
    class_parse: '.nav-menu li:gt(0) a',
    // 推荐列表页
    home_parse: '.module-item',
    // 列表页公用解析规则
    list_parse: '.module-item',
    // 视频详情页解析
    detail_parse: '.module-info',
    // 搜索入口
    searchUrl: '/vodsearch/-------------/.html?wd=**',
    
    // 提取器
    ids: '/voddetail/(\\d+).html',
    titles: '.module-info-title h1@text',
    imgs: '.module-info-pic img@data-original',
    contents: '.module-info-content@text',
    play_parse: true,
    play_list: '.module-play-list a',
    play_url: 'href',
    play_title: 'span@text',
    
    // 全局请求头
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P) AppleWebKit/537.36'
    }
};

// 直接返回 rule 对象（TVBox 标准）
rule;
