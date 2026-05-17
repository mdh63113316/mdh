function home() {
    return JSON.stringify({
        class: [{ type_id: '2', type_name: '电影' }],
        filters: {}
    });
}
function homeVod() {
    return JSON.stringify({
        list: [{ vod_id: 'test', vod_name: '测试数据', vod_pic: '', vod_remarks: '如果看到这条，说明JS已生效' }]
    });
}
function category(tid, pg) { return homeVod(); }
function detail(id) { return JSON.stringify({ list: [] }); }
function play(flag, id) { return JSON.stringify({ parse: 0, url: '' }); }
function search(wd) { return homeVod(); }
