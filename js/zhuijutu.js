// zhuijutu_spider.js
// 追剧兔影视 (https://zhuijutu.com/) TVBox API 爬虫程序
// 参考了 https://mdh.dpdns.org/js/acsux.js 的解密思路

const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');

// 1. 基础配置
const BASE_URL = 'https://zhuijutu.com/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 2. 从网站源代码中提取的关键解密函数
// 这是附件中提供的 TQUVrw 函数（Base64解码及UTF-8处理）
function TQUVrw(e) {
    var m = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var t = "", n, r, i, s, o, u, a, f = 0;
    e = e.replace(/[^A-Za-z0-9+/=]/g, "");
    while (f < e.length) {
        s = m.indexOf(e.charAt(f++));
        o = m.indexOf(e.charAt(f++));
        u = m.indexOf(e.charAt(f++));
        a = m.indexOf(e.charAt(f++));
        n = s << 2 | o >> 4;
        r = (o & 15) << 4 | u >> 2;
        i = (u & 3) << 6 | a;
        t = t + String.fromCharCode(n);
        if (u != 64) {
            t = t + String.fromCharCode(r);
        }
        if (a != 64) {
            t = t + String.fromCharCode(i);
        }
    }
    // 嵌套的 oawTF 函数（UTF-8解码）
    function oawTF(e) {
        var t = "", n = r = c1 = c2 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++;
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2;
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3;
            }
        }
        return t;
    }
    return oawTF(t);
}

// 从网站源代码中提取的 yOJcE 函数（用于动态生成域名）
function yOJcE(t) {
    var e = t.match(new RegExp('^((https?|wss?)?://)?a.'));
    if (!e) return t;
    var n = new Date();
    return (e || "") + [n.getMonth() + 1, n.getDate(), n.getHours()].join("").split("").map(function (t) {
        return String.fromCharCode(t % 26 + (t % 2 != 0 ? 65 : 97));
    }).join("") + "." + t.split(".").slice(-2).join(".");
}

// 3. 主爬虫类
class ZhuijuTuSpider {
    constructor() {
        this.cookieJar = {};
        this.cache = new Map();
        this.cacheTTL = 300000; // 5分钟缓存
    }

