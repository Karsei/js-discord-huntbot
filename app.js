/**
 * FFXIV HUNT PARSER BOT for Discord BOT
 * 
 * Author By. Karsei
 */
/************************************************
 * MODULE LOAD
*************************************************/
// env
const env = require('dotenv');
env.config({path: '.env'});

// fs
const fs = require('fs');

// Websocket
const WebSocket = require('ws');

// Request
const request = require('request');

// Discord
const Discord = require('discord.js');
const client = new Discord.Client();

// Async
const async = require('async');


/************************************************
 * CLASSES
*************************************************/
/**
 * 로그 클래스
 */
class Logger {
    /**
     * Date 포멧화 가능하게 만듦
     */
    constructor() {
    }

    /**
     * 콘솔에 로그 남김
     * 
     * @param {string} pMsg             메세지
     */
    static T(pMsg) {
        console.log('\x1b[33m[' + new Date().format('yyyy/MM/dd HH:mm:ss') + '] \x1b[0m' + pMsg);
    }
}

/**
 * 메세지 풀 클래스
 */
class MessagePool {
    constructor() {
        // 대기 메시지
        this.arrMobMsg = [];
        // 보고 ID
        this.arrNotified = [];
    }

    getMobMsg() {
        return this.arrMobMsg;
    }

    getNotify() {
        return this.arrNotified;
    }

    spliceMobMsg(pIdx, pAmount) {
        this.arrMobMsg.splice(pIdx, pAmount);
    }

    spliceNotify(pIdx, pAmount) {
        this.arrNotified.splice(pIdx, pAmount);
    }

    pushMobMsg(pMob) {
        return this.arrMobMsg.push(pMob);
    }

    pushNotify(pNotify) {
        return this.arrNotified.push(pNotify);
    }

    /**
     * 풀 초기화
     */
    purgePool() {
        this.arrMobMsg = [];
        this.arrNotified = [];
    }
}

class DiscordMsgSeries {
    constructor(pObjClientCh) {
        this.oDiscordClient = pObjClientCh;
    }

    getObject() {
        return this.oDiscordClient;
    }

    /**
     * 일반 메시지 전송
     * 
     * @param {string} pMsg             메시지
     * @param {boolean} pIsDebug        디버그 여부
     */
    sendMsg(pMsg, pIsDebug) {
        pIsDebug = pIsDebug || false;
        return this.oDiscordClient.send((!pIsDebug ? '' : '[DEBUG] ') + `${pMsg}`);
    }

    /**
     * RichEmbed 메시지 전송
     * 
     * @param {string} pMainText        메시지
     * @param {object} pObjEmbed        RichEmbed 객체
     * @param {boolean} pIsDebug        디버그 여부
     */
    sendEmbedMsg(pMainText, pObjEmbed, pIsDebug) {
        pMainText = pMainText || '';
        pIsDebug = pIsDebug || false;
        if (pMainText.length > 0) {
            return this.oDiscordClient.send(pMainText, { embed: pObjEmbed });
        } else {
            return this.oDiscordClient.send({ embed: pObjEmbed });
        }
    }
}

/**
 * 마물 데이터 목록 클래스
 */
class MobInfo {
    constructor(pHuntListData) {
        this.arrHuntListData = pHuntListData;
    }

    /**
     * 마물 데이터 정보 조회
     * 
     * @param {integer} pHuntId     몬스터 번호
     */
    getInfo(pHuntId) {
        return this.arrHuntListData[pHuntId];
    }

    /**
     * 마물 이름 조회
     * 
     * @param {integer} pHuntId     몬스터 번호
     */
    getName(pHuntId) {
        return this.arrHuntListData[pHuntId].name;
    }
    /**
     * 마물 등급 조회
     * 
     * @param {integer} pHuntId     몬스터 번호
     */
    getRank(pHuntId) {
        return this.arrHuntListData[pHuntId].rank;
    }
    /**
     * 마물 장소 조회
     * 
     * @param {integer} pHuntId     몬스터 번호
     */
    getZone(pHuntId) {
        return this.arrHuntListData[pHuntId].zone;
    }
}

