// 好看看 TVBox 爬虫 - 基于 API 数据接口
// 兼容安卓4设备
// 数据来源：hhkan0.com

let host = 'https://www.hhkan0.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": host + "/"
};

// 获取分类映射（通过 API）
async function getCatList(cid) {
    let cat = "";
    switch (String(cid)) {
        case "1": cat = "电影"; break;
        case "2": cat = "电视剧"; break;
        case "3": cat = "综艺"; break;
        case "4": cat = "动漫"; break;
        default: cat = "电影";
    }
    return cat;
}

// 从API获取数据
async function getData(url) {
    let resp = await req(url, { headers: headers });
    if (resp && resp.content) {
        try {
            return JSON.parse(resp.content);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// 首页分类列表
async function home(filter) {
    return JSON.stringify({
        "class": [
            {"type_id": "1", "type_name": "电影"},
            {"type_id": "2", "type_name": "电视剧"},
            {"type_id": "3", "type_name": "综艺"},
            {"type_id": "4", "type_name": "动漫"}
        ],
        "filters": {}
    });
}

// 首页推荐数据
async function homeVod() {
    let url = `${host}/api.php/provide/vod/at/xml/`;
    let data = await getData(url);
    let list = [];
    if (data && data.data && data.data.length) {
        for (let i = 0; i < data.data.length && i < 40; i++) {
            let vod = data.data[i];
            list.push({
                "vod_id": vod.vod_id,
                "vod_name": vod.vod_name,
                "vod_pic": vod.vod_pic,
                "vod_remarks": vod.vod_remarks || ""
            });
        }
    }
    return JSON.stringify({ "list": list });
}

// 分类页数据
async function category(tid, pg, filter, extend) {
    let page = pg || 1;
    let t = tid || "1";
    let url = `${host}/api.php/provide/vod/at/xml/`;
    if (t === "1") url += `?ac=list&t=${t}&pg=${page}`;
    else if (t === "2") url += `?ac=list&t=${t}&pg=${page}`;
    else if (t === "3") url += `?ac=list&t=${t}&pg=${page}`;
    else if (t === "4") url += `?ac=list&t=${t}&pg=${page}`;
    else url += `?ac=list&t=1&pg=${page}`;
    let data = await getData(url);
    let list = [];
    if (data && data.data && data.data.length) {
        for (let i = 0; i < data.data.length; i++) {
            let vod = data.data[i];
            list.push({
                "vod_id": vod.vod_id,
                "vod_name": vod.vod_name,
                "vod_pic": vod.vod_pic,
                "vod_remarks": vod.vod_remarks || ""
            });
        }
    }
    return JSON.stringify({
        "list": list,
        "page": page
    });
}

// 详情页数据
async function detail(id) {
    let url = `${host}/api.php/provide/vod/at/xml/`;
    let data = await getData(url + `?ac=detail&ids=${id}`);
    if (data && data.data && data.data.length) {
        let vod = data.data[0];
        let playFrom = "默认线路";
        let playUrl = "";
        if (vod.vod_play_list && vod.vod_play_list.length) {
            playFrom = vod.vod_play_list[0].name;
            let playItems = [];
            for (let i = 0; i < vod.vod_play_list[0].urls.length; i++) {
                let item = vod.vod_play_list[0].urls[i];
                playItems.push(`${item.name}$${item.url}`);
            }
            playUrl = playItems.join("#");
        }
        let vod_content = vod.vod_content || "";
        if (vod_content) {
            vod_content = vod_content.replace(/<[^>]+>/g, '');
        }
        return JSON.stringify({
            list: [{
                'vod_id': vod.vod_id,
                'vod_name': vod.vod_name,
                'vod_pic': vod.vod_pic,
                'vod_content': vod_content,
                'vod_play_from': playFrom,
                'vod_play_url': playUrl
            }]
        });
    }
    return JSON.stringify({ list: [] });
}

// 搜索数据
async function search(wd, quick, pg) {
    let page = pg || 1;
    let url = `${host}/api.php/provide/vod/at/xml/`;
    let data = await getData(url + `?ac=list&wd=${encodeURIComponent(wd)}&pg=${page}`);
    let list = [];
    if (data && data.data && data.data.length) {
        for (let i = 0; i < data.data.length; i++) {
            let vod = data.data[i];
            list.push({
                "vod_id": vod.vod_id,
                "vod_name": vod.vod_name,
                "vod_pic": vod.vod_pic,
                "vod_remarks": vod.vod_remarks || ""
            });
        }
    }
    return JSON.stringify({ "list": list });
}

// 播放地址解析
async function play(flag, id, flags) {
    // 如果传入的 id 已经是完整URL，直接返回
    if (id && (id.startsWith("http://") || id.startsWith("https://"))) {
        return JSON.stringify({ parse: 0, url: id, header: headers });
    }
    // 否则请求详情页获取播放地址
    let url = `${host}/api.php/provide/vod/at/xml/?ac=detail&ids=${id}`;
    let data = await getData(url);
    if (data && data.data && data.data.length) {
        let vod = data.data[0];
        if (vod.vod_play_list && vod.vod_play_list.length && vod.vod_play_list[0].urls && vod.vod_play_list[0].urls.length) {
            let playUrl = vod.vod_play_list[0].urls[0].url;
            if (playUrl && (playUrl.startsWith("http://") || playUrl.startsWith("https://"))) {
                return JSON.stringify({ parse: 0, url: playUrl, header: headers });
            }
        }
    }
    // 如果没找到，返回页面由TVBox解析
    return JSON.stringify({ parse: 1, url: `${host}/detail/${id}.html`, header: headers });
}

// TVBox标准导出
export default { init: async()=>{}, home, homeVod, category, detail, search, play };