    // 获取首页影视列表（分类/推荐）
    async fetchHomePage(category = '', page = 1) {
        const cacheKey = `home_${category}_${page}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        try {
            let url = BASE_URL;
            if (category) {
                // 根据网站结构构造分类URL，例如：/vod/show/id/1/page/2.html
                url = `${BASE_URL}vod/show/id/${category}/page/${page}.html`;
            } else if (page > 1) {
                url = `${BASE_URL}vod/show/page/${page}.html`;
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': BASE_URL
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const videoList = [];

            // 解析影视列表 - 根据网站实际HTML结构调整选择器
            // 示例选择器，需要根据实际页面调整
            $('.module-items .module-item, .video-list .video-item, .list-item').each((index, element) => {
                const $el = $(element);
                
                // 提取标题
                const title = $el.find('.video-name, .title, .name').text().trim();
                
                // 提取封面图片
                let pic = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
                if (pic && !pic.startsWith('http')) {
                    pic = new URL(pic, BASE_URL).href;
                }
                
                // 提取详情页链接
                const link = $el.find('a').attr('href');
                if (!link || !title) return;
                
                // 提取更新状态/备注
                const remarks = $el.find('.video-tag, .remarks, .tag').text().trim() || '';
                
                // 提取评分/年份等信息
                const score = $el.find('.score, .rating').text().trim() || '';
                
                // 从链接中提取ID
                const vodId = link.match(/\/id\/(\d+)\.html/)?. || 
                             link.match(/\/vod\/detail\/(\d+)\.html/)?. ||
                             link.split('/').pop().replace('.html', '');

                videoList.push({
                    vod_id: vodId || `item_${Date.now()}_${index}`,
                    vod_name: title,
                    vod_pic: pic,
                    vod_remarks: remarks,
                    vod_score: score,
                    vod_detail_url: link.startsWith('http') ? link : new URL(link, BASE_URL).href
                });
            });

            // 如果没有找到标准结构，尝试从JavaScript变量中提取
            if (videoList.length === 0) {
                const scriptContent = $('script').filter(function() {
                    return $(this).html().includes('var videoList') || 
                           $(this).html().includes('MacPlayer');
                }).html();
                
                if (scriptContent) {
                    // 使用正则表达式提取影视数据
                    const videoDataMatch = scriptContent.match(/var\s+videoList\s*=\s*($.*?$);/);
                    if (videoDataMatch) {
                        try {
                            const videoData = JSON.parse(videoDataMatch);
                            videoData.forEach(item => {
                                videoList.push({
                                    vod_id: item.id || item.vod_id,
                                    vod_name: item.title || item.name,
                                    vod_pic: item.pic || item.img,
                                    vod_remarks: item.remarks || item.state || '',
                                    vod_score: item.score || '',
                                    vod_detail_url: item.url || `${BASE_URL}vod/detail/id/${item.id}.html`
                                });
                            });
                        } catch (e) {
                            console.error('解析JavaScript视频数据失败:', e.message);
                        }
                    }
                }
            }

            const result = {
                list: videoList,
                page: parseInt(page),
                pagecount: Math.ceil(videoList.length / 20), // 假设每页20条
                limit: 20,
                total: videoList.length
            };

            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: result
            });

            return result;
        } catch (error) {
            console.error('获取首页失败:', error.message);
            return {
                list: [],
                page: parseInt(page),
                pagecount: 0,
                limit: 20,
                total: 0
            };
        }
    }

    // 搜索影视
    async searchVideo(keyword, page = 1) {
        try {
            const searchUrl = `${BASE_URL}vod/search/page/${page}/wd/${encodeURIComponent(keyword)}.html`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': BASE_URL
                }
            });

            const $ = cheerio.load(response.data);
            const searchList = [];

            $('.search-item, .video-item').each((index, element) => {
                const $el = $(element);
                const title = $el.find('.video-name, .title').text().trim();
                const link = $el.find('a').attr('href');
                const pic = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
                const remarks = $el.find('.video-tag, .remarks').text().trim() || '';

                if (title && link) {
                    const vodId = link.match(/\/id\/(\d+)\.html/)?. || 
                                 link.split('/').pop().replace('.html', '');
                    
                    searchList.push({
                        vod_id: vodId || `search_${Date.now()}_${index}`,
                        vod_name: title,
                        vod_pic: pic ? new URL(pic, BASE_URL).href : '',
                        vod_remarks: remarks,
                        vod_detail_url: link.startsWith('http') ? link : new URL(link, BASE_URL).href
                    });
                }
            });

            return {
                list: searchList,
                page: parseInt(page),
                pagecount: Math.ceil(searchList.length / 20),
                limit: 20,
                total: searchList.length
            };
        } catch (error) {
            console.error('搜索失败:', error.message);
            return {
                list: [],
                page: parseInt(page),
                pagecount: 0,
                limit: 20,
                total: 0
            };
        }
    }

    // 获取影视详情和播放地址
    async fetchVideoDetail(vodId) {
        const cacheKey = `detail_${vodId}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        try {
            // 构造详情页URL
            const detailUrl = `${BASE_URL}vod/detail/id/${vodId}.html`;
            
            const response = await axios.get(detailUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': BASE_URL
                }
            });

            const $ = cheerio.load(response.data);
            
            // 提取基本信息
            const vodName = $('.video-info .video-title, .vod-title').text().trim();
            const vodPic = $('.video-cover img, .vod-img img').attr('src');
            const vodContent = $('.video-content, .vod-content').text().trim();
            const vodYear = $('.video-info .video-year, .vod-year').text().trim();
            const vodArea = $('.video-info .video-area, .vod-area').text().trim();
            const vodDirector = $('.video-info .video-director, .vod-director').text().trim();
            const vodActor = $('.video-info .video-actor, .vod-actor').text().trim();

            // 提取播放地址 - 关键部分
            let playUrls = [];
            const scriptText = $('script').filter(function() {
                return $(this).html().includes('player_') || 
                       $(this).html().includes('MacPlayer') ||
                       $(this).html().includes('encrypted');
            }).html();