class MobHuntDiscord {
    constructor() {
        // 디버그
        this.bDebug = false;

        // 메세지 풀
        this.oMsgPool = null;
        // 디스코드 메시지 종류
        this.oMsgSeries = null;
        // 마물 데이터
        this.oMobList = null;
        // 디스코드 봇 로그인 여부
        this.bBotLogin = false;
        // 웹소켓 접속 여부
        this.bWebSocConn = false;

        // 토큰 데이터
        this.oHuntToken = null;

        /**
         * 핸들러
         */
        // 웹 소켓
        this.hSocket = null;
        // 핑퐁 타이머
        this.hPingPong = null;
    }

    /**
     * 초기화
     */
    init() {
        // 마물 데이터 로드 (B, A, S급 마물)
        this._loadMobList();

        // 디스코드 봇 접속
        this._loadDiscordLogin();
    }

    /**
     * 개발 모드 토글
     */
    _toggleDevMode() {
        return this.bDebug = !this.bDebug;
    }

    /**
     * 마물 데이터 로드
     */
    _loadMobList() {
        Logger.T('마물 데이터를 로드하고 있습니다...');

        // 마물 데이터 로드 (B, A, S급 마물)
        this.oMobList = new MobInfo(JSON.parse(fs.readFileSync('./huntlist.json')));
    }

    /**
     * 디스코드 봇 접속 시도
     * ※참고. https://www.devdungeon.com/content/javascript-discord-bot-tutorial
     */
    _loadDiscordLogin() {
        Logger.T(`디스코드 봇에 접속하고 있습니다... (토큰: \x1b[36m${DISCORD_BOT_CLIENT_TOKEN} \x1b[0m)`);

        // 봇 접속 시도
        client.login(DISCORD_BOT_CLIENT_TOKEN)
            .then(this._discordLogon())
            .catch((pErr) => {
                Logger.T('디스코드 봇 접속에서 오류가 발생했습니다.');
                console.error(pErr)
                process.exit();
            });
    }

    /**
     * 디스코드 봇 접속 시
     */
    _discordLogon() {
        Logger.T('디스코드 봇 접속에 성공하였습니다.');

        // 디스코드 봇 로그인
        client.on('ready', this._discordOnReady);
        // 디스코드 봇 메세지 감지
        client.on('message', this._discordOnMessage);
        // 디스코드 봇 채널 접속 확인
        setTimeout(() => {
            if (!this.bBotLogin) {
                Logger.T('디스코드 봇에 접속 성공하였으나 로그인 감지를 하지 못하여 봇 해제 후 다시 접속을 시도합니다...');
                client.destroy().then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
            }
        }, 5000);
    }

