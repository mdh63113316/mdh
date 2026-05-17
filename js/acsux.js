function home() {
    return '{"class":[{"type_id":"1","type_name":"电影"}],"filters":{}}';
}
function homeVod() {
    return '{"list":[{"vod_id":"test","vod_name":"如果看到我，说明JS生效了","vod_pic":"","vod_remarks":"请检查分类页"}]}';
}
function category(tid,pg) { return homeVod(); }
function detail(id) { return '{"list":[]}'; }
function play(flag,id) { return '{"parse":0,"url":""}'; }
function search(wd) { return homeVod(); }
