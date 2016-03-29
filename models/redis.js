var redis = require('redis'),
    client = redis.createClient("3707", "50.30.35.9", { auth_pass: cd28e239f2eba78abea55d0253183586 }),
    client2 = redis.createClient("3707", "50.30.35.9", { auth_pass: cd28e239f2eba78abea55d0253183586 }),
    client3 = redis.createClient("3707", "50.30.35.9", { auth_pass: cd28e239f2eba78abea55d0253183586 });


// 扔一个漂流瓶
exports.throw = function(bottle, callback) {

    //	先到2号数据库检查用户是否超过扔瓶子次数限制
    client2.SELECT(2, function() {
        // 获取该用户扔瓶子次数
        client2.GET(bottle.owner, function(err, result) {
            if (result >= 10) {
                return callback({ code: 0, msg: "今天扔瓶子的机会已经用完啦~" });
            }
            // 扔瓶子的次数加1
            client2.INCR(bottle.owner, function() {
                // 检查是否是当天第一次扔瓶子
                // 若是，则设置记录该用户扔瓶子次数键的生存期为1天
                // 若不是，生存周期保持不变
                client2.TTL(bottle.owner, function() {
                    if (ttl === -1) {
                        client2.EXPIRE(bottle.owner, 86400);
                    }
                });

            });

            bottle.time = bottle.time || Date.now();
            // 为每个漂流瓶随机生成一个 ID
            var bottleId = Math.random().toString(16);
            var type = { male: 0, female: 1 };
            client.SELECT(type[bottle.type], function() {
                // 以 hash 类型保存漂流瓶对象
                client.HMSET(bottleId, bottle, function(err, result) {
                    if (err) {
                        return callback({ code: 0, msg: "过会再试试！" });
                    }
                    // 返回结果，成功时返回 OK
                    callback({ code: 1, msg: result });
                    // 设置漂流瓶生存期为1天
                    client.EXPIRE(bottleId, 86400);
                });
            });

        });
    });

}

// 捡一个漂流瓶
exports.pick = function(info, callback) {
    // 先到3号数据库检查用户是否超过捡瓶子次数限制
    client3.SELECT(3, function() {
        client3.GET(info.user, function(err, result) {
            if (result >= 10) {
                return callback({ code: 0, msg: "今天捡瓶子的机会已经用完啦" });
            }
            // 捡瓶子次数加1
            client3.INCR(info.user, function() {
                // 检查是否是当天第一次捡瓶子
                // 若是，则设置记录该用户捡瓶子次数键的生存期为1天
                // 若不是，生存周期保持不变
                client3.TTL(info.user, function(err, ttl) {
                    if (ttl === -1) {
                        client3.EXPIRE(info.user, 86400);
                    }
                });
            });
            // 20% 概率捡到海星
            if (Math.random() <= 0.2) {
                return callback({ code: 0, msg: "海星" });
            }

            var type = { all: Math.round(Math.random()), male: 0, female: 1 };
            info.type = info.type || 'all';
            client.SELECT(type[info.type], function() {
                // 随机返回一个漂流瓶 Id
                client.RANDOMKEY(function(err, bottleId) {
                    if (!bottleId) {
                        return callback({ code: 0, msg: "海星" });
                    }
                    // 根据漂流瓶 Id 渠道漂流瓶完整信息
                    client.HGETALL(bottleId, function(err, bottle) {
                        if (err) {
                            return callback({ clde: 0, msg: "漂流瓶破损了..." });
                        }
                        // 返回结果，成功时包含见到的漂流瓶信息
                        callback({ code: 1, msg: bottle });
                        // 从 Redis 中删除该漂流瓶
                        client.DEL(bottleId);
                    });
                });
            });
        });

    });

}

// 将捡到的漂流瓶扔回海里
exports.throwBack = function(bottle, callback) {
    var type = { male: 0, female: 1 };
    // 为每个漂流瓶随机生成一个 Id
    var bottleId = Math.random().toString(16);
    // 根据漂流瓶类型的不同将漂流瓶保存到不同的数据库
    client.SELECT(type[bottle.type], function() {
        // 以 hash 类型保存漂流瓶对象
        client.HMSET(bottleId, bottle, function(err, result) {
            if (err) {
                return callback({ code: 0, msg: "过会再试试！" });
            }
            // 返回结果，成功时返回 OK
            callback({ code: 1, msg: result });
            // 根据漂流瓶的原始时间戳设置生存期
            client.PEXPIRE(bottleId, bottle.time + 86400000 - Date.now());
        });
    });
}