    /**
     * 디스코드 봇 채널 로그인 시
     */
    _discordOnReady() {
        Logger.T(`'${client.user.tag}'으로 로그인되었습니다!`);

        let _this = oMobHuntDiscord;

        // 메세지 풀 초기화
        _this.oMsgPool = new MessagePool();

        // 디스코드 봇 로그인 상태 설정
        _this.bBotLogin = true;
        
        // 디스코드 봇 메시지 종류 설정
        _this.oMsgSeries = new DiscordMsgSeries(client.channels.get(DISCORD_BOT_MSG_CHANNEL_ID));
        if (_this.bDebug) {
            _this.oMsgSeries.sendMsg('디버그 모드가 켜져 있습니다. 개발을 하지 않는 경우에는 이 모드를 끄고 진행하세요!', true);
            Logger.T('현재 연결된 모든 서버 정보: ');
            client.guilds.forEach((pGuild) => {
                Logger.T(` - [${pGuild.name}]`);
                // 채널
                pGuild.channels.forEach((pChannel) => {
                    Logger.T(` -- ${pChannel.name} (${pChannel.type}) - ${pChannel.id}`);
                });
            });
        }

        // 기본 정보 문구 출력
        _this.oMsgSeries.sendEmbedMsg('', {
            color: parseInt('a1eb34', 16),
            title: `${APP_TITLE} v${APP_VERSION}(Beta)`,
            description: 'Primals 데이터센터의 모든 서버 마물 정보를 알려주는 디스코드봇\n문제 발견 시 제보 환영!',
            url: 'https://gitlab.com/Karsei/js-discord-ffxivhuntbot',
            fields: [
                { name: '만든이', value: 'Retou Sai (Hyperion)'}
            ],
            timestamp: new Date(),
            footer: {
                text: DISCORD_TITLE_ABB
            }
        });

        // 웹 소켓 연결
        async.waterfall([
            _this._WS_getToken
            , _this._WS_Connect
        ], (pWSErr) => {
            console.error(pWSErr);
        });

        // 5분 간격으로 핑 보냄
        // setInterval(() => {
        //     if (sysStatus.websocket_logon) {
        //         let pingOption = {
        //             uri: 'https://horus-hunts.net/signalr/ping',
        //             qs: {
        //                 '__Loc': '/Tracker/Primal',
        //                 '__HW': '',
        //                 '__DC': 'Primal',
        //                 '__SS': new Date().format('yyyy-MM-dd HH:mm:ss'),
        //                 '_': new Date().getTime()
        //             }
        //         }
        //         request.get(pingOption, function (pPingError, pPingRes, pPingBody) {
        //             if (pPingError != null) {
        //                 logger.T('Ping Pong Error');
        //                 console.error(pPingError);
        //             }

        //             pPingBody = JSON.parse(pPingBody);
        //             logger.T(pPingBody.Response);
        //         });
        //     } else {
        //         logger.T('웹 소켓 연결 안됨');
        //     }
        // }, 300000);
    }

    _discordOnMessage(pObjMsg) {
        let _this = oMobHuntDiscord;

        // if (_DEBUG_) { logger.T(`메세지 감지 => ${oMsg.content}`); }
        switch (pObjMsg.content.toUpperCase()) {
            // 디스코드 봇 초기화
            case ';!RESET':
                pObjMsg.channel.send('초기화합니다...')
                    .then(msg => client.destroy())
                    .then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
                break;
            // 프로세스 종료
            case ';!EXIT':
                pObjMsg.channel.send('봇을 오프라인으로 전환하고 서버를 종료합니다...')
                    .then(msg => client.destroy())
                    .then(() => process.exit());
                break;
            // PING
            case ';!PING':
                pObjMsg.channel.send('PONG', {
                    embed: {
                        color: parseInt('db3434', 16),
                        title: 'PING PONG!',
                        description: 'ping pong',
                        fields: [
                            { name: 'PING', value: 'PING PING'},
                            { name: 'PONG', value: 'PONG\nPONG'}
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: 'Server Response Test'
                        }
                    }
                });
                break;
            // 메시지 POOL 삭제
            case ';!PURGEPOOL':
                pObjMsg.channel.send('메세지 POOL을 삭제합니다...')
                    .then(msg => {
                        // POOL 삭제
                        _this.oMsgPool.purgePool();

                        msg.channel.send('메세지 POOL을 성공적으로 삭제하였습니다.');
                    });
                break;
            // 개발 모드 토글
            case ';!TOGGLEDEV':
                pObjMsg.channel.send('개발 모드를 토글합니다...')
                    .then(msg => {
                        let devmode = _this._toggleDevMode();
                        if (devmode)    msg.channel.send('개발 모드가 활성화되었습니다.');
                        else            msg.channel.send('개발 모드가 비활성화되었습니다.');
                    });
                break;
            // 서버 상태 확인
            case ';!STATUS':
                let _msgIdStr = _this.oMsgPool.arrMobMsg.map((pMob) => { return pMob.msgId; }).join(',');
                pObjMsg.channel.send('현재 서버 상태입니다.', {
                    embed: {
                        color: parseInt('f5df38', 16),
                        title: 'Server Status',
                        description: `[Connection Token]\n${_this.oHuntToken.ConnectionToken}`,
                        fields: [
                            { name: 'Message Pools', value: `${_this.oMsgPool.arrMobMsg.length}개` },
                            { name: 'Killed Id Pools', value: `${_this.oMsgPool.arrNotified.length}개` },
                            { name: 'Message Id Waiting List', value: _msgIdStr.length > 0 ? _msgIdStr : '(대기열 없음)' }
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: DISCORD_TITLE_ABB
                        }
                    }
                });
                Logger.T(`Message Pools: ${_this.oMsgPool.arrMobMsg.length}개`);
                Logger.T(`Killed Id Pools: ${_this.oMsgPool.arrNotified.length}개`);
                Logger.T(`Message Id Waiting List: ${_msgIdStr}`);
                break;
            // 채널 목록 조회
            case ';!CHANNELLIST':
                let _clStr = '';
                client.guilds.forEach((pGuild) => {
                    // 서버
                    _clStr += ` - [${pGuild.name}]\n`;
                    // 채널
                    pGuild.channels.forEach((pChannel) => { _clStr += ` -- ${pChannel.name} (${pChannel.type}) - ${pChannel.id}\n`; });
                });
                pObjMsg.channel.send(_clStr);
                break;
        }
    }

