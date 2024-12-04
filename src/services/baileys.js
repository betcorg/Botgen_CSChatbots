
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';

import qrcode from 'qrcode';
import { io } from '../index.js';
import fs from 'fs';

const authFolder = 'bot_sessions';

class WaClient {

    constructor() {
        this.sock = null;
    }

    async start() {

        try {

            const { state, saveCreds } = await useMultiFileAuthState(authFolder);

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
            });

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('connection.update', async (update) => {

                const { connection, lastDisconnect, qr } = update;

                if (connection === 'close') {
                    console.log('Connection closed');
                    await whatsapp.connectionKeeper(lastDisconnect);

                }
                console.log('Connection update', update);

                if (connection === 'open') {
                    console.log('[*] Connection opened');
                    io.emit('open', 'Sesión iniciada');

                }

                if (qr) {
                    console.log('QR received', qr);
                    qrcode.toDataURL(qr, async (error, url) => {
                        io.emit('qr', url);
                    });
                }
            });
            return this.sock;

        } catch (error) {
            console.log('[!] Error during WhatsApp connection:', error);
        }

    }

    /**
     * Attempts to reconnect if the last disconnect was not a logout.
     * @param {object} lastDisconnect - The last disconnect event object.
     */
    async connectionKeeper(lastDisconnect) {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('[-] Connection closed due to:', lastDisconnect.error, ', reconnecting:', shouldReconnect);
        if (shouldReconnect) {
            await this.start();
        }
    }

    /**
     * Sets up a listener for new messages.
     * @param {function(Array<object>, string):void} callback - Callback function to handle new messages. 
     * It receives two arguments: `messages` (recived message) and `type` (a string indicating the type of update).
     */
    listenMessagesUpsert() {
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {

            if (type === 'notify') {

                if (!messages[0]?.key.fromMe) {

                    fs.writeFileSync('payloads/payload-wa.json', JSON.stringify(messages), 'utf-8');
        
                    const id = messages[0].key.remoteJid;
                    await this.sendTextMessage(id, 'Hola hemos recibido tu mensaje');
                }
            }
        });
    }

    /**
     * Sends a text message.
     * @param {string} id - WhatsApp ID of the recipient.
     * @param {string} text - Text message to send.
     */
    async sendTextMessage(id, text) {
        await this.sock.sendMessage(id, { text: text });
    }
    
}

export const whatsapp = new WaClient();



