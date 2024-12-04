import { whatsapp } from '../../services/baileys.js';


export const whatsappLoginController = async (req, res) => {
    
    try {
        if (req?.query?.login) {
            
            await whatsapp.start();
            whatsapp.listenMessagesUpsert();
            res.statusCode(200);
            
        } else {

            console.log(req.query);
            // eslint-disable-next-line no-undef
            const root = process.cwd();
            res.status(200).sendFile(`${root}/qr.ui/index.html`);

        }
        
    } catch (error) {
        res.status(500).json({ status: 'error', description: error });
    }

};