            if (scriptText) {
                // 方法1：尝试提取加密的播放地址
                const encryptedMatch = scriptText.match(/var\s+encrypted\s*=\s*['"]([^'"]+)['"]/);
                if (encryptedMatch && encryptedMatch) {
                    try {
                        const decoded = TQUVrw(encryptedMatch);
                        const playUrl = yOJcE(decoded);
                        if (playUrl && playUrl.includes('.m3u8') || playUrl.includes('.mp4')) {
                            playUrls.push({
                                name: '线路1',
                                url: playUrl
                            });
                        }
                    } catch (e) {
                        console.error('解密播放地址失败:', e.message);
                    }
                }

                // 方法2：尝试提取JSON格式的播放列表
                const jsonMatch = scriptText.match(/var\s+playerData\s*=\s*(\{.*?\});/);
                if (jsonMatch) {
                    try {
                        const playerData = JSON.parse(jsonMatch);
                        if (playerData.url) {
                            playUrls.push({
                                name: playerData.title || '播放线路',
                                url: playerData.url
                            });
                        }
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                }

                // 方法3：尝试从MacPlayer配置中提取
                const macPlayerMatch = scriptText.match(/MacPlayer\.config\s*=\s*(\{.*?\});/s);
                if (macPlayerMatch) {
                    try {
                        const macConfig = JSON.parse(macPlayerMatch);
                        if (macConfig.url) {
                            playUrls.push({
                                name: '主线路',
                                url: macConfig.url
                            });
                        }
                    } catch (e) {
                        console.error('解析MacPlayer配置失败:', e.message);
                    }
                }
            }

            // 如果以上方法都失败，尝试从iframe中提取
            if (playUrls.length === 0) {
                const iframeSrc = $('iframe').attr('src');
                if (iframeSrc && iframeSrc.includes('player')) {
                    playUrls.push({
                        name: 'iframe播放',
                        url: iframeSrc
                    });
                }
            }

            // 构造TVBox所需的播放链接格式
            let vodPlayUrl = '';
            if (playUrls.length > 0) {
                vodPlayUrl = playUrls.map((item, index) => 
                    `第${index + 1}集$${item.url}`
                ).join('#');
            }

            const result = {
                vod_id: vodId,
                vod_name: vodName,
                vod_pic: vodPic ? new URL(vodPic, BASE_URL).href : '',
                vod_content: vodContent,
                vod_year: vodYear,
                vod_area: vodArea,
                vod_director: vodDirector,
                vod_actor: vodActor,
                vod_play_from: '追剧兔',
                vod_play_url: vodPlayUrl || '暂无播放地址',
                type_name: '电影/电视剧' // 可根据实际分类调整
            };

            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: result
            });

            return result;
        } catch (error) {
            console.error(`获取详情 ${vodId} 失败:`, error.message);
            return null;
        }
    }

    // 生成TVBox API响应
    async generateTVBoxResponse(params) {
        const { t, pg, wd, ids, ac } = params;
        
        // 分类列表
        if (t === 'class') {
            return {
                class: [
                    { type_id: 1, type_name: '电影' },
                    { type_id: 2, type_name: '电视剧' },
                    { type_id: 3, type_name: '动漫' },
                    { type_id: 4, type_name: '综艺' }
                ]
            };
        }
        
        // 影视列表
        else if (t === 'videolist') {
            const page = pg || 1;
            const typeId = ac || '';
            return await this.fetchHomePage(typeId, page);
        }
        
        // 影视详情
        else if (t === 'videodetail' && ids) {
            const detail = await this.fetchVideoDetail(ids);
            return detail ? { list: [detail] } : { list: [] };
        }
        
        // 搜索
        else if (wd) {
            const page = pg || 1;
            return await this.searchVideo(wd, page);
        }
        
        // 默认返回首页
        else {
            const page = pg || 1;
            return await this.fetchHomePage('', page);
        }
    }
}

// 4. Express服务器封装（用于TVBox API）
const express = require('express');
const app = express();
const spider = new ZhuijuTuSpider();

app.get('/zhuijutu/api.php', async (req, res) => {
    try {
        const result = await spider.generateTVBoxResponse(req.query);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(result);
    } catch (error) {
        res.status(500).json({
            code: 500,
            msg: '服务器内部错误: ' + error.message
        });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`追剧兔TVBox API服务器运行在 http://localhost:${PORT}/zhuijutu/api.php`);
    console.log('支持以下参数：');
    console.log('  t=class - 获取分类');
    console.log('  t=videolist&ac=分类ID&pg=页码 - 获取影视列表');
    console.log('  t=videodetail&ids=视频ID - 获取影视详情');
    console.log('  wd=关键词&pg=页码 - 搜索影视');
});

// 导出模块
module.exports = {
    ZhuijuTuSpider,
    TQUVrw,
    yOJcE
};
