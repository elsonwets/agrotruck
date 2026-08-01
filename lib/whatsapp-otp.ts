import "server-only";

export async function sendWhatsAppOtp(phoneNumber: string, code: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE;
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  if (!accessToken || !phoneNumberId || !templateName || !language || !apiVersion) {
    throw new Error("A autenticação WhatsApp ainda não está configurada.");
  }
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("WhatsApp OTP delivery failed", response.status, detail);
    throw new Error("Não foi possível enviar o código por WhatsApp.");
  }
}
