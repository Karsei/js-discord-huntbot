/**
 * FFXIV HUNT PARSER BOT for Discord BOT
 * 
 * Author By. Karsei
 */
// env
const env = require('dotenv');
env.config({path: '.env'});

// fs
const fs = require('fs');

// Websocket
const WebSocket = require('websocket').client;
const ws = new WebSocket();

// Request
const request = require('request');

// Discord
const Discord = require('discord.js');
const client = new Discord.Client();

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
        String.prototype.string = function (len) { var s = '', i = 0; while (i++ < len) { s += this; } return s; };
        String.prototype.zf = function (len) { return "0".string(len - this.length) + this; };
        Number.prototype.zf = function (len) { return this.toString().zf(len); };

        Date.prototype.format = function (f) {
            if (!this.valueOf())     return " ";

            let weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
            let d = this;

            return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function($1) {
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
    }

    /**
     * 콘솔에 로그 남김
     * 
     * @param {string} pMsg             메세지
     */
    T(pMsg) {
        console.log('[' + new Date().format('yyyy/MM/dd HH:mm:ss') + '] ' + pMsg);
    }
}


/************************************************
 * CONSTANTS
*************************************************/
// Application
const APP_TITLE = 'FFXIV HAEDAL HUNT BOT';
const APP_DETAIL_TITLE = 'Final Fantasy XIV Haedal Automatic Hunt Tracer Bot';
const APP_VERSION = '0.1.2';

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
// 로거
const logger = new Logger();

/************************************************
 * VARIABLES
*************************************************/
// 디버깅
let _DEBUG_ = false;
// 몬스터 정보 데이터
let xivMobRealStatus = {
    mobPools: [],       // 메세지 풀
    notifiedId: [],     // 토벌 보고 몬스터 ID
    lastMobData: {}     // 토벌 보고 정보 목록
};
// 인증 토큰 데이터
let xivTokenData = {};
// 봇 로그인 여부
let sysStatus = {
    discord_logon_bot: false,
    websocket_logon: false
};


/************************************************
 * FUNCTIONS
*************************************************/
/**
 * 마물 데이터 정보 조회
 * 
 * @param {integer} pHuntId     몬스터 번호
 */
function _getHuntData(pHuntId) {
    return huntListData[pHuntId];
}

/**
 * POOL 초기화
 */
function _purgePool() {
    xivMobRealStatus = {
        mobPools: [],       // 메세지 풀
        notifiedId: [],     // 토벌 보고 몬스터 ID
        lastMobData: {}     // 토벌 보고 정보 목록
    };
}

/**
 * 개발 모드 토글
 */
function _toggleDevMode() {
    return _DEBUG_ = !_DEBUG_;
}


/************************************************
 * MAIN
*************************************************/
logger.T('---------------------------------------------------------------');
logger.T(` ${APP_DETAIL_TITLE} v${APP_VERSION}`);
logger.T(' Author By. Karsei');
logger.T('---------------------------------------------------------------');

// 마물 데이터 로드 (B, A, S급 마물)
logger.T('마물 데이터를 로드하고 있습니다...');
let huntListData = JSON.parse(fs.readFileSync('./huntlist.json'));

