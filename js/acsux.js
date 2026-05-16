// acsux.cn -> tvbox 插件适配脚本
// 保存为线路文件后，在 tvbox 配置中把 api 指向此文件地址即可

module.exports = {
  title: "acsux",
  url: "https://acsux.cn",
  homePage: "https://acsux.cn/",
  className: "影视站",

  async home() {
    const res = await fetch(this.homePage);
    const html = await res.text();
    const items = [];
    const re = /<a[^>]+href="(\/dt\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const href = new URL(m[1], this.url).href;
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      items.push({ title, url: href });
    }
    return { list: items };
  },

  async category(categoryPath = "/cp/1.html", page = 1) {
    let url = categoryPath.startsWith("http") ? categoryPath : new URL(categoryPath, this.url).href;
    if (page > 1) url += `?page=${page}`;
    const res = await fetch(url);
    const html = await res.text();
    const list = [];
    const re = /<a[^>]+href="(\/dt\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const href = new URL(m[1], this.url).href;
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      list.push({ title, url: href });
    }
    return { list, page: page + 1 };
  },

  async detail(detailUrl) {
    const url = detailUrl.startsWith("http") ? detailUrl : new URL(detailUrl, this.url).href;
    const res = await fetch(url);
    const html = await res.text();

    const titleMatch = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html) || /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const coverMatch = /<meta property=["']og:image["'] content=["']([^"']+)["']/.exec(html)
      || /<img[^>]+class=["']?cover[^"'>]*["']?[^>]+src=["']([^"']+)["']?/i.exec(html);
    const cover = coverMatch ? new URL(coverMatch[1], this.url).href : "";

    const descMatch = /<div[^>]+class=["']?(?:vod_play_info|vod_content)["']?[^>]*>([\s\S]*?)<\/div>/i.exec(html);
    const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // 提取集数/播放列表
    const playList = [];
    const epRe = /<a[^>]+href=["'](\/dt\/\d+\.html(?:#[^"']*)?)["'][^>]*>([^<]+)<\/a>/g;
    let em;
    while ((em = epRe.exec(html))) {
      const epUrl = new URL(em[1], this.url).href;
      const epName = em[2].trim();
      playList.push({ name: epName, url: epUrl });
    }

    // 备用：查找 iframe
    if (playList.length === 0) {
      const iframeMatch = /<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
      if (iframeMatch) playList.push({ name: "播放", url: new URL(iframeMatch[1], this.url).href });
    }

    const tabs = [];
    if (playList.length) tabs.push({ title: "播放", data: playList });

    return { title, cover, desc, tabs };
  },

  async play(playPageUrl) {
    const url = playPageUrl.startsWith("http") ? playPageUrl : new URL(playPageUrl, this.url).href;
    const res = await fetch(url);
    const html = await res.text();

    // 优先取 iframe
    let m = /<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
    if (m) return { url: new URL(m[1], this.url).href, type: "iframe" };

    // 查找 m3u8
    m = /(https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*)/i.exec(html);
    if (m) return { url: m[1], type: "hls" };

    // 查找 video src
    m = /<video[^>]+src=["']([^"']+)["']/i.exec(html);
    if (m) return { url: new URL(m[1], this.url).href, type: "video" };

    // 回退：返回页面本身
    return { url };
  },

  async search(keyword) {
    const searchUrl = `${this.url}/?s=${encodeURIComponent(keyword)}`;
    const res = await fetch(searchUrl);
    const html = await res.text();
    const results = [];
    const re = /<a[^>]+href="(\/dt\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const href = new URL(m[1], this.url).href;
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      results.push({ title, url: href });
    }
    return results;
  }
};
