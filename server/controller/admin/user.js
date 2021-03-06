import jwt from 'jsonwebtoken'
import user from '../../models/user'
import conf from '../../config'

module.exports = {
    // 当前用户信息
    async userinfo(ctx, next) {
        let cookie = ctx.request.header.cookie;
        let token = cookie.slice(11,cookie.length);
        let data = {};
        try {
            let tokenInfo = jwt.verify(token, conf.auth.admin_secret);
            await ctx.findOne(user, {_id: tokenInfo._id}).then((res) => {
                data = {
                    roles: res.roles,
                    deal: res.deal,
                    identityInsured: res.identityInsured,
                    commonInsured: res.commonInsured,
                    claims: res.claims,
                    account: res.account,
                    username: res.username
                }
            }).catch((e) => {
                console.log(e)
            });
            ctx.send(data)
        }catch (e) {
            if ('TokenExpiredError' === e.name) {
                ctx.sendError('鉴权失败, 请重新登录!');
                ctx.throw(401, 'token expired,请及时本地保存数据！');
            }
            ctx.throw(401, 'invalid token');
            ctx.sendError('系统异常!');
        }
    },
    // 全部用户信息
    async alluserinfo(ctx, next) {
        try {
            ctx.find(user);
            return ctx.send
        }catch (e){
            return ctx.sendError(e)
        }
    },
    // 注册 post
    async register(ctx, next) {
        console.log('用户注册post');
        console.log(ctx.request.body)
        let {account, pwd} = ctx.request.body
        try {
            let data = await ctx.findOne(user, {account: account});
            if (data) {
                return ctx.sendError('该用户名已存在!')
            }
            ctx.add(user, {account: account, pwd: pwd, roles:['admin']}, {$set: {registerTime: new Date()}});
            return ctx.send('注册成功')
        }
        catch (e) {
            console.log('注册失败');
            return ctx.sendError(e)
        }
    },
    async login(ctx, next) {
        console.log('----------------登录接口 user/login-----------------------');
        let {account, pwd} = ctx.request.body;
        console.log(ctx.request.body)
        try {
            let data = await ctx.findOne(user, {account: account});
            if (!data) {
                return ctx.sendError('用户名不存在！');
            }
            if (pwd !== data.pwd) {
                return ctx.sendError('密码错误,请重新输入！');
            }
            if(data.roles.includes('client')) {
                return ctx.sendError('对不起，您没有权限')
            }
            await ctx.update(user, {_id: data._id}, {$set: {loginTime: new Date()}}); //更新登陆时间

            let payload = {
                _id: data._id,
                username: data.username,
                name: data.name,
                roles: data.roles
            }
            let token = jwt.sign(payload, conf.auth.admin_secret, {expiresIn: '24h'});  //token签名 有效期为24小时
            ctx.cookies.set(conf.auth.tokenKey, token, {
                httpOnly: false,  // 是否只用于http请求中获取
            });
            console.log('登陆成功');
            ctx.send({message: '登录成功'});
        } catch (e) {
            if (e === '暂无数据') {
                console.log('用户名不存在');
                return ctx.sendError('用户名不存在');
            }
            ctx.throw(e);
            ctx.sendError(e)
        }
    },
};