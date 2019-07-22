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
const logger = new Logger();

/**
 * 상수
 */
// Embed 아래 제목
const DISCORD_TITLE_ABB = 'FFXIV HAEDAL HUNT Notification';
// 토큰
const DISCORD_BOT_CLIENT_TOKEN = process.env.BOT_CLIENT_TOKEN;
const DISCORD_BOT_MSG_CHANNEL_ID = process.env.BOT_MSG_CHANNEL_ID;
// 서버 목록
const allServers = {
    primal: [
        { name: 'Behemoth', code: 0 },
        { name: 'Excalibur', code: 0 },
        { name: 'Exodus', code: 0 },
        { name: 'Famfrit', code: 0 },
        { name: 'Hyperion', code: 95 },
        { name: 'Lamia', code: 0 },
        { name: 'Leviathan', code: 0 },
        { name: 'Ultros', code: 0 }
    ]
};

// 디버깅
let _DEBUG_ = false;
// 몬스터 정보 데이터
let mobRealStatus = {
    mobPools: [],       // 메세지 풀
    notifiedId: [],     // 토벌 보고 몬스터 ID
    lastMobData: {}     // 토벌 보고 정보 목록
};
// 봇 로그인 여부
let isLoggonBot = false;

logger.T('---------------------------------------------------------------');
logger.T(' Final Fantasy XIV Automatic Hunt Tracer By XIV Hunt');
logger.T(' Author By. Karsei');
logger.T('---------------------------------------------------------------');

// 마물 데이터 로드
logger.T('마물 데이터를 로드하고 있습니다...');
let huntListData = JSON.parse(fs.readFileSync('./huntlist.json'));
function getHuntData(pHuntId) {
    return huntListData[pHuntId];
}

function _purgePool() {
    mobRealStatus = {
        mobPools: [],       // 메세지 풀
        notifiedId: [],     // 토벌 보고 몬스터 ID
        lastMobData: {}     // 토벌 보고 정보 목록
    };
}

function _toggleDevMode() {
    if (_DEBUG_) {
        _DEBUG_ = false;
    } else {
        _DEBUG_ = true;
    }
    return _DEBUG_;
}