    _WS_getToken(pObjCallback) {
        Logger.T(`글로벌 마물 웹 소켓 인증 토큰 발급을 시도합니다...`);

        let _this = oMobHuntDiscord;
        // 웹 소켓 토큰 발급 시도
        let negoOption = {
            uri: 'https://horus-hunts.net/signalr/negotiate',
            qs: {
                'clientProtocol': '2.0',
                '__Loc': '/Tracker/Primal',
                '__HW': 'Hyperion',
                '__DC': 'Primal',
                '__SS': new Date().format('yyyy-MM-dd HH:mm:ss'),
                'connectionData': '[{"name":"huntshub"}]',
                '_': new Date().getTime()
            }
        }
        if (_this.bDebug) {
            _this.oMsgSeries.sendMsg('마물 사이트로부터 인증 토큰 발급 시도중...', true);
            console.log(negoOption);
        }
        request.get(negoOption, function (pNegoError, pNeoRes, pNegoBody) {
            if (pNegoError != null) {
                if (_this.bDebug) { _this.oMsgSeries.sendMsg('인증 토큰 발급 실패'); }
                Logger.T('인증 토큰 발급 과정에서 오류가 발생했습니다.');
                console.error(pNegoError);
                process.exit();
            }

            Logger.T(`인증 토큰 발급 성공! (코드: ${pNeoRes.statusCode})`);
            _this.oHuntToken = JSON.parse(pNegoBody);
            if (_this.bDebug)    console.log(_this.oHuntToken);
            pObjCallback(null);
        });
    }

    _WS_Connect(pObjCallback) {
        Logger.T(`2초 후 글로벌 마물 웹 소켓 연결 시도를 시작합니다.`);

        let _this = oMobHuntDiscord;
        // 마물 웹 소켓 연결 시도
        if (_this.bDebug) { _this.oMsgSeries.sendMsg('마물 사이트와 소켓 연결 시도중...', true); }
        setTimeout(() => {
            let hunt_Str = 'wss://horus-hunts.net/signalr/connect?transport=webSockets&clientProtocol=2.0&__Loc=/Tracker/Primal&__HW=Hyperion&__DC=Primal&__SS=' + new Date().format('yyyy-MM-dd HH:mm:ss') + '&connectionToken=' + encodeURIComponent(_this.oHuntToken.ConnectionToken) + '&connectionData=[{"name":"huntshub"}]&tid=5';
            Logger.T(`글로벌 마물 웹 소켓 연결 시도를 진행합니다... (주소: \x1b[36m${hunt_Str}\x1b[0m)`);

            _this.hSocket = new WebSocket(hunt_Str, {
                origin: 'https://horus-hunts.net',
                protocolVersion: 13
            });
            _this.hSocket.on('open', _this._WS_ConnectOnOpen);
            _this.hSocket.on('close', _this._WS_ConnectOnClose);
            _this.hSocket.on('error', _this._WS_ConnectOnError);
            _this.hSocket.on('message', _this._WS_ConnectOnMsg);
            // _this.hSocket.on('upgrade', (pSRes) => {
            //     console.log(pSRes)
            // });

            pObjCallback(null);
        }, 2000);
    }

