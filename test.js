const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const readline = require('readline');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    delay
} = require('@whiskeysockets/baileys');
const MAIN_LOGGER = require('./path-to-logger'); // Ajusta la ruta según tu estructura

const logger = MAIN_LOGGER.child({});
logger.level = 'trace';

const msgRetryCounterCache = new NodeCache();

const store = useStore ? makeInMemoryStore({ logger }) : undefined;
if (store) {
    store.readFromFile('./baileys_store_multi.json');
    setInterval(() => {
        store.writeToFile('./baileys_store_multi.json');
    }, 10000);
}

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: !usePairingCode,
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage,
    });

    store?.bind(sock.ev);

    const sendMessageWTyping = async (msg, jid) => {
        await sock.presenceSubscribe(jid);
        await delay(500);

        await sock.sendPresenceUpdate('composing', jid);
        await delay(2000);

        await sock.sendPresenceUpdate('paused', jid);

        await sock.sendMessage(jid, msg);
    };

    sock.ev.process( async (events) => {
        
        if (events['connection.update']) {
            const update = events['connection.update'];
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if ((lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
                    startSock();
                } else {
                    console.log('Connection closed. You are logged out.');
                }
            }
            console.log('connection update', update);
        }

        if (events['creds.update']) {
            await saveCreds();
        }

        if (events['messages.upsert']) {
            const upsert = events['messages.upsert'];
            console.log('recv messages ', JSON.stringify(upsert, undefined, 2));

            if (upsert.type === 'notify') {
                for (const msg of upsert.messages) {
                    if (!msg.key.fromMe && doReplies) {
                        console.log('replying to', msg.key.remoteJid);
                        await sock.readMessages([msg.key]);
                        await sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid);
                    }
                }
            }
        }

        // Puedes agregar más manejadores de eventos aquí según sea necesario
    }
    );

    return sock;

    async function getMessage(key) {
        if (store) {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg?.message || undefined;
        }
        return {};
    }
};

startSock();