// 디스코드 봇 접속 시도
// https://www.devdungeon.com/content/javascript-discord-bot-tutorial
logger.T('디스코드 봇에 접속하고 있습니다...');
client.login(DISCORD_BOT_CLIENT_TOKEN)
    .then(() => {
        let _discordDebug_Msg = (pObjDebugMsg, pDebugStr) => {
            pObjDebugMsg.send(`[DEBUG] ${pDebugStr}`);
        };

        logger.T('디스코드 봇 접속 성공!');
        setTimeout(() => {
            if (!isLoggonBot) {
                logger.T('디스코드 봇에 접속 성공하였으나 로그인 감지를 하지 못하여 봇 해제 후 다시 접속을 시도합니다...');
                client.destroy().then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
            }
        }, 5000);

        client.on('ready', () => {
            // 봇 로그인 완료 플래그 설정
            isLoggonBot = true;
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
                    title: 'FFXIV HAEDAL HUNT BOT v0.1.1(Beta)',
                    description: 'Primals 데이터센터의 모든 서버 마물 정보를 알려주는 디스코드봇.\n문제 발견 시 제보 환영',
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
                let tokenData = JSON.parse(pNegoBody);
                console.log(tokenData);
                
                logger.T(`2초 후 글로벌 마물 웹 소켓 연결 시도를 시작합니다.`);
                if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '마물 사이트와 소켓 연결 시도중...'); }
                setTimeout(() => {
                    let hunt_Str = 'wss://horus-hunts.net/signalr/connect?transport=webSockets&clientProtocol=2.0&__Loc=/Tracker/Primal&__HW=Hyperion&__DC=Primal&__SS=' + new Date().format('yyyy-MM-dd HH:mm:ss') + '&connectionToken=' + encodeURIComponent(tokenData.ConnectionToken) + '&connectionData=[{"name":"huntshub"}]&tid=0';
                    logger.T(`글로벌 마물 웹 소켓 연결 시도를 진행합니다... (주소: ${hunt_Str}, 인코딩 주소: ${encodeURI(hunt_Str)})`);
                    ws.on('connectFailed', pConError => {
                        if (_DEBUG_) { _discordDebug_Msg(discordChMsg, '소켓 연결 실패'); }
                        logger.T('글로벌 마물 웹 소켓 연결 과정에서 오류가 발생했습니다.');
                        console.error(pConError.toString());
                        process.exit();
                    });
                    ws.on('connect', pConnection => {
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
                                logger.T('Received: "' + pCSMsg.utf8Data + '"');

                                let msgScan = JSON.parse(pCSMsg.utf8Data);
                                if (msgScan.hasOwnProperty('M') && msgScan.M.length > 0 && msgScan.M[0].hasOwnProperty('M')) {
                                    switch (msgScan.M[0].M) {
                                        case 'spawnDetect':
                                            logger.T('마물 등장 감지됨');
                                            console.log(msgScan.M[0].A[0].data);

                                            // 이미 풀에 쌓여있는지 확인한다.
                                            let isFound = false;
                                            for (let poolIdx in mobRealStatus.mobPools) {
                                                if (mobRealStatus.mobPools[poolIdx].mobId == msgScan.M[0].A[0].data.id && mobRealStatus.mobPools[poolIdx].mobInstance == msgScan.M[0].A[0].data.instance) {
                                                    isFound = true;
                                                    break;
                                                }
                                            }
                                            if (!isFound) {
                                                let lastAliveDate = new Date(msgScan.M[0].A[0].data.lastAlive).format('yyyy/MM/dd HH:mm:ss');
                                                let embedSet = null;
                                                if (_DEBUG_) {
                                                    embedSet = {
                                                        embed: {
                                                            color: parseInt('3498db', 16),
                                                            title: `[${msgScan.M[0].A[0].data.server}] Rank ${getHuntData(msgScan.M[0].A[0].data.id).rank}: ${getHuntData(msgScan.M[0].A[0].data.id).name}`,
                                                            description: `${getHuntData(msgScan.M[0].A[0].data.id).zone} (X: ${msgScan.M[0].A[0].data.x}, Y: ${msgScan.M[0].A[0].data.y})\n인스턴스 ${msgScan.M[0].A[0].data.instance}`,
                                                            fields: [
                                                                { name: 'DEBUG', value: pCSMsg.utf8Data }],
                                                            timestamp: new Date()
                                                        }
                                                    };
                                                } else {
                                                    embedSet = {
                                                        embed: {
                                                            color: parseInt('3498db', 16),
                                                            title: `[${msgScan.M[0].A[0].data.server}] Rank ${getHuntData(msgScan.M[0].A[0].data.id).rank}: ${getHuntData(msgScan.M[0].A[0].data.id).name}`,
                                                            description: `${getHuntData(msgScan.M[0].A[0].data.id).zone} (X: ${msgScan.M[0].A[0].data.x}, Y: ${msgScan.M[0].A[0].data.y})\n인스턴스 ${msgScan.M[0].A[0].data.instance}`,
                                                            timestamp: new Date()
                                                        }
                                                    };
                                                }
                                                discordChMsg.send(`${getHuntData(msgScan.M[0].A[0].data.id).rank} 마물 등장!`, embedSet)
                                                    .then(objDetResMsg => {
                                                        let thisId = objDetResMsg.id;
                                                        console.log(`ID: ${thisId}`);
                                                        console.log(`LAST ID: ${discordChMsg.lastMessageID}`)
                                                        //discordChMsg.send('MSG ID: '+ discordChMsg.lastMessageID);
                                                        mobRealStatus.mobPools.push({ msgId: thisId, mobId: msgScan.M[0].A[0].data.id, mobInstance: msgScan.M[0].A[0].data.instance, lastEmbed: JSON.parse(JSON.stringify(embedSet)) });
                                                    });
                                            }
                                            console.log('[마물 등장] 현재 쌓인 마물 메세지 풀');
                                            console.log(mobRealStatus.mobPools);
                                            break;
                                        case 'notifyReportConfirm':
                                            logger.T('마물 토벌 보고됨');
                                            mobRealStatus.notifiedId.push(msgScan.M[0].A[0].id);
                                            console.log(mobRealStatus.notifiedId);
                                            break;
                                        case 'updateHunts':
                                            logger.T('마물 정보 갱신됨');
                                            mobRealStatus.lastMobData = msgScan.M[0].A[0].timers;
                                            for (let mobIdx in mobRealStatus.lastMobData) {
                                                let mobKeyInfo = mobIdx.split('_');
                                                if (mobRealStatus.lastMobData[mobIdx].hasOwnProperty('repId')) {
                                                    let posIdx = mobRealStatus.notifiedId.indexOf(mobRealStatus.lastMobData[mobIdx].repId);
                                                    if (posIdx !== -1) {
                                                        mobRealStatus.notifiedId.splice(posIdx, 1);
                                                        console.log(`마물 토벌됨: ${mobKeyInfo[0]} (인스턴스 ${mobKeyInfo[1]})`);
                                                        //discordChMsg.send(`마물 토벌됨: ${mobKeyInfo[0]} (인스턴스 ${mobKeyInfo[1]})`);

                                                        console.log('[마물 갱신] 처리 전 현재 쌓인 마물 메세지 풀');
                                                        console.log(mobRealStatus.mobPools);
                                                        for (let poolIdx in mobRealStatus.mobPools) {
                                                            if (mobRealStatus.mobPools[poolIdx].mobId == parseInt(mobKeyInfo[0]) && mobRealStatus.mobPools[poolIdx].mobInstance == parseInt(mobKeyInfo[1])) {
                                                                discordChMsg.fetchMessage(mobRealStatus.mobPools[poolIdx].msgId)
                                                                    .then(objFetMsg => {
                                                                        let tempEmbed = mobRealStatus.mobPools[poolIdx].lastEmbed;
                                                                        tempEmbed.embed.color = parseInt('c9c9c9', 16);
                                                                        objFetMsg.edit('토벌 완료', tempEmbed);
                                                                        console.log('삭제 대상');
                                                                        console.log(mobRealStatus.mobPools[poolIdx]);
                                                                        mobRealStatus.mobPools.splice(poolIdx, 1);
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
                                    'connectionToken': tokenData.ConnectionToken,
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
                                        for (let dcIdx in allServers) {
                                            let sidx = 0;
                                            for (let sIdx in allServers[dcIdx]) {
                                                ((_name, _x) => {
                                                    setTimeout(() => {
                                                        let sendStr = `{"H":"huntshub","M":"addToWorld","A":["${_name}"],"I":${_x}}`;
                                                        console.log('Send: ' + sendStr);
                                                        pConnection.send(sendStr.toString());
                                                    }, 100 * _x);
                                                })(allServers[dcIdx][sIdx].name, sidx);
                                                ++sidx;
                                            }
                                        }
                                    };
                                    if (pConnection.connected) {
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

        client.on('message', oMsg => {
            console.log(oMsg.id);
            switch (oMsg.content.toUpperCase()) {
                case ';!RESET':
                    oMsg.channel.send('초기화합니다...')
                        .then(msg => client.destroy())
                        .then(() => client.login(DISCORD_BOT_CLIENT_TOKEN));
                    break;
                case ';!EXIT':
                    oMsg.channel.send('봇을 오프라인으로 전환하고 서버를 종료합니다...')
                        .then(msg => client.destroy())
                        .then(() => process.exit());
                    break;
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
                    oMsg.channel.send('ID: '+ oMsg.channel.lastMessageID);
                    break;
                case ';!PURGEPOOL':
                    oMsg.channel.send('메세지 POOL을 삭제합니다...')
                        .then(msg => {
                            _purgePool();
                            msg.channel.send('메세지 POOL을 성공적으로 삭제하였습니다.');
                        });
                    break;
                case ';!TOGGLEDEV':
                    oMsg.channel.send('개발 모드를 토글합니다...')
                        .then(msg => {
                            let devmode = _toggleDevMode();
                            if (devmode)    msg.channel.send('개발 모드가 활성화되었습니다.');
                            else            msg.channel.send('개발 모드가 비활성화되었습니다.');
                        });
                    break;
            }
        });
    }).catch(() => {
        logger.T('디스코드 봇 접속 오류 발생');
        process.exit();
    });