// 디스코드 봇 접속 시도
// 참고. https://www.devdungeon.com/content/javascript-discord-bot-tutorial
logger.T('디스코드 봇에 접속하고 있습니다...');
client.login(DISCORD_BOT_CLIENT_TOKEN)
    .then(() => {
        let _discordDebug_Msg = (pObjDebugMsg, pDebugStr) => {
            pObjDebugMsg.send(`[DEBUG] ${pDebugStr}`);
        };

        logger.T('디스코드 봇 접속 성공!');
        setTimeout(() => {
            if (!sysStatus.discord_logon_bot) {
                logger.T('디스코드 봇에 접속 성공하였으나 로그인 감지를 하지 못하여 봇 해제 후 다시 접속을 시도합니다...');
                client.destroy().then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
            }
        }, 5000);

        // 디스코드 봇 로그인
        client.on('ready', () => {
            // 봇 로그인 완료 플래그 설정
            sysStatus.discord_logon_bot = true;

            // POOL 초기화
            _purgePool();

            logger.T(`${client.user.tag}로 로그인되었습니다!`);
            logger.T('현재 연결된 모든 서버 정보: ')
            client.guilds.forEach((pGuild) => {
                console.log(` - [${pGuild.name}]`);
                // 채널
                pGuild.channels.forEach((pChannel) => {
                    console.log(` -- ${pChannel.name} (${pChannel.type}) - ${pChannel.id}`);
                });
            });

            // 기본 정보 문구 출력
            var discordChMsg = client.channels.get(DISCORD_BOT_MSG_CHANNEL_ID);
            if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '디버그 모드가 켜져 있습니다. 개발을 하지 않는 경우에는 이 모드를 끄고 진행하세요!'); }
            discordChMsg.send({
                embed: {
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
                }
            });

            if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '디스코드 서버와 연결 완료'); }

            // 웹 소켓 접근 시도
            logger.T(`글로벌 마물 웹 소켓 인증 토큰 발급을 시도합니다...`);
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
            if (_DEBUG_) {
                _discordDebug_Msg(discordChMsg, '마물 사이트로부터 인증 토큰 발급 시도중...');
                console.log(negoOption);
            }
            request.get(negoOption, function (pNegoError, pNeoRes, pNegoBody) {
                if (pNegoError != null) {
                    if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '인증 토큰 발급 실패'); }
                    logger.T('인증 토큰 발급 과정에서 오류가 발생했습니다.');
                    console.error(pNegoError);
                    process.exit();
                }
                logger.T(`인증 토큰 발급 성공! (코드: ${pNeoRes.statusCode})`);
                xivTokenData = JSON.parse(pNegoBody);
                if (_DEBUG_)    console.log(xivTokenData);
                
                // 마물 웹 소켓 연결 시도
                logger.T(`2초 후 글로벌 마물 웹 소켓 연결 시도를 시작합니다.`);
                if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '마물 사이트와 소켓 연결 시도중...'); }
                setTimeout(() => {
                    let hunt_Str = 'wss://horus-hunts.net/signalr/connect?transport=webSockets&clientProtocol=2.0&__Loc=/Tracker/Primal&__HW=Hyperion&__DC=Primal&__SS=' + new Date().format('yyyy-MM-dd HH:mm:ss') + '&connectionToken=' + encodeURIComponent(xivTokenData.ConnectionToken) + '&connectionData=[{"name":"huntshub"}]&tid=0';
                    logger.T(`글로벌 마물 웹 소켓 연결 시도를 진행합니다... (주소: ${hunt_Str}, 인코딩 주소: ${encodeURI(hunt_Str)})`);
                    ws.on('connectFailed', pConError => {
                        if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '소켓 연결 실패'); }
                        logger.T('글로벌 마물 웹 소켓 연결 과정에서 오류가 발생했습니다.');
                        console.error(pConError.toString());
                        process.exit();
                    });
                    ws.on('connect', pConnection => {
                        sysStatus.websocket_logon = true;

                        logger.T('글로벌 마물 웹 소켓 연결 성공!');
                        pConnection.on('error', pCSError => {
                            logger.T('글로벌 마물 웹 소켓 연결에서 오류가 발생했습니다.');
                            discordChMsg.send('서버 내부에서 소켓 오류가 발생했습니다. 개발자에게 문의하세요.');
                            console.error(pCSError);
                        });
                        pConnection.on('close', () => {
                            logger.T('글로벌 마물 웹 소켓 연결이 서버로부터 닫혔습니다.');
                            discordChMsg.send('서버가 닫혀서 서비스 제공이 불가능합니다. 개발자에게 문의하세요.');
                            process.exit();
                        });
                        pConnection.on('message', pCSMsg => {
                            if (pCSMsg.type === 'utf8') {
                                logger.T('받음: "' + pCSMsg.utf8Data + '"');

                                let msgScan = JSON.parse(pCSMsg.utf8Data);
                                if (msgScan.hasOwnProperty('M') && msgScan.M.length > 0 && msgScan.M[0].hasOwnProperty('M')) {
                                    switch (msgScan.M[0].M) {
                                        case 'spawnDetect':
                                            logger.T('마물 등장 감지됨');
                                            console.log(msgScan.M[0].A[0].data);

                                            // 이미 풀에 쌓여있는지 확인한다.
                                            let isFound = false;
                                            for (let poolIdx in xivMobRealStatus.mobPools) {
                                                if (xivMobRealStatus.mobPools[poolIdx].mobId == msgScan.M[0].A[0].data.id && xivMobRealStatus.mobPools[poolIdx].mobInstance == msgScan.M[0].A[0].data.instance) {
                                                    isFound = true;
                                                    break;
                                                }
                                            }
                                            if (!isFound) {
                                                //let lastAliveDate = new Date(msgScan.M[0].A[0].data.lastAlive).format('yyyy/MM/dd HH:mm:ss');
                                                let embedSet = null;
                                                if (_DEBUG_) {
                                                    embedSet = {
                                                        embed: {
                                                            color: parseInt('3498db', 16),
                                                            title: `[${msgScan.M[0].A[0].data.server}] Rank ${_getHuntData(msgScan.M[0].A[0].data.id).rank}: ${_getHuntData(msgScan.M[0].A[0].data.id).name}`,
                                                            description: `${_getHuntData(msgScan.M[0].A[0].data.id).zone} (X: ${msgScan.M[0].A[0].data.x}, Y: ${msgScan.M[0].A[0].data.y}) - 인스턴스 ${msgScan.M[0].A[0].data.instance}`,
                                                            fields: [
                                                                { name: 'DEBUG', value: pCSMsg.utf8Data }],
                                                            timestamp: new Date()
                                                        }
                                                    };
                                                } else {
                                                    embedSet = {
                                                        embed: {
                                                            color: parseInt('3498db', 16),
                                                            title: `[${msgScan.M[0].A[0].data.server}] Rank ${_getHuntData(msgScan.M[0].A[0].data.id).rank}: ${_getHuntData(msgScan.M[0].A[0].data.id).name}`,
                                                            description: `${_getHuntData(msgScan.M[0].A[0].data.id).zone} (X: ${msgScan.M[0].A[0].data.x}, Y: ${msgScan.M[0].A[0].data.y}) - 인스턴스 ${msgScan.M[0].A[0].data.instance}`,
                                                            timestamp: new Date()
                                                        }
                                                    };
                                                }
                                                discordChMsg.send(`${_getHuntData(msgScan.M[0].A[0].data.id).rank} 마물 등장!`, embedSet)
                                                    .then(objDetResMsg => {
                                                        let thisId = objDetResMsg.id;
                                                        xivMobRealStatus.mobPools.push({ msgId: thisId, mobId: msgScan.M[0].A[0].data.id, mobInstance: msgScan.M[0].A[0].data.instance, lastEmbed: JSON.parse(JSON.stringify(embedSet)) });
                                                    });
                                            }
                                            if (_DEBUG_) {
                                                console.log('[마물 등장] 현재 쌓인 마물 메세지 풀');
                                                console.log(xivMobRealStatus.mobPools);
                                            }
                                            break;
                                        case 'notifyReportConfirm':
                                            xivMobRealStatus.notifiedId.push(msgScan.M[0].A[0].id);
                                            logger.T('마물 토벌 보고됨');
                                            console.log(xivMobRealStatus.notifiedId);
                                            break;
                                        case 'updateHunts':
                                            logger.T('마물 정보 갱신됨');
                                            xivMobRealStatus.lastMobData = msgScan.M[0].A[0].timers;
                                            for (let mobIdx in xivMobRealStatus.lastMobData) {
                                                let mobKeyInfo = mobIdx.split('_');
                                                if (xivMobRealStatus.lastMobData[mobIdx].hasOwnProperty('repId')) {
                                                    let posIdx = xivMobRealStatus.notifiedId.indexOf(xivMobRealStatus.lastMobData[mobIdx].repId);
                                                    if (posIdx !== -1) {
                                                        xivMobRealStatus.notifiedId.splice(posIdx, 1);
                                                        logger.T(`마물 토벌됨: ${_getHuntData(mobKeyInfo[0]).rank} (${mobKeyInfo[0]}) - 인스턴스 ${mobKeyInfo[1]}`);

                                                        if (_DEBUG_) {
                                                            console.log('[마물 갱신] 처리 전 현재 쌓인 마물 메세지 풀');
                                                            console.log(xivMobRealStatus.mobPools);
                                                        }
                                                        for (let poolIdx in xivMobRealStatus.mobPools) {
                                                            if (xivMobRealStatus.mobPools[poolIdx].mobId == parseInt(mobKeyInfo[0]) && xivMobRealStatus.mobPools[poolIdx].mobInstance == parseInt(mobKeyInfo[1])) {
                                                                discordChMsg.fetchMessage(xivMobRealStatus.mobPools[poolIdx].msgId)
                                                                    .then(objFetMsg => {
                                                                        let tempEmbed = xivMobRealStatus.mobPools[poolIdx].lastEmbed;
                                                                        tempEmbed.embed.color = parseInt('c9c9c9', 16);
                                                                        objFetMsg.edit('토벌 완료', tempEmbed);
                                                                        xivMobRealStatus.mobPools.splice(poolIdx, 1);

                                                                        logger.T('삭제 대상');
                                                                        console.log(xivMobRealStatus.mobPools[poolIdx]);
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
                        });

                        logger.T(`5초 후 글로벌 마물 웹 소켓 시작 처리를 진행합니다...`);
                        if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '마물 사이트와 소켓 연결 시작 시도...'); }
                        setTimeout(() => {
                            let startOption = {
                                uri: 'https://horus-hunts.net/signalr/start',
                                qs: {
                                    'transport': 'webSockets',
                                    'clientProtocol': '2.0',
                                    '__Loc': '/Tracker/Primal',
                                    '__HW': 'Hyperion',
                                    '__DC': 'Primal',
                                    '__SS': new Date().format('yyyy-MM-dd HH:mm:ss'),
                                    'connectionToken': xivTokenData.ConnectionToken,
                                    'connectionData': '[{"name":"huntshub"}]',
                                    '_': new Date().getTime()
                                }
                            }
                            request.get(startOption, function (pStartError, pStartRes, pStartBody) {
                                if (pStartError != null) {
                                    if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '소켓 연결 시작 실패'); }
                                    logger.T('글로벌 마물 웹 소켓 시작 처리 과정에서 오류가 발생했습니다.');
                                    process.exit();
                                }

                                //if (pStartRes.statusCode == 200) {
                                if (pStartRes.statusCode != 200) {
                                    logger.T(`글로벌 마물 웹 소켓 처리 시작 성공! (코드: ${pStartRes.statusCode})`);
                                    if (_DEBUG_) {
                                        _discordDebug_Msg(discordChMsg, 'Primal 데이터 센터의 모든 서버군 등록 시도...');
                                        console.log(pStartBody);
                                    }
                
                                    logger.T('메세지를 받을 서버를 추가합니다...');
                                    let insertAddServer = () => {
                                        for (let dcIdx in FFXIV_ALL_SERVERS) {
                                            let sidx = 0;
                                            for (let sIdx in FFXIV_ALL_SERVERS[dcIdx]) {
                                                ((_name, _x) => {
                                                    setTimeout(() => {
                                                        let sendStr = `{"H":"huntshub","M":"addToWorld","A":["${_name}"],"I":${_x}}`;
                                                        logger.T(`보냄: ${sendStr}`);
                                                        pConnection.send(sendStr.toString());
                                                    }, 100 * _x);
                                                })(FFXIV_ALL_SERVERS[dcIdx][sIdx].name, sidx);
                                                ++sidx;
                                            }
                                        }
                                    };
                                    if (pConnection.connected) {
                                        // 메세지 받을 서버 추가
                                        insertAddServer();

                                        logger.T('완료!');
                                        if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '정상적으로 모두 진행 완료'); }
                                    } else {
                                        logger.T('연결이 되어있지 않아 실패하였습니다.');
                                        process.exit();
                                    }
                                } else {
                                    logger.T(`글로벌 마물 웹 소켓 처리 시작 결과에서 오류가 발생했습니다.`);
                                    console.error(pStartBody);
                                    process.exit();
                                }
                            });
                        }, 5000);
                    });

                    ws.connect(hunt_Str);
                }, 2000);
            });
        });

        // 디스코드 메시지 감지
        client.on('message', oMsg => {
            // if (_DEBUG_) { logger.T(`메세지 감지 => ${oMsg.content}`); }
            switch (oMsg.content.toUpperCase()) {
                // 디스코드 봇 초기화
                case ';!RESET':
                    oMsg.channel.send('초기화합니다...')
                        .then(msg => client.destroy())
                        .then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
                    break;
                // 프로세스 종료
                case ';!EXIT':
                    oMsg.channel.send('봇을 오프라인으로 전환하고 서버를 종료합니다...')
                        .then(msg => client.destroy())
                        .then(() => process.exit());
                    break;
                // PING
                case ';!PING':
                    oMsg.channel.send('PONG', {
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
                    oMsg.channel.send('메세지 POOL을 삭제합니다...')
                        .then(msg => {
                            // POOL 삭제
                            _purgePool();

                            msg.channel.send('메세지 POOL을 성공적으로 삭제하였습니다.');
                        });
                    break;
                // 개발 모드 토글
                case ';!TOGGLEDEV':
                    oMsg.channel.send('개발 모드를 토글합니다...')
                        .then(msg => {
                            let devmode = _toggleDevMode();
                            if (devmode)    msg.channel.send('개발 모드가 활성화되었습니다.');
                            else            msg.channel.send('개발 모드가 비활성화되었습니다.');
                        });
                    break;
                // 서버 상태 확인
                case ';!STATUS':
                    let _msgIdStr = xivMobRealStatus.mobPools.map((pMob) => { return pMob.msgId; }).join(',');
                    oMsg.channel.send('현재 서버 상태입니다.', {
                        embed: {
                            color: parseInt('f5df38', 16),
                            title: 'Server Status',
                            description: `[Connection Token]\n${xivTokenData.ConnectionToken}`,
                            fields: [
                                { name: 'Message Pools', value: `${xivMobRealStatus.mobPools.length}개` },
                                { name: 'Killed Id Pools', value: `${xivMobRealStatus.notifiedId.length}개` },
                                { name: 'Message Id Waiting List', value: _msgIdStr.length > 0 ? _msgIdStr : '(대기열 없음)' }
                            ],
                            timestamp: new Date(),
                            footer: {
                                text: DISCORD_TITLE_ABB
                            }
                        }
                    });
                    logger.T(`Message Pools: ${xivMobRealStatus.mobPools.length}개`);
                    logger.T(`Killed Id Pools: ${xivMobRealStatus.notifiedId.length}개`);
                    logger.T(`Message Id Waiting List: ${_msgIdStr}`);
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
                    oMsg.channel.send(_clStr);
                    break;
            }
        });
    }).catch(() => {
        logger.T('디스코드 봇 접속 오류 발생');
        process.exit();
    });

// 5분 간격으로 핑 보냄
setInterval(() => {
    if (sysStatus.websocket_logon) {
        let pingOption = {
            uri: 'https://horus-hunts.net/signalr/ping',
            qs: {
                '__Loc': '/Tracker/Primal',
                '__HW': '',
                '__DC': 'Primal',
                '__SS': new Date().format('yyyy-MM-dd HH:mm:ss'),
                '_': new Date().getTime()
            }
        }
        request.get(pingOption, function (pPingError, pPingRes, pPingBody) {
            if (pPingError != null) {
                logger.T('Ping Pong Error');
                console.error(pPingError);
            }
            console.log(pPingBody);
            logger.T('Ping Pong!');
        });
    } else {
        logger.T('웹 소켓 연결 안됨');
    }
}, 300000);