    _WS_ConnectOnOpen() {
        Logger.T('글로벌 마물 웹 소켓 연결 성공!');

        let _this = oMobHuntDiscord;

        // 소켓 연결 설정
        _this.bWebSocConn = true;

        let insertAddServer = () => {
            for (let dcIdx in FFXIV_ALL_SERVERS) {
                let sidx = 0;
                for (let sIdx in FFXIV_ALL_SERVERS[dcIdx]) {
                    ((_name, _x) => {
                        setTimeout(() => {
                            let sendStr = `{"H":"huntshub","M":"addToWorld","A":["${_name}"],"I":${_x}}`;
                            Logger.T(`보냄: ${sendStr}`);
                            _this.hSocket.send(sendStr);
                        }, 100 * _x);
                    })(FFXIV_ALL_SERVERS[dcIdx][sIdx].name, sidx);
                    ++sidx;
                }
            }
        };

        Logger.T(`글로벌 마물 웹 소켓 시작 처리를 진행합니다...`);
        setTimeout(() => {
            // TODO :: 이게 제대로 되어야 나중에 서버 추가할 때 오류났다는 메세지가 안뜸. 헤더쪽에 문제있는듯?
            let startOption = {
                uri: 'https://horus-hunts.net/signalr/start',
                qs: {
                    'transport': 'webSockets',
                    'clientProtocol': '2.0',
                    '__Loc': '/Tracker/Primal',
                    '__HW': 'Hyperion',
                    '__DC': 'Primal',
                    '__SS': encodeURIComponent(new Date().format('yyyy-MM-dd HH:mm:ss')),
                    'connectionToken': encodeURIComponent(_this.oHuntToken.ConnectionToken),
                    'connectionData': encodeURIComponent('[{"name":"huntshub"}]'),
                    '_': new Date().getTime()
                }
            }
            if (_this.bDebug) { 
                _this.oMsgSeries.sendMsg('마물 사이트와 소켓 연결 시작 시도...', true);
                console.log(startOption);
            }
            request.get(startOption, function (pStartError, pStartRes, pStartBody) {
                if (pStartError != null) {
                    if (_this.bDebug) { _this.oMsgSeries.sendMsg('소켓 연결 시작 실패'); }
                    Logger.T('글로벌 마물 웹 소켓 시작 처리 과정에서 오류가 발생했습니다.');
                    process.exit();
                }

                // if (pStartRes.statusCode == 200) {
                    Logger.T(`글로벌 마물 웹 소켓 처리 시작 성공! (코드: ${pStartRes.statusCode})`);
                    if (_this.bDebug) {
                        _this.oMsgSeries.sendMsg('Primal 데이터 센터의 모든 서버군 등록 시도...', true);
                        console.log(pStartBody);
                    }

                    Logger.T('메세지를 받을 서버를 추가합니다...');
                    insertAddServer();

                    if (_this.bDebug) { _this.oMsgSeries.sendMsg('완료', true); }
                // } else {
                //     Logger.T(`글로벌 마물 웹 소켓 처리 시작 결과에서 오류가 발생했습니다.`);
                //     //console.error(pStartBody);
                //     process.exit();
                // }
            });
        }, 1000);
    }
    _WS_ConnectOnClose() {
        Logger.T('글로벌 마물 웹 소켓 연결이 서버로부터 닫혔습니다.');

        let _this = oMobHuntDiscord;
        _this.bWebSocConn = false;

        _this.oMsgSeries.sendMsg('서버가 닫혀서 서비스 제공이 불가능합니다. 재시작합니다...')
            .then(msg => client.destroy())
            .then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
    }
    _WS_ConnectOnError(pError) {
        Logger.T('글로벌 마물 웹 소켓 연결에서 오류가 발생했습니다.');

        let _this = oMobHuntDiscord;
        _this.oMsgSeries.sendMsg('서버 내부에서 소켓 오류가 발생했습니다. 개발자에게 문의하세요.');
        console.error(pError);
    }
    _WS_ConnectOnMsg(pData) {
        Logger.T(`받음: ${pData}`);

        let _this = oMobHuntDiscord;
        if (_this.bWebSocConn) {
            let msgScan = JSON.parse(pData);
            if (msgScan.hasOwnProperty('M') && msgScan.M.length > 0 && msgScan.M[0].hasOwnProperty('M')) {
                let curMsgPools = _this.oMsgPool.getMobMsg();
                switch (msgScan.M[0].M) {
                    case 'spawnDetect':
                        Logger.T('마물 등장 감지됨');
                        console.log(msgScan.M[0].A[0].data);

                        // 이미 메시지 풀에 쌓여있는지 확인한다.
                        let isFound = false;
                        for (let poolIdx in curMsgPools) {
                            if (curMsgPools[poolIdx].mobId == msgScan.M[0].A[0].data.id && curMsgPools[poolIdx].mobInstance == msgScan.M[0].A[0].data.instance) {
                                isFound = true;
                                break;
                            }
                        }
                        if (!isFound) {
                            //let lastAliveDate = new Date(msgScan.M[0].A[0].data.lastAlive).format('yyyy/MM/dd HH:mm:ss');
                            let embedSet = null;
                            embedSet = {
                                color: parseInt('3498db', 16),
                                title: `[${msgScan.M[0].A[0].data.server.toUpperCase()}] Rank ${_this.oMobList.getRank(msgScan.M[0].A[0].data.id)}: ${_this.oMobList.getName(msgScan.M[0].A[0].data.id)}`,
                                description: `${_this.oMobList.getZone(msgScan.M[0].A[0].data.id)} (X: ${msgScan.M[0].A[0].data.x}, Y: ${msgScan.M[0].A[0].data.y}) - 인스턴스 ${msgScan.M[0].A[0].data.instance}`,
                                timestamp: new Date()
                            };
                            if (_this.bDebug) { embedSet.fields = [{ name: 'DEBUG', value: pData }]; }
                            _this.oMsgSeries.sendEmbedMsg(`${_this.oMobList.getRank(msgScan.M[0].A[0].data.id)} 마물 등장!`, embedSet)
                                .then(objDetResMsg => {
                                    let thisId = objDetResMsg.id;
                                    _this.oMsgPool.pushMobMsg({ msgId: thisId, mobId: msgScan.M[0].A[0].data.id, mobInstance: msgScan.M[0].A[0].data.instance, lastEmbed: JSON.parse(JSON.stringify({ embed: embedSet })) });
                                });
                        }
                        if (_this.bDebug) {
                            console.log('[마물 등장] 현재 쌓인 마물 메세지 풀');
                            console.log(_this.oMsgPool.getMobMsg());
                        }
                        break;
                    case 'notifyReportConfirm':
                        _this.oMsgPool.pushNotify(msgScan.M[0].A[0].id);
                        Logger.T('마물 토벌 보고됨');
                        console.log(_this.oMsgPool.getNotify());
                        break;
                    case 'updateHunts':
                        Logger.T('마물 정보 갱신됨');

                        let lastMobData = msgScan.M[0].A[0].timers;
                        for (let mobIdx in lastMobData) {
                            let mobKeyInfo = mobIdx.split('_');
                            if (lastMobData[mobIdx].hasOwnProperty('repId')) {
                                let posIdx = _this.oMsgPool.getNotify().indexOf(lastMobData[mobIdx].repId);
                                if (posIdx !== -1) {
                                    _this.oMsgPool.spliceNotify(posIdx, 1);
                                    Logger.T(`마물 토벌됨: 랭크 ${_this.oMobList.getRank(mobKeyInfo[0])} ${_this.oMobList.getName(mobKeyInfo[0])} (${mobKeyInfo[0]}) - 인스턴스 ${mobKeyInfo[1]}`);

                                    if (_this.bDebug) {
                                        console.log('[마물 갱신] 처리 전 현재 쌓인 마물 메세지 풀');
                                        console.log(curMsgPools);
                                    }
                                    for (let poolIdx in curMsgPools) {
                                        if (curMsgPools[poolIdx].mobId == parseInt(mobKeyInfo[0]) && curMsgPools[poolIdx].mobInstance == parseInt(mobKeyInfo[1])) {
                                            _this.oMsgSeries.getObject().fetchMessage(curMsgPools[poolIdx].msgId)
                                                .then(objFetMsg => {
                                                    let tempEmbed = curMsgPools[poolIdx].lastEmbed;
                                                    tempEmbed.embed.color = parseInt('c9c9c9', 16);
                                                    objFetMsg.edit('토벌 완료', tempEmbed);
                                                    _this.oMsgPool.spliceMobMsg(poolIdx, 1);

                                                    Logger.T('삭제 대상');
                                                    console.log(curMsgPools[poolIdx]);
                                                });
                                        }
                                    }
                                }
                            }
                        }
                        break;
                }
            }
        }
    }
}

