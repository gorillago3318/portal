const axios = require('axios');

/**
 * sendWhatsAppMessage sends a text message via WhatsApp Cloud API.
 *
 * @param {string} phone - Recipient's phone number in international format.
 * @param {string} message - The text message to send.
 */
const sendWhatsAppMessage = async (phone, message) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('Missing WhatsApp Cloud API configuration.');
    return;
  }
  
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: message }
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('[DEBUG] WhatsApp Cloud API response:', response.data);
  } catch (error) {
    console.error(
      '[ERROR] WhatsApp Cloud API error:',
      error.response ? error.response.data : error.message
    );
  }
};

module.exports = { sendWhatsAppMessage };
