// 站点配置信息
const rule = {
    title: '金牌影院',
    host: 'https://www.sizhengxt.com',
    apiUrl: 'https://www.sizhengxt.com/api/vod',  // 主要的API接口地址
    detailApi: 'https://www.sizhengxt.com/api/vod/detail', // 详情API接口地址
    searchable: 2,        // 启用搜索
    quickSearch: 0,
    filterable: 1,        // 启用筛选
    class_name: '电影&电视剧&综艺&动漫&短剧&动作片&喜剧片&爱情片&科幻片&恐怖片&剧情片&战争片&国产剧&港剧&日剧&韩剧&海外剧&番剧',
    class_url: '1&2&3&4&20&6&7&8&9&10&11&12&13&14&15&16&17&18',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Referer': 'https://www.sizhengxt.com/'
    },
    timeout: 10000,
};

/**
 * 通用API请求函数
 * @param {string} url API地址
 * @param {Object} params 请求参数
 * @returns {Promise<Object>} 解析后的JSON数据
 */
async function fetchAPI(url, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        const response = await getHtml(fullUrl, { headers: rule.headers });
        if (!response) return null;
        // 处理可能的JSONP格式响应
        let jsonStr = response;
        if (response.trim().startsWith('jsonp')) {
            jsonStr = response.match(/jsonp\((.*)\)/)[1];
        }
        return JSON.parse(jsonStr);
    } catch (error) {
        log(`API请求失败: ${url}, 错误: ${error}`);
        return null;
    }
}

/**
 * 首页数据获取 - 调用API获取推荐视频
 * @returns {string} JSON格式的视频列表
 */
async function homeVod() {
    try {
        const apiData = await fetchAPI(rule.apiUrl, { page: 1, limit: 20 });
        if (!apiData || !apiData.list) return JSON.stringify({ list: [] });
        
        const vodList = apiData.list.map(item => ({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_remarks: item.vod_remarks || '',
            vod_year: item.vod_year || ''
        }));
        
        return JSON.stringify({ list: vodList });
    } catch (error) {
        log(`首页数据获取失败: ${error}`);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 获取分类列表
 * @param {string} tid 分类ID
 * @param {number} pg 页码
 * @param {boolean} filter 是否筛选
 * @param {Object} extend 扩展参数
 * @returns {string} JSON格式的分类视频列表
 */
async function category(tid, pg, filter, extend) {
    try {
        const apiData = await fetchAPI(rule.apiUrl, {
            class: tid,
            page: pg,
            limit: 20
        });
        
        if (!apiData || !apiData.list) return JSON.stringify({ list: [] });
        
        const vodList = apiData.list.map(item => ({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_remarks: item.vod_remarks || '',
            vod_year: item.vod_year || ''
        }));
        
        return JSON.stringify({
            list: vodList,
            page: pg,
            pagecount: apiData.total ? Math.ceil(apiData.total / 20) : 1,
            limit: 20,
            total: apiData.total || 0
        });
    } catch (error) {
        log(`分类数据获取失败: ${error}`);
        return JSON.stringify({ list: [] });
    }
}

/**
 * 获取视频详情和播放列表
 * @param {string} vod_id 视频ID或URL
 * @returns {string} JSON格式的视频详情和播放列表
 */
async function detail(vod_id) {
    try {
        // 提取视频ID
        let id = vod_id;
        if (vod_id.includes('/vod/')) {
            id = vod_id.split('/').pop().replace('.html', '');
        }
        
        const apiData = await fetchAPI(rule.detailApi, { vod_id: id });
        if (!apiData || !apiData.data) return JSON.stringify({});
        
        const item = apiData.data;
        const playUrl = {};
        
        // 解析播放列表
        if (item.vod_play_from && item.vod_play_url) {
            const playFroms = item.vod_play_from.split('$$$');
            const playUrls = item.vod_play_url.split('$$$');
            
            for (let i = 0; i < playFroms.length; i++) {
                const sourceName = playFroms[i];
                const sourceUrls = playUrls[i].split('#');
                
                const playList = sourceUrls.map(segment => {
                    const [name, url] = segment.split('$');
                    return { title: name, url: url };
                }).filter(segment => segment.url && !segment.url.includes('javascript:'));
                
                if (playList.length) {
                    playUrl[sourceName] = playList;
                }
            }
        }
        
        return JSON.stringify({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_actor: item.vod_actor || '',
            vod_director: item.vod_director || '',
            vod_content: item.vod_content || '',
            vod_year: item.vod_year || '',
            vod_area: item.vod_area || '',
            vod_play_from: Object.keys(playUrl).join('$$$'),
            vod_play_url: Object.values(playUrl).map(group => group.map(v => `${v.title}$${v.url}`).join('#')).join('$$$')
        });
    } catch (error) {
        log(`详情数据获取失败: ${error}`);
        return JSON.stringify({});
    }
}

/**
 * 播放地址处理
 * @param {string} flag 播放源标识
 * @param {string} id 播放地址
 * @param {Array} flags 所有播放源
 * @returns {string} JSON格式的播放地址
 */
async function play(flag, id, flags) {
    return JSON.stringify({ parse: 0, url: id });
}

/**
 * 搜索功能
 * @param {string} wd 搜索关键词
 * @param {boolean} quick 是否快速搜索
 * @param {number} pg 页码
 * @returns {string} JSON格式的搜索结果
 */
async function search(wd, quick, pg) {
    try {
        const apiData = await fetchAPI(rule.apiUrl, {
            wd: wd,
            page: pg,
            limit: 20
        });
        
        if (!apiData || !apiData.list) return JSON.stringify({ list: [] });
        
        const vodList = apiData.list.map(item => ({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_remarks: item.vod_remarks || ''
        }));
        
        return JSON.stringify({ list: vodList });
    } catch (error) {
        log(`搜索失败: ${error}`);
        return JSON.stringify({ list: [] });
    }
}