/************************************************
 * CONSTANTS
*************************************************/
// Application
const APP_TITLE = 'FFXIV HAEDAL HUNT BOT';
const APP_DETAIL_TITLE = 'Final Fantasy XIV Haedal Automatic Hunt Tracer Bot';
const APP_VERSION = '0.1.3';

// Embed 아래 제목
const DISCORD_TITLE_ABB = 'FFXIV HAEDAL HUNT Notification';

// 토큰
const DISCORD_BOT_CLIENT_TOKEN = process.env.BOT_CLIENT_TOKEN;
const DISCORD_BOT_MSG_CHANNEL_ID = process.env.BOT_MSG_CHANNEL_ID;
// 서버 목록
const FFXIV_ALL_SERVERS = {
    primal: [
        { name: 'Behemoth', code: 78 },
        { name: 'Excalibur', code: 93 },
        { name: 'Exodus', code: 53 },
        { name: 'Famfrit', code: 35 },
        { name: 'Hyperion', code: 95 },
        { name: 'Lamia', code: 55 },
        { name: 'Leviathan', code: 64 },
        { name: 'Ultros', code: 77 }
    ]
};

// 디스코드 마물 처리
const oMobHuntDiscord = new MobHuntDiscord();

/************************************************
 * VARIABLES
*************************************************/
Date.prototype.format = function (f) {
    if (!this.valueOf())     return " ";

    let weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    let d = this;

    return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, ($1) => {
        switch ($1) {
            case "yyyy": return d.getFullYear();
            case "yy": return (d.getFullYear() % 1000).zf(2);
            case "MM": return (d.getMonth() + 1).zf(2);
            case "dd": return d.getDate().zf(2);
            case "E": return weekName[d.getDay()];
            case "HH": return d.getHours().zf(2);
            case "hh": return ((h = d.getHours() % 12) ? h : 12).zf(2);
            case "mm": return d.getMinutes().zf(2);
            case "ss": return d.getSeconds().zf(2);
            case "a/p": return d.getHours() < 12 ? "오전" : "오후";
            default: return $1;
        }
    });
};

String.prototype.string = function (len) { var s = '', i = 0; while (i++ < len) { s += this; } return s; };
String.prototype.zf = function (len) { return "0".string(len - this.length) + this; };
Number.prototype.zf = function (len) { return this.toString().zf(len); };


/************************************************
 * MAIN
*************************************************/
function main() {
    Logger.T('---------------------------------------------------------------');
    Logger.T(` ${APP_DETAIL_TITLE} v${APP_VERSION}`);
    Logger.T(' Author By. Karsei');
    Logger.T('---------------------------------------------------------------');

    oMobHuntDiscord.init();
}
main();

